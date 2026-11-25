"""
Queries over the S3 data lake (raw listening events as Parquet, see infra/lake/README.md)
with DuckDB. Every query reads only the date partitions it needs, drops duplicate events
by event_id (the writer is at-least-once) and is cached in Redis for 10 minutes, so the
dashboard doesn't rescan S3 on every page view.

Settings:
  LAKE_URI            s3://<bucket>/lake (or a local directory in tests)
  LAKE_S3_ENDPOINT    host:port for an S3-compatible store (local dev); empty for AWS
  LAKE_S3_URL_STYLE   "path" for local stores, "vhost" for AWS
  DUCKDB_EXTENSION_DIRECTORY  where httpfs/postgres are pre-installed in the image
"""

import hashlib
import json
import logging
import threading
from datetime import date, timedelta
from typing import Any, Callable, Dict, List, Optional

from django.conf import settings

logger = logging.getLogger(__name__)

CACHE_SECONDS = 600
_local = threading.local()


class LakeUnavailable(Exception):
    """The lake isn't configured or couldn't be read; callers show 'not available'."""


def _settings(name: str, default: str = "") -> str:
    return str(getattr(settings, name, default) or default)


def lake_uri() -> str:
    return _settings("LAKE_URI").rstrip("/")


def _connect():
    """One DuckDB connection per thread (Gunicorn threads share nothing else)."""
    conn = getattr(_local, "conn", None)
    if conn is not None:
        return conn
    try:
        import duckdb
    except ImportError as e:  # pragma: no cover
        raise LakeUnavailable("duckdb is not installed") from e
    conn = duckdb.connect(database=":memory:")
    ext_dir = _settings("DUCKDB_EXTENSION_DIRECTORY")
    if ext_dir:
        conn.execute(f"SET extension_directory = '{ext_dir}'")
    if lake_uri().startswith("s3://"):
        conn.execute("INSTALL httpfs; LOAD httpfs;")
        endpoint = _settings("LAKE_S3_ENDPOINT")
        if endpoint:
            conn.execute(
                "CREATE OR REPLACE SECRET lake (TYPE s3, KEY_ID ?, SECRET ?, ENDPOINT ?, URL_STYLE ?, USE_SSL ?, REGION ?)",
                [
                    _settings("AWS_ACCESS_KEY_ID", "local"),
                    _settings("AWS_SECRET_ACCESS_KEY", "local"),
                    endpoint,
                    _settings("LAKE_S3_URL_STYLE", "path"),
                    _settings("LAKE_S3_USE_SSL", "false").lower() == "true",
                    _settings("AWS_REGION", "us-east-1"),
                ],
            )
        else:
            # The EC2 instance role first: the container's static AWS keys (used for the
            # media buckets) don't have access to the lake bucket.
            conn.execute(
                "CREATE OR REPLACE SECRET lake (TYPE s3, PROVIDER credential_chain, CHAIN ?, REGION ?)",
                [_settings("LAKE_CREDENTIAL_CHAIN", "instance;env;config"), _settings("AWS_REGION", "ap-south-1")],
            )
    _local.conn = conn
    return conn


def reset_connection() -> None:
    conn = getattr(_local, "conn", None)
    if conn is not None:
        conn.close()
    _local.conn = None


def topic_glob(topic: str) -> str:
    return f"{lake_uri()}/events/topic={topic}/*/*.parquet"


def _cached(key_parts: Dict[str, Any], compute: Callable[[], Any]) -> Any:
    key = "lake:v1:" + hashlib.sha256(json.dumps(key_parts, sort_keys=True, default=str).encode()).hexdigest()[:32]
    client = None
    try:
        from core.services.redis_service import RedisService

        client = RedisService.get_client()
        raw = client.get(key)
        if raw:
            return json.loads(raw)
    except Exception:
        client = None
    value = compute()
    if client is not None:
        try:
            client.set(key, json.dumps(value, default=str), ex=CACHE_SECONDS)
        except Exception:
            pass
    return value


def _plays_source(start: Optional[date], end: date) -> str:
    """Deduplicated plays in range as a SQL relation.

    One glob over the topic with a filter on the dt partition: DuckDB skips files from
    other days (partition pruning), and days without files simply contribute nothing.
    """
    path = topic_glob("listening.play.v1").replace("'", "''")
    where = f"dt <= DATE '{end.isoformat()}'"
    if start is not None:
        where += f" AND dt >= DATE '{start.isoformat()}'"
    return (
        "(SELECT * FROM (SELECT *, row_number() OVER (PARTITION BY event_id ORDER BY received_at) AS rn "
        f"FROM read_parquet('{path}', hive_partitioning = true, hive_types = {{'dt': DATE}}, union_by_name = true) "
        f"WHERE {where}) WHERE rn = 1)"
    )


def _run(sql: str, params: List[Any]) -> List[tuple]:
    if not lake_uri():
        raise LakeUnavailable("LAKE_URI is not set")
    try:
        return _connect().execute(sql, params).fetchall()
    except LakeUnavailable:
        raise
    except Exception as e:
        msg = str(e)
        # No files yet for the range is a normal, empty answer.
        if "No files found" in msg or "does not exist" in msg:
            return []
        logger.warning("Lake query failed: %s", msg[:300])
        reset_connection()
        raise LakeUnavailable("The data lake could not be read") from e


# ---- Song-level questions --------------------------------------------------------------


