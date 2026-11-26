"""Admin API ka transactional outbox (migration V16__add_event_outbox.sql dekho).

Django wahi ``outbox_events`` table me simple JSON rows likhta hai jo core API use karta hai;
streams/ ka outboxRelay EventMeta jodta hai, row ko topic ke Avro schema me badalta hai aur publish karta hai.
Isliye Django ko Kafka ya Avro code nahi chahiye. Commit ke baad Redpanda ke HTTP proxy se relay ko
"jaago" signal bhejta hai (koshish bhar), taaki kisi ko Postgres poll na karna pade.

EVENTS_MODE: LEGACY (default, kuch nahi likhta) | DUAL | KAFKA - core API jaisa.
"""

import hashlib
import json
import logging
import threading
import uuid
from typing import Any, Dict, Optional

import requests
from django.conf import settings
from django.db import connection, transaction

logger = logging.getLogger(__name__)

TOPIC_EMAIL = "notification.email.v1"
TOPIC_CATALOG_SONG = "catalog.song.v1"
TOPIC_OUTBOX_WAKEUP = "outbox.wakeup.v1"
SOURCE = "admin-api"


def events_enabled() -> bool:
    """EVENTS_MODE DUAL ya KAFKA hai? (tabhi outbox likhna hai)"""
    return str(getattr(settings, "EVENTS_MODE", "LEGACY")).upper() in ("DUAL", "KAFKA")


def address_key(email: str) -> str:
    """Email events ki Kafka key: email ka hash, taaki address topic keys me na dikhe."""
    return hashlib.sha256(email.strip().lower().encode("utf-8")).hexdigest()


def _uuid7() -> uuid.UUID:
    """UUID v7 banao (time ke order wala id)."""
    import os
    import time

    ms = int(time.time() * 1000) & ((1 << 48) - 1)
    rand = int.from_bytes(os.urandom(10), "big")
    value = (ms << 80) | (0x7 << 76) | ((rand >> 64) & 0xFFF) << 64 | (0b10 << 62) | (rand & ((1 << 62) - 1))
    return uuid.UUID(int=value)


class OutboxService:
    """Outbox me rows likhne wali service."""
    @staticmethod
    def write(topic: str, key: str, payload: Dict[str, Any]) -> uuid.UUID:
        """Current transaction me ek row likho (ya autocommit) aur commit ke baad relay ko jagao."""
        row_id = _uuid7()
        with connection.cursor() as cursor:
            cursor.execute(
                "INSERT INTO outbox_events (id, topic, msg_key, payload, source) "
                "VALUES (%s, %s, %s, CAST(%s AS jsonb), %s)",
                [str(row_id), topic, key, json.dumps(payload), SOURCE],
            )
        transaction.on_commit(OutboxService.wake)
        return row_id

    @staticmethod
    def wake() -> None:
        """Relay ko Redpanda HTTP proxy se "jaago" message (fail ho to koi baat nahi)."""
        url = getattr(settings, "KAFKA_REST_PROXY_URL", "")
        if not url:
            return
        try:
            requests.post(
                f"{url.rstrip('/')}/topics/{TOPIC_OUTBOX_WAKEUP}",
                data=json.dumps({"records": [{"key": SOURCE, "value": "1"}]}),
                headers={"Content-Type": "application/vnd.kafka.json.v2+json"},
                timeout=2,
            )
        except Exception as e:  # koshish bhar: na pahunche to relay ka safety sweep row baad me utha lega
            logger.debug("Outbox wake-up not delivered: %s", e)

    @staticmethod
    def claim_unsent(row_id: uuid.UUID) -> bool:
        """Row ko "kahin aur se bhej diya" mark karo. True sirf tab jab wo abhi tak unsent thi (do baar kabhi nahi jaati)."""
        with connection.cursor() as cursor:
            cursor.execute(
                "UPDATE outbox_events SET sent_at = now(), payload = '{}'::jsonb, "
                "last_error = 'sent through the Redis mail queue fallback' "
                "WHERE id = %s AND sent_at IS NULL",
                [str(row_id)],
            )
            return cursor.rowcount == 1

    @staticmethod
    def write_email(to: str, kind: str, subject: str, body: str, fallback=None, fallback_after: Optional[float] = None) -> uuid.UUID:
        """Ek email line me lagao. Relay ``fallback_after`` second (default EVENTS_OTP_FALLBACK_SECONDS) me publish
        na kare to ``fallback`` chalta hai - admin ka login code kabhi tooti pipeline ka wait nahi karta.
        """
        row_id = OutboxService.write(
            TOPIC_EMAIL,
            address_key(to),
            {"to": to, "kind": kind, "subject": subject, "body": body, "attempt": 0},
        )
        if fallback is not None:
            delay = fallback_after if fallback_after is not None else float(getattr(settings, "EVENTS_OTP_FALLBACK_SECONDS", 30))

            def _check():
                try:
                    if OutboxService.claim_unsent(row_id):
                        logger.warning("Email %s not published within %ss; using the Redis mail queue", row_id, delay)
                        fallback()
                except Exception as e:
                    logger.error("Email fallback for %s failed: %s", row_id, e)
                finally:
                    connection.close()

            timer = threading.Timer(delay, _check)
            timer.daemon = True
            timer.start()
        return row_id

    @staticmethod
    def write_song_changed(song, change: str) -> Optional[uuid.UUID]:
        """Song badla (publish/update/delete) -> catalog.song.v1 ka outbox row."""
        artist_ids = []
        try:
            from catalog.models import Artist

            names = [n.strip() for n in (song.artist_name or "").replace("&", ",").split(",") if n.strip()]
            if names:
                artist_ids = list(Artist.objects.filter(name__in=names).values_list("id", flat=True))
        except Exception:
            artist_ids = []
        return OutboxService.write(
            TOPIC_CATALOG_SONG,
            str(song.id),
            {
                "song_id": str(song.id),
                "change": change,
                "title": song.title,
                "artist_name": song.artist_name,
                "artist_ids": [str(a) for a in artist_ids],
                "status": song.status,
            },
        )
