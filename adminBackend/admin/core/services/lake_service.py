"""S3 data lake pe DuckDB queries (raw listening events Parquet files me, infra/lake/README.md dekho).
Har query sirf zaroori dino ke folders padhti hai, event_id se duplicate hatati hai (writer "at least once" hai),
aur result Redis me 10 minute cache hota hai - taaki dashboard har page view pe S3 dobara scan na kare.

Settings:
  LAKE_URI            s3://<bucket>/lake (tests me local folder)
  LAKE_S3_ENDPOINT    S3 jaisa local store ho to host:port; AWS ke liye khaali
  LAKE_S3_URL_STYLE   local stores ke liye "path", AWS ke liye "vhost"
  DUCKDB_EXTENSION_DIRECTORY  image me httpfs/postgres extensions kahan install hain
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
    """Lake set nahi hai ya padh nahi paaye; caller "not available" dikhata hai."""


def _settings(name: str, default: str = "") -> str:
    """Lake ki settings (LAKE_URI, endpoint, url style...)."""
    return str(getattr(settings, name, default) or default)


def lake_uri() -> str:
    """Lake ka base URI; set nahi to LakeUnavailable."""
    return _settings("LAKE_URI").rstrip("/")


def _connect():
    """Har thread ka apna DuckDB connection (Gunicorn threads aur kuch share nahi karte)."""
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
            # Pehle EC2 instance role: container ki static AWS keys (media buckets ke liye)
            # ko lake bucket ki permission nahi hai.
            conn.execute(
                "CREATE OR REPLACE SECRET lake (TYPE s3, PROVIDER credential_chain, CHAIN ?, REGION ?)",
                [_settings("LAKE_CREDENTIAL_CHAIN", "instance;env;config"), _settings("AWS_REGION", "ap-south-1")],
            )
    _local.conn = conn
    return conn


def reset_connection() -> None:
    """Is thread ka DuckDB connection band karo (tests / settings badalne pe)."""
    conn = getattr(_local, "conn", None)
    if conn is not None:
        conn.close()
    _local.conn = None


def topic_glob(topic: str) -> str:
    """Ek topic ki saari Parquet files ka glob pattern."""
    return f"{lake_uri()}/events/topic={topic}/*/*.parquet"


def _cached(key_parts: Dict[str, Any], compute: Callable[[], Any]) -> Any:
    """Result Redis me 10 minute cache karo (key = query + params ka hash)."""
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
    """Range ke plays, duplicates hata ke, SQL relation ki tarah.

    Topic pe ek glob + dt (date) folder pe filter: DuckDB baaki dino ki files chhod deta hai (partition pruning),
    aur jin dino ki file nahi wo bas kuch add nahi karte.
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
    """DuckDB pe query chalao aur rows (dicts) lautao."""
    if not lake_uri():
        raise LakeUnavailable("LAKE_URI is not set")
    try:
        return _connect().execute(sql, params).fetchall()
    except LakeUnavailable:
        raise
    except Exception as e:
        msg = str(e)
        # Range ke liye abhi files nahi hain - ye normal hai, khaali jawab.
        if "No files found" in msg or "does not exist" in msg:
            return []
        logger.warning("Lake query failed: %s", msg[:300])
        reset_connection()
        raise LakeUnavailable("The data lake could not be read") from e


# ---- Ek song ke sawaal ---------------------------------------------------------------------


def song_audience(song_id: str, start: Optional[date], end: date) -> Dict[str, Any]:
    """Unique listeners, returning listeners (range se pehle bhi sun chuke) aur har listener ke plays."""

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
    """Hafte ke din (0 = Monday) aur ghante ke hisaab se plays, UTC."""

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
    """Song ke plays platform ke hisaab se (ios / android / web)."""
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


# ---- Poore catalog ke sawaal ----------------------------------------------------------------


def daily_audience(start: Optional[date], end: date) -> List[Dict[str, Any]]:
    """Poore catalog ke har din ke plays aur unique listeners."""

    def compute():
        plays = _plays_source(start, end)
        rows = _run(f"SELECT dt, count(*), count(DISTINCT user_id) FROM {plays} GROUP BY 1 ORDER BY 1", [])
        return [{"day": str(d), "plays": int(n), "listeners": int(u)} for d, n, u in rows]

    return _cached({"q": "daily-audience", "start": start, "end": end}, compute)


def skipped_intros(start: Optional[date], end: date, limit: int = 10, min_plays: int = 20) -> List[Dict[str, Any]]:
    """Wo gaane jo sabse zyada pehle 30 second me chhode gaye."""

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
    """Listener cohorts (pehli baar sunne ka hafta): aage ke har hafte kitne % log abhi bhi sun rahe hain."""

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
