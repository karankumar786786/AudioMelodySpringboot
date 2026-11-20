"""
Publish catalog changes (catalog.song.v1) through the outbox whenever Django saves a
song: admin edits, status changes and the finalize webhook that creates new songs.
QuerySet.update() calls bypass signals and are not published.
"""

import logging

from django.db import transaction
from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

from catalog.models import Song
from core.services.outbox_service import OutboxService, events_enabled

logger = logging.getLogger(__name__)


@receiver(pre_save, sender=Song)
def remember_previous_status(sender, instance, **kwargs):
    if not events_enabled() or instance._state.adding:
        instance._previous_status = None
        return
    try:
        instance._previous_status = Song.objects.filter(pk=instance.pk).values_list("status", flat=True).first()
    except Exception:
        instance._previous_status = None


def classify_change(created: bool, previous_status, status) -> str:
    if created:
        return "PUBLISHED" if status == "ACTIVE" else "CREATED"
    if status == "DELETED":
        return "DELETED"
    if previous_status != status:
        if status == "ACTIVE":
            return "PUBLISHED"
        if previous_status == "ACTIVE":
            return "UNPUBLISHED"
    return "UPDATED"


@receiver(post_save, sender=Song)
def publish_song_changed(sender, instance, created, **kwargs):
    if not events_enabled():
        return
    change = classify_change(created, getattr(instance, "_previous_status", None), instance.status)
    try:
        # Savepoint: a failed insert must not break the admin's surrounding transaction.
        with transaction.atomic():
            OutboxService.write_song_changed(instance, change)
    except Exception as e:
        # Never fail the admin's save because of the event pipeline.
        logger.error("Could not write catalog.song.v1 outbox row for %s: %s", instance.pk, e)
