"""
Listening analytics for the admin dashboard.

Instant numbers come from the small tables the streams `analytics` profile keeps up to
date (song_timeline, song_listen_daily, song_quality_daily: V19). Questions those can't
answer (unique and returning listeners, when people listen, retention cohorts) go to the
S3 data lake through DuckDB (core/services/lake_service.py). When the aggregates are
still empty (events not flowing yet) plays and completion fall back to user_history.

GET admin/song/<id>/analytics?range=7d|30d|90d|all
GET admin/analytics/overview?range=7d|30d|90d|all
"""

import logging
from datetime import date, timedelta
from typing import Any, Dict, List, Optional, Tuple

from django.db import DatabaseError, connection
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.response import Response

from core.services import lake_service
from core.views import BaseAdminView

from .models import Song

logger = logging.getLogger(__name__)

RANGES = {"7d": 7, "30d": 30, "90d": 90, "all": None}
COMPLETION_PART = 90  # user_history.part is 0-100
HOOK_WINDOW_SEC = 10


# ---- helpers ---------------------------------------------------------------------------


def parse_range(value: Optional[str]) -> Tuple[str, Optional[date], date, Optional[date], Optional[date]]:
    """(label, start, end, prev_start, prev_end); start is None for 'all'."""
    label = value if value in RANGES else "30d"
    end = date.today()
    days = RANGES[label]
    if days is None:
        return label, None, end, None, None
    start = end - timedelta(days=days - 1)
    prev_end = start - timedelta(days=1)
    prev_start = prev_end - timedelta(days=days - 1)
    return label, start, end, prev_start, prev_end


def _rows(sql: str, params: List[Any]) -> List[tuple]:
    try:
        with connection.cursor() as cur:
            cur.execute(sql, params)
            return cur.fetchall()
    except DatabaseError as e:
        # A missing V19 table (migration not applied yet) shouldn't break the page.
        logger.warning("Analytics query failed: %s", str(e)[:200])
        return []


def _one(sql: str, params: List[Any]) -> tuple:
    rows = _rows(sql, params)
    return rows[0] if rows else ()


def _n(v: Any) -> int:
    return int(v or 0)


def _ratio(a: Any, b: Any) -> float:
    return round(float(a or 0) / float(b), 4) if b else 0.0


def _day_filter(column: str, start: Optional[date], end: Optional[date]) -> Tuple[str, List[Any]]:
    clauses, params = [], []
    if start is not None:
        clauses.append(f"{column} >= %s")
        params.append(start.isoformat())
    if end is not None:
        clauses.append(f"{column} < %s")
        params.append((end + timedelta(days=1)).isoformat())
    return (" AND " + " AND ".join(clauses)) if clauses else "", params


def _change(current: float, previous: Optional[float]) -> Optional[float]:
    if previous is None:
        return None
    if not previous:
        return None if not current else 1.0
    return round((current - previous) / previous, 4)


def _lake(fn, *args) -> Tuple[Any, Optional[str]]:
    try:
        return fn(*args), None
    except lake_service.LakeUnavailable as e:
        return None, str(e)


# ---- period totals ---------------------------------------------------------------------


def _aggregate_totals(song_id: Optional[str], start: Optional[date], end: Optional[date]) -> Dict[str, int]:
    where, params = _day_filter("day", start, end)
    song_clause = ""
    if song_id:
        song_clause = " AND song_id = %s"
        params = params + [song_id]
    row = _one(
        "SELECT COALESCE(SUM(plays),0), COALESCE(SUM(qualified_streams),0), COALESCE(SUM(completions),0), "
        "COALESCE(SUM(skips),0), COALESCE(SUM(listened_ms),0) FROM song_listen_daily WHERE 1=1"
        + where + song_clause,
        params,
    )
    plays, qualified, completions, skips, listened = (row or (0, 0, 0, 0, 0))
    return {
        "plays": _n(plays),
        "qualifiedStreams": _n(qualified),
        "completions": _n(completions),
        "skips": _n(skips),
        "listenedMs": _n(listened),
    }


