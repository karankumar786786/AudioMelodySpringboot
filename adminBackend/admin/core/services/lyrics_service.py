"""Search indexing ke liye lyrics laana aur saaf karna.

Lyrics Postgres me nahi rakhte. coreEngine ka LyricsApiService unhe LRCLIB se maang pe laata hai aur LyricsDto JSON
Redis me ``lyrics:<songId>`` pe cache karta hai. Indexing ke liye pehle wahi cache padhte hain, cache khaali ho tabhi
LRCLIB ``/api/get/<lrclibId>`` pe jaate hain.

Algolia me plain text (timestamps hata ke) jaata hai, ek byte budget tak kaat ke, taaki poora song record Algolia ki
per-record limit (free plan pe 10KB; baaki record ~1.5-2KB) ke andar rahe.
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

# [00:12.34] / [00:12:34] / [00:12] / [1:02.345] jaise line timestamps
_LINE_TS = re.compile(r"\[\d{1,3}:\d{1,2}(?:[.:]\d{1,3})?\]")
# <00:12.34> enhanced-LRC ke word timestamps
_WORD_TS = re.compile(r"<\d{1,3}:\d{1,2}(?:[.:]\d{1,3})?>")
# [ar:Artist] / [ti:Title] / [offset:+200] / [length: 3:20] jaisi metadata lines
_META_LINE = re.compile(r"^\s*\[[a-zA-Z#]+\s*:[^\]]*\]\s*$")


def strip_lrc_timestamps(text: Optional[str]) -> str:
    """LRC ke line/word timestamps aur metadata tags hatao, khaali lines kam karo."""
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
    """Max ``max_bytes`` UTF-8 bytes tak kaato, kisi character ko beech se tode bina; budget ke andar aakhri
    line break / space pe kaatna pasand karta hai.
    """
    if not text:
        return ""
    encoded = text.encode("utf-8")
    if len(encoded) <= max_bytes:
        return text
    cut = encoded[: max(0, max_bytes)].decode("utf-8", errors="ignore")
    boundary = max(cut.rfind("\n"), cut.rfind(" "))
    # Word boundary pe tabhi kaato jab zyada text na chhootta ho.
    if boundary >= len(cut) * 0.8:
        cut = cut[:boundary]
    return cut.rstrip()


def to_searchable_lyrics(
    plain: Optional[str],
    synced: Optional[str] = None,
    max_bytes: Optional[int] = None,
) -> Optional[str]:
    """Algolia ke liye plain lyrics (ya synced lyrics se timestamps hata ke), kaat ke; khaali ho to None."""
    budget = max_bytes if max_bytes is not None else lyrics_max_bytes()
    text = strip_lrc_timestamps(plain) or strip_lrc_timestamps(synced)
    text = truncate_utf8(text, budget)
    return text or None


def lyrics_max_bytes() -> int:
    """Algolia me lyrics ki max size (bytes), settings se."""
    try:
        return int(getattr(settings, "ALGOLIA_LYRICS_MAX_BYTES", DEFAULT_MAX_BYTES))
    except (TypeError, ValueError):
        return DEFAULT_MAX_BYTES


def has_lrclib_id(lrclib_id: Any) -> bool:
    """lrclib id sach me hai? (khaali ya "0" nahi)"""
    val = str(lrclib_id or "").strip()
    return bool(val) and val != "0"


class LyricsService:
    """Lyrics laane wali service: pehle Redis (core API ka cache), phir LRCLIB."""
    @classmethod
    def _from_payload(cls, payload: Dict[str, Any]) -> Optional[str]:
        """LyricsDto JSON se searchable lyrics."""
        if not isinstance(payload, dict) or payload.get("instrumental"):
            return None
        return to_searchable_lyrics(payload.get("plainLyrics"), payload.get("syncedLyrics"))

    @classmethod
    def _from_redis(cls, song_ids: Iterable[str]) -> Dict[str, Optional[str]]:
        """Redis cache se lyrics."""
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
            # coreEngine khaali result 6 ghante cache karta hai; use "nahi mila" maano taaki LRCLIB dobara try ho.
            if payload.get("plainLyrics") or payload.get("syncedLyrics") or payload.get("instrumental"):
                found[s_id] = cls._from_payload(payload)
        return found

    @classmethod
    def _from_lrclib(cls, lrclib_id: Any) -> Optional[str]:
        """LRCLIB API se lyrics."""
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
        """Ek song ke searchable lyrics (ya None)."""
        return cls.get_many({song_id or "": lrclib_id}).get(song_id or "")

    @classmethod
    def get_many(cls, lrclib_by_song_id: Dict[str, Any], max_workers: int = 8) -> Dict[str, Optional[str]]:
        """{song_id: searchable lyrics ya None} lautata hai. Kabhi error nahi phenkta."""
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
