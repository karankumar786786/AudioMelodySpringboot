"""
Transactional outbox for the admin API (see migration V16__add_event_outbox.sql).

Django writes plain-JSON rows into the same ``outbox_events`` table the core API uses;
outboxRelay (streams/) adds EventMeta, converts each row to the topic's Avro schema and
publishes it. Django therefore needs no Kafka or Avro code. After commit it nudges the
relay through Redpanda's HTTP proxy (best effort), so nothing has to poll Postgres.

EVENTS_MODE: LEGACY (default, nothing is written) | DUAL | KAFKA, same as the core API.
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
    return str(getattr(settings, "EVENTS_MODE", "LEGACY")).upper() in ("DUAL", "KAFKA")


def address_key(email: str) -> str:
    """Kafka key for email events: a hash, so addresses never appear in topic keys."""
    return hashlib.sha256(email.strip().lower().encode("utf-8")).hexdigest()


def _uuid7() -> uuid.UUID:
    import os
    import time

    ms = int(time.time() * 1000) & ((1 << 48) - 1)
    rand = int.from_bytes(os.urandom(10), "big")
    value = (ms << 80) | (0x7 << 76) | ((rand >> 64) & 0xFFF) << 64 | (0b10 << 62) | (rand & ((1 << 62) - 1))
    return uuid.UUID(int=value)


class OutboxService:
    @staticmethod
    def write(topic: str, key: str, payload: Dict[str, Any]) -> uuid.UUID:
        """Insert one row in the current transaction (or autocommit) and wake the relay after commit."""
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
        except Exception as e:  # best effort: the relay's safety sweep picks the row up later
            logger.debug("Outbox wake-up not delivered: %s", e)

    @staticmethod
    def claim_unsent(row_id: uuid.UUID) -> bool:
        """Mark a row as handled elsewhere. True only if it was still unsent (so it's never sent twice)."""
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
        """
        Queue one email. ``fallback`` runs if the relay hasn't published it within
        ``fallback_after`` seconds (default EVENTS_OTP_FALLBACK_SECONDS), so an admin
        login code never waits on a broken pipeline.
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