def _history_totals(song_id: Optional[str], start: Optional[date], end: Optional[date]) -> Dict[str, Any]:
    where, params = _day_filter("listened_at", start, end)
    song_clause = ""
    if song_id:
        song_clause = " AND song_id = %s"
        params = params + [song_id]
    row = _one(
        "SELECT COUNT(*), COUNT(DISTINCT user_id), "
        f"SUM(CASE WHEN part >= {COMPLETION_PART} THEN 1 ELSE 0 END), AVG(part) "
        "FROM user_history WHERE 1=1" + where + song_clause,
        params,
    )
    plays, listeners, completions, avg_part = (row or (0, 0, 0, None))
    return {
        "plays": _n(plays),
        "listeners": _n(listeners),
        "completions": _n(completions),
        "avgListened": round(float(avg_part) / 100, 4) if avg_part is not None else 0.0,
    }


def _period(song_id: Optional[str], start: Optional[date], end: Optional[date]) -> Dict[str, Any]:
    agg = _aggregate_totals(song_id, start, end)
    hist = _history_totals(song_id, start, end)
    from_events = agg["plays"] > 0
    plays = agg["plays"] if from_events else hist["plays"]
    completions = agg["completions"] if from_events else hist["completions"]
    return {
        "source": "events" if from_events else "history",
        "plays": plays,
        "listeners": hist["listeners"],
        "qualifiedStreams": agg["qualifiedStreams"],
        "completions": completions,
        "completionRate": _ratio(completions, plays),
        "skips": agg["skips"],
        "skipRate": _ratio(agg["skips"], plays) if from_events else None,
        "avgListened": hist["avgListened"],
        "listenedHours": round(agg["listenedMs"] / 3_600_000, 2),
    }


def _kpis(song_id: Optional[str], start, end, prev_start, prev_end) -> Dict[str, Any]:
    current = _period(song_id, start, end)
    previous = _period(song_id, prev_start, prev_end) if start is not None else None
    changes = {}
    for key in ("plays", "listeners", "qualifiedStreams", "completions", "completionRate", "skips", "listenedHours"):
        prev_val = previous.get(key) if previous else None
        changes[key] = _change(current.get(key) or 0, prev_val)
    return {"current": current, "previous": previous, "change": changes}


def _daily(song_id: Optional[str], start: Optional[date], end: date) -> List[Dict[str, Any]]:
    where, params = _day_filter("day", start, end)
    song_clause = ""
    if song_id:
        song_clause = " AND song_id = %s"
        params = params + [song_id]
    rows = _rows(
        "SELECT day, SUM(plays), SUM(qualified_streams), SUM(completions), SUM(skips), SUM(listened_ms) "
        "FROM song_listen_daily WHERE 1=1" + where + song_clause + " GROUP BY day ORDER BY day",
        params,
    )
    if rows:
        return [
            {
                "day": str(d)[:10],
                "plays": _n(p),
                "qualifiedStreams": _n(q),
                "completions": _n(c),
                "skips": _n(s),
                "listenedHours": round(_n(ms) / 3_600_000, 3),
            }
            for d, p, q, c, s, ms in rows
        ]
    # Fallback: user_history (no skips or listening time there).
    where, params = _day_filter("listened_at", start, end)
    if song_id:
        where += " AND song_id = %s"
        params = params + [song_id]
    rows = _rows(
        "SELECT DATE(listened_at) AS d, COUNT(*), COUNT(DISTINCT user_id), "
        f"SUM(CASE WHEN part >= {COMPLETION_PART} THEN 1 ELSE 0 END) "
        "FROM user_history WHERE 1=1" + where + " GROUP BY DATE(listened_at) ORDER BY d",
        params,
    )
    return [
        {"day": str(d)[:10], "plays": _n(p), "listeners": _n(u), "completions": _n(c), "skips": None}
        for d, p, u, c in rows
    ]


