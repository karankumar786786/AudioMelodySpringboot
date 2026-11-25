"""
Shorts: standalone vertical videos with their own audio, optionally linked to a song.

The admin API owns a short's processing state. The media pipeline reports back through the
`webhook/short/<id>/processed|failed` endpoints, and admins moderate shorts here
(hide, unhide, delete, resolve reports, ban an account from posting). Listener uploads,
likes and reports are handled by the core API on the same tables.
"""

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from django.db import connection, transaction

logger = logging.getLogger(__name__)

RAW_PREFIX = "shorts-raw"
MAX_CAPTION = 300
ALLOWED_CONTENT_TYPES = {"video/mp4", "video/quicktime"}


class ShortError(Exception):
    """A request the admin can fix (bad state, bad input). Mapped to HTTP 400/409."""

    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.status_code = status_code


def new_raw_key(content_type: str = "video/mp4") -> str:
    ext = ".mov" if content_type == "video/quicktime" else ".mp4"
    return f"{RAW_PREFIX}/{uuid.uuid4()}{ext}"


def clean_caption(caption: Optional[str]) -> Optional[str]:
    if caption is None:
        return None
    text = " ".join(str(caption).split())
    if len(text) > MAX_CAPTION:
        raise ShortError(f"Caption can be at most {MAX_CAPTION} characters")
    return text or None


def serialize(short) -> Dict[str, Any]:
    return {
        "id": short.id,
        "ownerType": short.owner_type,
        "userId": short.user_id,
        "adminId": short.admin_id,
        "songId": short.song_id,
        "songTitle": getattr(short.song, "title", None) if short.song_id else None,
        "caption": short.caption,
        "status": short.status,
        "hlsKey": short.hls_key,
        "thumbnailKey": short.thumbnail_key,
        "durationMs": short.duration_ms,
        "width": short.width,
        "height": short.height,
        "likesCount": short.likes_count,
        "viewsCount": short.views_count,
        "reportsCount": short.reports_count,
        "failureReason": short.failure_reason,
        "hiddenReason": short.hidden_reason,
        "createdAt": short.created_at.isoformat() if short.created_at else None,
        "publishedAt": short.published_at.isoformat() if short.published_at else None,
    }