def song_audience(song_id: str, start: Optional[date], end: date) -> Dict[str, Any]:
    """Unique listeners, returning listeners (also listened before the range) and plays per listener."""

    def compute():
        plays = _plays_source(start, end)
        rows = _run(
            f"SELECT count(*) AS plays, count(DISTINCT user_id) AS listeners FROM {plays} WHERE song_id = ?",
            [song_id],
        )
        total_plays, listeners = rows[0] if rows else (0, 0)
        returning = 0
        if start is not None and listeners:
            before = _plays_source(None, end)
            r = _run(
                f"""SELECT count(DISTINCT p.user_id) FROM {plays} p
                     WHERE p.song_id = ? AND EXISTS (
                       SELECT 1 FROM {before} b WHERE b.song_id = p.song_id AND b.user_id = p.user_id
                         AND b.dt < ?)""",
                [song_id, start],
            )
            returning = r[0][0] if r else 0
        return {
            "plays": int(total_plays or 0),
            "listeners": int(listeners or 0),
            "returningListeners": int(returning or 0),
            "playsPerListener": round((total_plays or 0) / listeners, 2) if listeners else 0,
        }

    return _cached({"q": "audience", "song": song_id, "start": start, "end": end}, compute)


def song_when_listened(song_id: str, start: Optional[date], end: date) -> List[Dict[str, int]]:
    """Plays by weekday (0 = Monday) and hour of day, UTC."""

    def compute():
        plays = _plays_source(start, end)
        rows = _run(
            f"""SELECT isodow(to_timestamp(occurred_at / 1000)) - 1 AS dow,
                       hour(to_timestamp(occurred_at / 1000)) AS hr, count(*)
                  FROM {plays} WHERE song_id = ? GROUP BY 1, 2 ORDER BY 1, 2""",
            [song_id],
        )
        return [{"weekday": int(d), "hour": int(h), "plays": int(n)} for d, h, n in rows]

    return _cached({"q": "when", "song": song_id, "start": start, "end": end}, compute)


def song_platforms(song_id: str, start: Optional[date], end: date) -> List[Dict[str, Any]]:
    def compute():
        plays = _plays_source(start, end)
        rows = _run(
            f"""SELECT coalesce(platform, 'unknown') AS platform, count(*) AS plays,
                       avg(listened_ratio) AS avg_ratio
                  FROM {plays} WHERE song_id = ? GROUP BY 1 ORDER BY 2 DESC""",
            [song_id],
        )
        return [{"platform": p, "plays": int(n), "avgListened": round(float(r or 0), 4)} for p, n, r in rows]

    return _cached({"q": "platforms", "song": song_id, "start": start, "end": end}, compute)


# ---- Catalogue-level questions -----------------------------------------------------------


def daily_audience(start: Optional[date], end: date) -> List[Dict[str, Any]]:
    """Plays and unique listeners per day across the catalogue."""

    def compute():
        plays = _plays_source(start, end)
        rows = _run(f"SELECT dt, count(*), count(DISTINCT user_id) FROM {plays} GROUP BY 1 ORDER BY 1", [])
        return [{"day": str(d), "plays": int(n), "listeners": int(u)} for d, n, u in rows]

    return _cached({"q": "daily-audience", "start": start, "end": end}, compute)


def skipped_intros(start: Optional[date], end: date, limit: int = 10, min_plays: int = 20) -> List[Dict[str, Any]]:
    """Songs most often abandoned in their first 30 seconds."""

    def compute():
        plays = _plays_source(start, end)
        rows = _run(
            f"""SELECT song_id, count(*) AS plays,
                       sum(CASE WHEN coalesce(exit_ms, listened_ratio * coalesce(duration_ms, 180000)) < 30000
                                THEN 1 ELSE 0 END) AS early_exits
                  FROM {plays} GROUP BY 1 HAVING count(*) >= ?
                 ORDER BY early_exits * 1.0 / count(*) DESC LIMIT ?""",
            [min_plays, limit],
        )
        return [
            {"songId": s, "plays": int(n), "earlyExits": int(e), "earlyExitRate": round(e / n, 4) if n else 0}
            for s, n, e in rows
        ]

    return _cached({"q": "skipped-intros", "start": start, "end": end, "limit": limit}, compute)


def weekly_retention(weeks: int = 8) -> List[Dict[str, Any]]:
    """Listener cohorts by first listening week: share still listening in each following week."""

    def compute():
        end = date.today()
        start = end - timedelta(weeks=weeks)
        plays = _plays_source(start, end)
        rows = _run(
            f"""WITH w AS (SELECT user_id, date_trunc('week', to_timestamp(occurred_at / 1000))::DATE AS wk
                             FROM {plays} GROUP BY 1, 2),
                     first AS (SELECT user_id, min(wk) AS cohort FROM w GROUP BY 1)
                SELECT f.cohort, datediff('week', f.cohort, w.wk) AS n, count(DISTINCT w.user_id)
                  FROM w JOIN first f USING (user_id)
                 GROUP BY 1, 2 ORDER BY 1, 2""",
            [],
        )
        cohorts: Dict[str, Dict[str, Any]] = {}
        for cohort, n, users in rows:
            c = cohorts.setdefault(str(cohort), {"cohort": str(cohort), "size": 0, "weeks": []})
            if int(n) == 0:
                c["size"] = int(users)
            c["weeks"].append({"week": int(n), "listeners": int(users)})
        for c in cohorts.values():
            size = c["size"] or 1
            for w in c["weeks"]:
                w["rate"] = round(w["listeners"] / size, 4)
        return list(cohorts.values())

    return _cached({"q": "retention", "weeks": weeks, "day": date.today()}, compute)
