"""Jab bhi Django koi song save kare, catalog change (catalog.song.v1) outbox ke through publish karo:
admin ke edits, status badalna, aur finalize webhook jo naye songs banata hai.
QuerySet.update() signals ko skip karta hai, isliye wo changes publish NAHI hote.

Outbox = event pehle DB table me likhte hain (usi transaction me), baad me relay Kafka/Redpanda bhejta hai.
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
    """pre_save: save se pehle DB se song ka purana status padh ke instance._previous_status me rakho.
    Naya song ho, events band hon ya padhna fail ho to None.
    """
    if not events_enabled() or instance._state.adding:
        instance._previous_status = None
        return
    try:
        instance._previous_status = Song.objects.filter(pk=instance.pk).values_list("status", flat=True).first()
    except Exception:
        instance._previous_status = None


def classify_change(created: bool, previous_status, status) -> str:
    """Change ka type batao: naya + ACTIVE = PUBLISHED, naya = CREATED, DELETED = DELETED,
    status ACTIVE bana = PUBLISHED, ACTIVE se hata = UNPUBLISHED, baaki sab UPDATED.
    """
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
    """post_save: change classify karke outbox me catalog.song.v1 event likho.
    Likhna fail ho to sirf error log - admin ka save fail nahi hota.
    """
    if not events_enabled():
        return
    change = classify_change(created, getattr(instance, "_previous_status", None), instance.status)
    try:
        # Savepoint: insert fail ho to bhi admin ka bahar wala transaction kharab na ho.
        with transaction.atomic():
            OutboxService.write_song_changed(instance, change)
    except Exception as e:
        # Event pipeline ki wajah se admin ka save kabhi fail nahi hona chahiye.
        logger.error("Could not write catalog.song.v1 outbox row for %s: %s", instance.pk, e)