class ShortService:
    @staticmethod
    def _events():
        from core.services.inngest_service import InngestService

        return InngestService

    @staticmethod
    def _now() -> datetime:
        return datetime.now(timezone.utc)

    # ---- Admin uploads ----------------------------------------------------------------

    @classmethod
    def create_admin_short(cls, admin_id: str, raw_key: str, caption: Optional[str], song_id: Optional[str]):
        from catalog.models import Short, Song

        if not raw_key or not str(raw_key).startswith(f"{RAW_PREFIX}/"):
            raise ShortError("rawKey must come from the shorts upload URL")
        if song_id and not Song.objects.filter(id=song_id).exists():
            raise ShortError("Song not found", 404)
        short = Short.objects.create(
            id=str(uuid.uuid4()),
            owner_type="ADMIN",
            admin_id=admin_id,
            song_id=song_id or None,
            caption=clean_caption(caption),
            status="PROCESSING",
            raw_key=raw_key,
        )
        cls._events().send_event("shorts/process", {"shortId": short.id, "rawKey": raw_key}, event_id=f"short-{short.id}")
        return short

    # ---- Pipeline callbacks -----------------------------------------------------------

    @classmethod
    def mark_processed(cls, short_id: str, data: Dict[str, Any]):
        from catalog.models import Short

        with transaction.atomic():
            short = Short.objects.select_for_update().filter(id=short_id).first()
            if short is None:
                raise ShortError("Short not found", 404)
            if short.status in ("DELETED",):
                # Deleted while processing: don't resurrect it; clean up what was just written.
                cls._events().send_event("shorts/delete", {"shortId": short.id, "rawKey": short.raw_key})
                return short
            short.hls_key = data.get("hlsKey")
            short.thumbnail_key = data.get("thumbnailKey")
            short.duration_ms = data.get("durationMs")
            short.width = data.get("width")
            short.height = data.get("height")
            short.failure_reason = None
            if short.status != "HIDDEN":
                short.status = "READY"
            short.published_at = short.published_at or cls._now()
            short.save()
            return short

    @classmethod
    def mark_failed(cls, short_id: str, reason: Optional[str]):
        from catalog.models import Short

        short = Short.objects.filter(id=short_id).first()
        if short is None:
            raise ShortError("Short not found", 404)
        if short.status != "DELETED":
            short.status = "FAILED"
            short.failure_reason = (reason or "Processing failed")[:500]
            short.save(update_fields=["status", "failure_reason", "updated_at"])
        return short

    # ---- Moderation -------------------------------------------------------------------

    @classmethod
    def hide(cls, short_id: str, reason: Optional[str]):
        from catalog.models import Short

        short = Short.objects.filter(id=short_id).first()
        if short is None:
            raise ShortError("Short not found", 404)
        if short.status not in ("READY", "HIDDEN"):
            raise ShortError(f"Only published shorts can be hidden (status is {short.status})", 409)
        short.status = "HIDDEN"
        short.hidden_reason = (reason or "Hidden by an admin")[:300]
        short.save(update_fields=["status", "hidden_reason", "updated_at"])
        return short

    @classmethod
    def unhide(cls, short_id: str):
        from catalog.models import Short

        short = Short.objects.filter(id=short_id).first()
        if short is None:
            raise ShortError("Short not found", 404)
        if short.status != "HIDDEN":
            raise ShortError("Short is not hidden", 409)
        short.status = "READY" if short.hls_key else "FAILED"
        short.hidden_reason = None
        short.save(update_fields=["status", "hidden_reason", "updated_at"])
        # Reports that led to the hide are considered handled.
        short.reports.filter(resolved=False).update(resolved=True)
        return short

    @classmethod
    def delete(cls, short_id: str):
        from catalog.models import Short

        short = Short.objects.filter(id=short_id).first()
        if short is None:
            raise ShortError("Short not found", 404)
        if short.status in ("UPLOADING", "PROCESSING"):
            cls._events().send_event("shorts/cancel", {"shortId": short.id})
        short.status = "DELETED"
        short.save(update_fields=["status", "updated_at"])
        cls._events().send_event("shorts/delete", {"shortId": short.id, "rawKey": short.raw_key})
        return short

    @classmethod
    def update(cls, short_id: str, caption: Any = ..., song_id: Any = ...):
        from catalog.models import Short, Song

        short = Short.objects.filter(id=short_id).exclude(status="DELETED").first()
        if short is None:
            raise ShortError("Short not found", 404)
        fields = ["updated_at"]
        if caption is not ...:
            short.caption = clean_caption(caption)
            fields.append("caption")
        if song_id is not ...:
            if song_id and not Song.objects.filter(id=song_id).exists():
                raise ShortError("Song not found", 404)
            short.song_id = song_id or None
            fields.append("song")
        short.save(update_fields=fields)
        return short

    @classmethod
    def resolve_report(cls, report_id: int, action: str):
        from catalog.models import ShortReport

        report = ShortReport.objects.select_related("short").filter(id=report_id).first()
        if report is None:
            raise ShortError("Report not found", 404)
        if action == "hide":
            if report.short.status == "READY":
                cls.hide(report.short_id, f"Reported: {report.reason.lower()}")
            ShortReport.objects.filter(short_id=report.short_id, resolved=False).update(resolved=True)
        elif action == "dismiss":
            report.resolved = True
            report.save(update_fields=["resolved"])
        else:
            raise ShortError("action must be 'hide' or 'dismiss'")
        return report

    @staticmethod
    def ban_until(days: Optional[int]) -> Optional[datetime]:
        """None = lift the ban; 0 or negative = permanent (100 years)."""
        if days is None:
            return None
        if days <= 0:
            return datetime.now(timezone.utc) + timedelta(days=36500)
        return datetime.now(timezone.utc) + timedelta(days=days)

    @classmethod
    def set_ban(cls, user_id: str, days: Optional[int]) -> Optional[datetime]:
        until = cls.ban_until(days)
        with connection.cursor() as cursor:
            cursor.execute("UPDATE users SET shorts_banned_until = %s WHERE id = %s", [until, user_id])
            if cursor.rowcount == 0:
                raise ShortError("User not found", 404)
        return until