# ---- timeline / heatmap ------------------------------------------------------------------


def build_timeline(rows: List[tuple], duration_sec: int) -> Dict[str, Any]:
    """Per-second series plus the derived retention curve and replay 'hooks'.

    rows: (sec, listens, exits, skips, seeks_away, seeks_into). Seconds with no row are 0.
    """
    by_sec = {int(r[0]): r for r in rows}
    last = max([duration_sec - 1] + list(by_sec.keys())) if (by_sec or duration_sec) else -1
    seconds = []
    for s in range(0, last + 1):
        r = by_sec.get(s)
        seconds.append(
            {
                "sec": s,
                "listens": _n(r[1]) if r else 0,
                "exits": _n(r[2]) if r else 0,
                "skips": _n(r[3]) if r else 0,
                "seeksAway": _n(r[4]) if r else 0,
                "seeksInto": _n(r[5]) if r else 0,
            }
        )
    starts = seconds[0]["listens"] if seconds else 0
    base = starts or max((x["listens"] for x in seconds), default=0)
    for x in seconds:
        x["retention"] = _ratio(x["listens"], base)

    # Replays: listening above the lowest level reached earlier means people came back
    # (seeked in or replayed). Windows with the most of it are the song's hooks.
    replay = []
    running_min = None
    for x in seconds:
        running_min = x["listens"] if running_min is None else min(running_min, x["listens"])
        replay.append(max(0, x["listens"] - running_min) + x["seeksInto"])
    hooks = []
    used = [False] * len(seconds)
    window = HOOK_WINDOW_SEC
    candidates = []
    for i in range(0, max(0, len(seconds) - window + 1)):
        candidates.append((sum(replay[i : i + window]), i))
    for score, i in sorted(candidates, reverse=True):
        if score <= 0 or len(hooks) >= 3:
            break
        if any(used[i : i + window]):
            continue
        for j in range(i, i + window):
            used[j] = True
        hooks.append({"startSec": i, "endSec": i + window, "score": int(score)})
    hooks.sort(key=lambda h: h["startSec"])

    total_exits = sum(x["exits"] for x in seconds)
    early_exits = sum(x["exits"] for x in seconds[:30])
    peak = max(seconds, key=lambda x: x["listens"]) if seconds else None
    return {
        "seconds": seconds,
        "hooks": hooks,
        "summary": {
            "trackedPlays": starts,
            "peakSec": peak["sec"] if peak and peak["listens"] else None,
            "earlyExitRate": _ratio(early_exits, total_exits),
            "totalSkips": sum(x["skips"] for x in seconds),
            "totalSeeks": sum(x["seeksAway"] for x in seconds),
        },
    }


def _timeline(song_id: str, duration_sec: int) -> Dict[str, Any]:
    rows = _rows(
        "SELECT sec, listens, exits, skips, seeks_away, seeks_into FROM song_timeline WHERE song_id = %s ORDER BY sec",
        [song_id],
    )
    if not rows:
        return {"seconds": [], "hooks": [], "summary": None}
    return build_timeline(rows, duration_sec)


# ---- delivery quality ------------------------------------------------------------------


