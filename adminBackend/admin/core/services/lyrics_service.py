"""
Lyrics lookup + normalisation for search indexing.

Lyrics text is not stored in Postgres. coreEngine's LyricsApiService fetches it
from LRCLIB on demand and caches the LyricsDto JSON in Redis under
``lyrics:<songId>``. For indexing we read that cache first and only fall back to
LRCLIB ``/api/get/<lrclibId>`` when it is cold.

The text stored in Algolia is plain (timestamps stripped) and truncated to a
byte budget so the whole song record stays under Algolia's per-record limit
(10KB on the Build/free plan; the rest of a song record is ~1.5-2KB).
"""
import json
import logging
import re
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Dict, Iterable, Optional

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

REDIS_PREFIX = "lyrics:"
LRCLIB_BASE_URL = "https://lrclib.net/api"
USER_AGENT = "AudioMelody/1.0 (https://audiomelody.me)"
DEFAULT_MAX_BYTES = 6000

# [00:12.34] / [00:12:34] / [00:12] / [1:02.345] line timestamps
_LINE_TS = re.compile(r"\[\d{1,3}:\d{1,2}(?:[.:]\d{1,3})?\]")
# <00:12.34> enhanced-LRC word timestamps
_WORD_TS = re.compile(r"<\d{1,3}:\d{1,2}(?:[.:]\d{1,3})?>")
# [ar:Artist] / [ti:Title] / [offset:+200] / [length: 3:20] metadata lines
_META_LINE = re.compile(r"^\s*\[[a-zA-Z#]+\s*:[^\]]*\]\s*$")


def strip_lrc_timestamps(text: Optional[str]) -> str:
    """Removes LRC line/word timestamps and metadata tags, collapsing blank lines."""
    if not text:
        return ""
    lines = []
    for raw in str(text).replace("\r\n", "\n").replace("\r", "\n").split("\n"):
        if _META_LINE.match(raw):
            continue
        line = _WORD_TS.sub("", _LINE_TS.sub("", raw))
        line = re.sub(r"[ \t]+", " ", line).strip()
        if line:
            lines.append(line)
    return "\n".join(lines)


def truncate_utf8(text: Optional[str], max_bytes: int = DEFAULT_MAX_BYTES) -> str:
    """Truncates to at most ``max_bytes`` UTF-8 bytes without splitting a character,
    preferring to cut at the last line break / space inside the budget."""
    if not text:
        return ""
    encoded = text.encode("utf-8")
    if len(encoded) <= max_bytes:
        return text
    cut = encoded[: max(0, max_bytes)].decode("utf-8", errors="ignore")
    boundary = max(cut.rfind("\n"), cut.rfind(" "))
    # Only back off to a word boundary if it doesn't throw away too much text.
    if boundary >= len(cut) * 0.8:
        cut = cut[:boundary]
    return cut.rstrip()


def to_searchable_lyrics(
    plain: Optional[str],
    synced: Optional[str] = None,
    max_bytes: Optional[int] = None,
) -> Optional[str]:
    """Plain lyrics (or stripped synced lyrics) truncated for Algolia; None when empty."""
    budget = max_bytes if max_bytes is not None else lyrics_max_bytes()
    text = strip_lrc_timestamps(plain) or strip_lrc_timestamps(synced)
    text = truncate_utf8(text, budget)
    return text or None


def lyrics_max_bytes() -> int:
    try:
        return int(getattr(settings, "ALGOLIA_LYRICS_MAX_BYTES", DEFAULT_MAX_BYTES))
    except (TypeError, ValueError):
        return DEFAULT_MAX_BYTES


def has_lrclib_id(lrclib_id: Any) -> bool:
    val = str(lrclib_id or "").strip()
    return bool(val) and val != "0"


class LyricsService:
    @classmethod
    def _from_payload(cls, payload: Dict[str, Any]) -> Optional[str]:
        if not isinstance(payload, dict) or payload.get("instrumental"):
            return None
        return to_searchable_lyrics(payload.get("plainLyrics"), payload.get("syncedLyrics"))

    @classmethod
    def _from_redis(cls, song_ids: Iterable[str]) -> Dict[str, Optional[str]]:
        ids = [s for s in song_ids if s]
        if not ids:
            return {}
        try:
            from .redis_service import RedisService
            values = RedisService.get_client().mget([REDIS_PREFIX + s for s in ids])
        except Exception as e:
            logger.debug("Lyrics Redis lookup failed: %s", e)
            return {}
        found: Dict[str, Optional[str]] = {}
        for s_id, raw in zip(ids, values or []):
            if not raw:
                continue
            try:
                payload = json.loads(raw)
            except (TypeError, ValueError):
                continue
            # coreEngine caches empty results for 6h; treat them as a miss so LRCLIB is retried.
            if payload.get("plainLyrics") or payload.get("syncedLyrics") or payload.get("instrumental"):
                found[s_id] = cls._from_payload(payload)
        return found

    @classmethod
    def _from_lrclib(cls, lrclib_id: Any) -> Optional[str]:
        if not has_lrclib_id(lrclib_id):
            return None
        try:
            resp = requests.get(
                f"{LRCLIB_BASE_URL}/get/{str(lrclib_id).strip()}",
                headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
                timeout=4,
            )
            if resp.status_code == 200:
                return cls._from_payload(resp.json())
        except Exception as e:
            logger.debug("LRCLIB lookup failed for id [%s]: %s", lrclib_id, e)
        return None

    @classmethod
    def get_lyrics(cls, song_id: Optional[str], lrclib_id: Any = None) -> Optional[str]:
        return cls.get_many({song_id or "": lrclib_id}).get(song_id or "")

    @classmethod
    def get_many(cls, lrclib_by_song_id: Dict[str, Any], max_workers: int = 8) -> Dict[str, Optional[str]]:
        """Returns {song_id: searchable lyrics or None}. Never raises."""
        result: Dict[str, Optional[str]] = {s: None for s in lrclib_by_song_id if s}
        cached = cls._from_redis(result.keys())
        result.update(cached)

        misses = [(s, lrclib_by_song_id[s]) for s in result if s not in cached and has_lrclib_id(lrclib_by_song_id[s])]
        if misses:
            try:
                with ThreadPoolExecutor(max_workers=max_workers) as pool:
                    for (s_id, _), text in zip(misses, pool.map(lambda m: cls._from_lrclib(m[1]), misses)):
                        result[s_id] = text
            except Exception as e:
                logger.warning("Bulk LRCLIB lookup failed: %s", e)
        return result
