import logging
from typing import Optional, Dict, Any
from django.db import connection, transaction
from django.db.models import Q
from ..models import PaginationMetadata, Song, Artist, Playlist
from .redis_service import RedisService

logger = logging.getLogger(__name__)

class PaginationMetadataService:
    @classmethod
    def get_metadata(cls, entity_name: str) -> Optional[PaginationMetadata]:
        try:
            return PaginationMetadata.objects.filter(entity_name=entity_name).first()
        except Exception as e:
            logger.warning("Error fetching pagination metadata for '%s': %s", entity_name, e)
            return None

    @classmethod
    def increment_status(cls, entity_name: str, status: str) -> None:
        try:
            meta = PaginationMetadata.objects.filter(entity_name=entity_name).first()
            if not meta:
                meta = PaginationMetadata(
                    id=str(uuid.uuid4()),
                    entity_name=entity_name,
                    total_count=0,
                    active_count=0,
                    blocked_count=0,
                    deleted_count=0,
                )
            meta.total_count += 1
            st = (status or "").upper()
            if st == "ACTIVE":
                meta.active_count += 1
            elif st == "BLOCKED":
                meta.blocked_count += 1
            elif st == "DELETED":
                meta.deleted_count += 1
            meta.save()
            RedisService.evict_pagination_cache(entity_name)
        except Exception as e:
            logger.warning("Failed to increment status for '%s': %s", entity_name, e)

    @classmethod
    def decrement_status(cls, entity_name: str, status: str) -> None:
        try:
            meta = PaginationMetadata.objects.filter(entity_name=entity_name).first()
            if not meta:
                return
            meta.total_count = max(0, meta.total_count - 1)
            st = (status or "").upper()
            if st == "ACTIVE":
                meta.active_count = max(0, meta.active_count - 1)
            elif st == "BLOCKED":
                meta.blocked_count = max(0, meta.blocked_count - 1)
            elif st == "DELETED":
                meta.deleted_count = max(0, meta.deleted_count - 1)
            meta.save()
            RedisService.evict_pagination_cache(entity_name)
        except Exception as e:
            logger.warning("Failed to decrement status for '%s': %s", entity_name, e)

    @classmethod
    def transition_status(cls, entity_name: str, old_status: str, new_status: str) -> None:
        try:
            if (old_status or "").upper() == (new_status or "").upper():
                return
            meta = PaginationMetadata.objects.filter(entity_name=entity_name).first()
            if not meta:
                meta = PaginationMetadata(
                    id=str(uuid.uuid4()),
                    entity_name=entity_name,
                    total_count=0,
                    active_count=0,
                    blocked_count=0,
                    deleted_count=0,
                )
            old_st = (old_status or "").upper()
            new_st = (new_status or "").upper()
            if old_st == "ACTIVE":
                meta.active_count = max(0, meta.active_count - 1)
            elif old_st == "BLOCKED":
                meta.blocked_count = max(0, meta.blocked_count - 1)
            elif old_st == "DELETED":
                meta.deleted_count = max(0, meta.deleted_count - 1)

            if new_st == "ACTIVE":
                meta.active_count += 1
            elif new_st == "BLOCKED":
                meta.blocked_count += 1
            elif new_st == "DELETED":
                meta.deleted_count += 1
            meta.save()
            RedisService.evict_pagination_cache(entity_name)
        except Exception as e:
            logger.warning("Failed to transition status for '%s': %s", entity_name, e)

    @classmethod
    def increment_job(cls) -> None:
        cls.increment_status("JobsEntity", "ACTIVE")

    @classmethod
    def decrement_job(cls, status: Optional[str]) -> None:
        cls.decrement_status("JobsEntity", status or "ACTIVE")

    @classmethod
    def transition_job(cls, old_status: Optional[str], new_status: str) -> None:
        cls.transition_status("JobsEntity", old_status or "PENDING", new_status)

    @classmethod
    def increment_delete_job(cls) -> None:
        cls.increment_status("DeleteJobsEntity", "ACTIVE")

    @classmethod
    def decrement_delete_job(cls, status: Optional[str]) -> None:
        cls.decrement_status("DeleteJobsEntity", status or "ACTIVE")

    @classmethod
    def transition_delete_job(cls, old_status: Optional[str], new_status: str) -> None:
        cls.transition_status("DeleteJobsEntity", old_status or "PENDING", new_status)

    @classmethod
    def _save_or_update(cls, entity_name: str, total: int, active: int, blocked: int, deleted: int) -> PaginationMetadata:
        meta = PaginationMetadata.objects.filter(entity_name=entity_name).first()
        if meta:
            meta.total_count = total
            meta.active_count = active
            meta.blocked_count = blocked
            meta.deleted_count = deleted
            meta.save()
        else:
            meta = PaginationMetadata.objects.create(
                id=str(uuid.uuid4()),
                entity_name=entity_name,
                total_count=total,
                active_count=active,
                blocked_count=blocked,
                deleted_count=deleted,
            )
        RedisService.evict_pagination_cache(entity_name)
        return meta

    @classmethod
    def sync_all_metadata(cls) -> Dict[str, Any]:
        """
        Reconciles actual DB table counts with pagination_metadata rows and flushes Redis cache.
        """
        results = {}

        # 1. UsersEntity
        users_total = User.objects.count()
        users_active = User.objects.filter(status="ACTIVE").count()
        users_blocked = User.objects.filter(status="BLOCKED").count()
        users_deleted = User.objects.filter(status="DELETED").count()
        u_meta = cls._save_or_update("UsersEntity", users_total, users_active, users_blocked, users_deleted)
        results["UsersEntity"] = {
            "id": u_meta.id,
            "entityName": u_meta.entity_name,
            "totalCount": u_meta.total_count,
            "activeCount": u_meta.active_count,
            "blockedCount": u_meta.blocked_count,
            "deletedCount": u_meta.deleted_count,
        }

        # 2. SongsEntity
        songs_total = Song.objects.count()
        songs_active = Song.objects.filter(status="ACTIVE").count()
        songs_blocked = Song.objects.filter(status="BLOCKED").count()
        songs_deleted = Song.objects.filter(status="DELETED").count()
        s_meta = cls._save_or_update("SongsEntity", songs_total, songs_active, songs_blocked, songs_deleted)
        results["SongsEntity"] = {
            "id": s_meta.id,
            "entityName": s_meta.entity_name,
            "totalCount": s_meta.total_count,
            "activeCount": s_meta.active_count,
            "blockedCount": s_meta.blocked_count,
            "deletedCount": s_meta.deleted_count,
        }

        # 3. ArtistsEntity
        artists_total = Artist.objects.count()
        artists_active = Artist.objects.filter(status="ACTIVE").count()
        artists_blocked = Artist.objects.filter(status="BLOCKED").count()
        artists_deleted = Artist.objects.filter(status="DELETED").count()
        a_meta = cls._save_or_update("ArtistsEntity", artists_total, artists_active, artists_blocked, artists_deleted)
        results["ArtistsEntity"] = {
            "id": a_meta.id,
            "entityName": a_meta.entity_name,
            "totalCount": a_meta.total_count,
            "activeCount": a_meta.active_count,
            "blockedCount": a_meta.blocked_count,
            "deletedCount": a_meta.deleted_count,
        }

        # 4. PlaylistsEntity
        playlists_total = Playlist.objects.count()
        playlists_active = Playlist.objects.filter(status="ACTIVE").count()
        playlists_blocked = Playlist.objects.filter(status="BLOCKED").count()
        playlists_deleted = Playlist.objects.filter(status="DELETED").count()
        p_meta = cls._save_or_update("PlaylistsEntity", playlists_total, playlists_active, playlists_blocked, playlists_deleted)
        results["PlaylistsEntity"] = {
            "id": p_meta.id,
            "entityName": p_meta.entity_name,
            "totalCount": p_meta.total_count,
            "activeCount": p_meta.active_count,
            "blockedCount": p_meta.blocked_count,
            "deletedCount": p_meta.deleted_count,
        }

        # 5. JobsEntity
        jobs_total = Job.objects.count()
        jobs_active = Job.objects.filter(status__in=["PENDING", "PROCESSING", "QUEUED"]).count()
        jobs_failed = Job.objects.filter(status="FAILED").count()
        jobs_completed = Job.objects.filter(status="COMPLETED").count()
        j_meta = cls._save_or_update("JobsEntity", jobs_total, jobs_active, jobs_failed, jobs_completed)
        results["JobsEntity"] = {
            "id": j_meta.id,
            "entityName": j_meta.entity_name,
            "totalCount": j_meta.total_count,
            "activeCount": j_meta.active_count,
            "blockedCount": j_meta.blocked_count,
            "deletedCount": j_meta.deleted_count,
        }

        # 6. DeleteJobsEntity
        del_jobs_total = DeleteJob.objects.count()
        del_jobs_active = DeleteJob.objects.filter(status__in=["PENDING", "IN_PROGRESS"]).count()
        del_jobs_failed = DeleteJob.objects.filter(status="FAILED").count()
        del_jobs_completed = DeleteJob.objects.filter(status="COMPLETED").count()
        dj_meta = cls._save_or_update("DeleteJobsEntity", del_jobs_total, del_jobs_active, del_jobs_failed, del_jobs_completed)
        results["DeleteJobsEntity"] = {
            "id": dj_meta.id,
            "entityName": dj_meta.entity_name,
            "totalCount": dj_meta.total_count,
            "activeCount": dj_meta.active_count,
            "blockedCount": dj_meta.blocked_count,
            "deletedCount": dj_meta.deleted_count,
        }

        # 7. Reconcile PlaylistSongs metadata for all playlists
        for pl in Playlist.objects.all():
            count = PlaylistSong.objects.filter(playlist=pl).count()
            if pl.total_songs != count:
                Playlist.objects.filter(pk=pl.pk).update(total_songs=count)
            cls._save_or_update(f"PlaylistSongs_{pl.id}", count, count, 0, 0)

        # 8. Reconcile ArtistSongs metadata for all artists
        for art in Artist.objects.all():
            count = Song.objects.filter(
                Q(artist_name__iexact=art.name) | Q(artist_name__icontains=art.name),
                status="ACTIVE",
            ).count()
            cls._save_or_update(f"ArtistSongs_{art.id}", count, count, 0, 0)

        # Evict all Spring Boot / CoreEngine Redis cache entries
        RedisService.evict_all_pagination_cache()

        logger.info("Pagination metadata reconciliation complete: %s", results)
        return results