def _quality(song_id: Optional[str], start: Optional[date], end: date) -> List[Dict[str, Any]]:
    where, params = _day_filter("day", start, end)
    if song_id:
        where += " AND song_id = %s"
        params = params + [song_id]
    rows = _rows(
        "SELECT quality, platform, SUM(plays), SUM(listened_ms), SUM(startup_ms_sum), SUM(startup_samples), "
        "SUM(rebuffer_count), SUM(rebuffer_ms) FROM song_quality_daily WHERE 1=1"
        + where
        + " GROUP BY quality, platform ORDER BY SUM(plays) DESC",
        params,
    )
    out = []
    for q, p, plays, listened, st_sum, st_n, rb_n, rb_ms in rows:
        listened = _n(listened)
        out.append(
            {
                "quality": q,
                "platform": p,
                "plays": _n(plays),
                "listenedHours": round(listened / 3_600_000, 2),
                "avgStartupMs": round(_n(st_sum) / _n(st_n)) if _n(st_n) else None,
                "rebuffersPerPlay": _ratio(rb_n, plays),
                "rebufferMsPerPlay": round(_n(rb_ms) / _n(plays)) if _n(plays) else 0,
                # Share of listening time spent stalled.
                "stallRatio": _ratio(rb_ms, listened + _n(rb_ms)),
            }
        )
    return out


def _engagement(song_id: str) -> Dict[str, int]:
    fav = _one("SELECT COUNT(*) FROM user_favourite_songs WHERE song_id = %s", [song_id])
    pl = _one("SELECT COUNT(*) FROM user_playlist_songs WHERE song_id = %s", [song_id])
    shorts = _one("SELECT COUNT(*) FROM shorts WHERE song_id = %s AND status = 'READY'", [song_id])
    return {
        "favourites": _n(fav[0] if fav else 0),
        "playlistAdds": _n(pl[0] if pl else 0),
        "shorts": _n(shorts[0] if shorts else 0),
    }


def _song_titles(ids: List[str]) -> Dict[str, Dict[str, str]]:
    if not ids:
        return {}
    try:
        return {
            s.id: {"title": s.title, "artistName": s.artist_name, "imageKey": s.image_key}
            for s in Song.objects.filter(id__in=ids).only("id", "title", "artist_name", "image_key")
        }
    except DatabaseError:
        return {}


# ---- views -------------------------------------------------------------------------------


class SongAnalyticsView(BaseAdminView):
    def get(self, request, pk):
        song = get_object_or_404(Song.objects.select_related("metadata"), pk=pk)
        label, start, end, prev_start, prev_end = parse_range(request.query_params.get("range"))
        duration_sec = int(song.duration or 0)
        total_streams = 0
        try:
            total_streams = int(song.metadata.total_streams)
        except Exception:
            pass

        audience, lake_error = _lake(lake_service.song_audience, song.id, start, end)
        when, _ = _lake(lake_service.song_when_listened, song.id, start, end) if not lake_error else (None, None)
        platforms, _ = _lake(lake_service.song_platforms, song.id, start, end) if not lake_error else (None, None)

        kpis = _kpis(song.id, start, end, prev_start, prev_end)
        if audience:
            kpis["current"]["listeners"] = audience["listeners"]
            kpis["current"]["returningListeners"] = audience["returningListeners"]
            kpis["current"]["playsPerListener"] = audience["playsPerListener"]

        return Response(
            {
                "song": {
                    "id": song.id,
                    "title": song.title,
                    "artistName": song.artist_name,
                    "duration": duration_sec,
                    "songKey": song.song_key,
                    "imageKey": song.image_key,
                    "status": song.status,
                    "totalStreams": total_streams,
                    "createdAt": song.created_at,
                },
                "range": {
                    "label": label,
                    "start": start.isoformat() if start else None,
                    "end": end.isoformat(),
                },
                "kpis": kpis,
                "engagement": _engagement(song.id),
                "daily": _daily(song.id, start, end),
                "timeline": _timeline(song.id, duration_sec),
                "quality": _quality(song.id, start, end),
                "lake": {
                    "available": lake_error is None,
                    "error": lake_error,
                    "audience": audience,
                    "whenListened": when or [],
                    "platforms": platforms or [],
                },
            },
            status=status.HTTP_200_OK,
        )


class AnalyticsOverviewView(BaseAdminView):
    def get(self, request):
        label, start, end, prev_start, prev_end = parse_range(request.query_params.get("range"))
        where, params = _day_filter("day", start, end)

        top = _rows(
            "SELECT song_id, SUM(plays) AS p, SUM(completions), SUM(skips), SUM(listened_ms) "
            "FROM song_listen_daily WHERE 1=1" + where + " GROUP BY song_id ORDER BY p DESC LIMIT 10",
            params,
        )
        top_completion = _rows(
            "SELECT song_id, SUM(plays) AS p, SUM(completions) AS c FROM song_listen_daily WHERE 1=1"
            + where
            + " GROUP BY song_id HAVING SUM(plays) >= 20 ORDER BY SUM(completions) * 1.0 / SUM(plays) DESC LIMIT 10",
            params,
        )
        if not top:
            hw, hp = _day_filter("listened_at", start, end)
            top = [
                (sid, p, c, None, None)
                for sid, p, c in _rows(
                    f"SELECT song_id, COUNT(*) AS p, SUM(CASE WHEN part >= {COMPLETION_PART} THEN 1 ELSE 0 END) "
                    "FROM user_history WHERE 1=1" + hw + " GROUP BY song_id ORDER BY p DESC LIMIT 10",
                    hp,
                )
            ]

        intros, lake_error = _lake(lake_service.skipped_intros, start, end)
        audience, _ = _lake(lake_service.daily_audience, start, end) if not lake_error else (None, None)
        cohorts, _ = _lake(lake_service.weekly_retention) if not lake_error else (None, None)

        ids = {r[0] for r in top} | {r[0] for r in top_completion} | {i["songId"] for i in (intros or [])}
        titles = _song_titles(list(ids))

        def with_title(sid: str) -> Dict[str, Any]:
            return {"songId": sid, **titles.get(sid, {"title": None, "artistName": None, "imageKey": None})}

        daily = _daily(None, start, end)
        if audience:
            listeners = {a["day"]: a["listeners"] for a in audience}
            for d in daily:
                if d["day"] in listeners:
                    d["listeners"] = listeners[d["day"]]

        quality_mix: Dict[str, Dict[str, Any]] = {}
        for row in _quality(None, start, end):
            q = quality_mix.setdefault(
                row["quality"], {"quality": row["quality"], "plays": 0, "_startup": 0.0, "_startupPlays": 0, "_rb": 0.0}
            )
            q["plays"] += row["plays"]
            if row["avgStartupMs"] is not None:
                q["_startup"] += row["avgStartupMs"] * row["plays"]
                q["_startupPlays"] += row["plays"]
            q["_rb"] += row["rebuffersPerPlay"] * row["plays"]
        mix = []
        for q in quality_mix.values():
            mix.append(
                {
                    "quality": q["quality"],
                    "plays": q["plays"],
                    "avgStartupMs": round(q["_startup"] / q["_startupPlays"]) if q["_startupPlays"] else None,
                    "rebuffersPerPlay": round(q["_rb"] / q["plays"], 4) if q["plays"] else 0,
                }
            )
        mix.sort(key=lambda m: -m["plays"])

        return Response(
            {
                "range": {"label": label, "start": start.isoformat() if start else None, "end": end.isoformat()},
                "kpis": _kpis(None, start, end, prev_start, prev_end),
                "daily": daily,
                "topSongs": [
                    {
                        **with_title(sid),
                        "plays": _n(p),
                        "completionRate": _ratio(c, p),
                        "skipRate": _ratio(s, p) if s is not None else None,
                        "listenedHours": round(_n(ms) / 3_600_000, 2) if ms is not None else None,
                    }
                    for sid, p, c, s, ms in top
                ],
                "topCompletion": [
                    {**with_title(sid), "plays": _n(p), "completionRate": _ratio(c, p)} for sid, p, c in top_completion
                ],
                "skippedIntros": [{**i, **with_title(i["songId"])} for i in (intros or [])],
                "qualityMix": mix,
                "retention": cohorts or [],
                "lake": {"available": lake_error is None, "error": lake_error},
            },
            status=status.HTTP_200_OK,
        )
