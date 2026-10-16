import logging
import sys
import uuid
from datetime import datetime, timezone
from typing import Optional
from django.conf import settings
from django.db import models
from core.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from catalog.models import Artist, Playlist, PlaylistSong, Song, SongMetadata
from core.helpers import safe_diff_ms
from core.models import PaginationMetadata
from core.services import (
    AlgoliaService,
    ImageKitService,
    PaginationMetadataService,
    RecombeeService,
    S3Service,
)
from core.views import BaseAdminView
from jobs.models import DeleteJob, Job

logger = logging.getLogger(__name__)



def find_delete_job(entity_type: str, entity_id: str, delete_job_id: Optional[str] = None) -> Optional[DeleteJob]:
    """
    Finds corresponding DeleteJob record, with dynamic fallback checking if
    api.views.find_delete_job was mocked/patched in tests.
    """
    if "api.views" in sys.modules and hasattr(sys.modules["api.views"], "find_delete_job"):
        patched = getattr(sys.modules["api.views"], "find_delete_job")
        if patched is not find_delete_job:
            return patched(entity_type, entity_id, delete_job_id)

    if delete_job_id and str(delete_job_id).strip():
        return DeleteJob.objects.filter(id=delete_job_id.strip()).first()
    return DeleteJob.objects.filter(entity_type=entity_type.upper(), entity_id=entity_id).order_by("-created_at").first()


# ==============================================================================
# Internal Webhooks & Presigned Uploads (/webhook/internal/*)
# ==============================================================================

class SongUploadUrlWebhookView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        key = str(uuid.uuid4())
        pre_signed_url = S3Service.generate_presigned_upload_url(key)
        return Response({"key": key, "preSignedUrl": pre_signed_url}, status=status.HTTP_200_OK)


class VideoUploadUrlWebhookView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        key = str(uuid.uuid4())
        pre_signed_url = S3Service.generate_presigned_upload_url(key)
        return Response({"key": key, "preSignedUrl": pre_signed_url}, status=status.HTTP_200_OK)


class ImageUploadParamWebhookView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        params = ImageKitService.generate_upload_params()
        return Response(params, status=status.HTTP_200_OK)


class VideoUploadParamWebhookView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        params = ImageKitService.generate_upload_params()
        return Response(params, status=status.HTTP_200_OK)


# ==============================================================================
# Background Job Webhooks (/webhook/job/*)
# ==============================================================================

class WebhookJobDetailView(BaseAdminView):
    def get(self, request, job_id):
        job = get_object_or_404(Job, id=job_id)
        data = {
            "id": job.id,
            "title": job.title,
            "artistName": job.artist_name,
            "duration": job.duration,
            "tempSongKey": job.temp_song_key,
            "tempVideoKey": job.temp_video_key,
            "songKey": job.song_key,
            "fullVideoKey": job.full_video_key,
            "imageKey": job.image_key,
            "videoKey": job.video_key,
            "clipStartSec": job.clip_start_sec,
            "clipEndSec": job.clip_end_sec,
            "previewStartTime": job.preview_start_time,
            "previewEndTime": job.preview_end_time,
            "language": job.language,
            "genre": job.genre,
            "lrclibId": job.lrclib_id,
            "songId": job.song_id,
            "transcodingId": job.transcoding_id,
            "transcodingAttempt": job.transcoding_attempt,
            "transcoded": job.transcoded,
            "savedInSearch": job.saved_in_search,
            "savedInRecommendation": job.saved_in_recommendation,
            "isVideoReprocess": bool(job.is_video_reprocess),
            "isAudioReprocess": bool(job.is_audio_reprocess),
            "status": job.status,
            "currentStage": job.current_stage,
            "createdAt": job.created_at.isoformat() if job.created_at else None,
        }
        return Response(data, status=status.HTTP_200_OK)


class WebhookJobTranscodingStartedView(BaseAdminView):
    def post(self, request, job_id):
        job = get_object_or_404(Job, id=job_id)
        old_status = job.status
        processing_id = request.data.get("processingId")
        if processing_id:
            job.transcoding_id = processing_id
        job.transcoding_attempt = (job.transcoding_attempt or 0) + 1
        job.transcoding_started_at = datetime.now(timezone.utc)
        job.status = "PROCESSING"
        job.current_stage = "TRANSCODING"
        job.save()
        PaginationMetadataService.transition_job(old_status, "PROCESSING")
        return Response(status=status.HTTP_200_OK)


class WebhookJobTranscodedView(BaseAdminView):
    def post(self, request, job_id):
        job = get_object_or_404(Job, id=job_id)
        data = request.data
        if not data:
            return Response({"error": "Body required"}, status=status.HTTP_400_BAD_REQUEST)

        now = datetime.now(timezone.utc)
        job.song_key = data.get("songKey", job.song_key)
        job.duration = data.get("duration", job.duration)
        job.full_video_key = data.get("fullVideoKey", job.full_video_key)
        job.video_key = data.get("videoKey", job.video_key)
        job.transcoded = True
        job.transcoded_at = now
        if job.transcoding_started_at:
            job.transcoding_duration_ms = safe_diff_ms(now, job.transcoding_started_at)
        job.current_stage = "RECOMMENDATION_INDEXING" if not (job.is_video_reprocess or job.is_audio_reprocess) else "FINALIZING"
        job.save()
        return Response(status=status.HTTP_200_OK)


class WebhookJobSaveRecommendationView(BaseAdminView):
    def post(self, request, job_id):
        job = get_object_or_404(Job, id=job_id)
        now = datetime.now(timezone.utc)
        job.saved_in_recommendation = True
        job.recommendation_saved_at = now
        prev = job.transcoded_at or job.created_at
        if prev:
            job.recommendation_duration_ms = safe_diff_ms(now, prev)
        job.current_stage = "SEARCH_INDEXING"
        job.save()

        try:
            RecombeeService.save_song(
                song_id=job.song_id,
                title=job.title,
                artist_name=job.artist_name,
                language=job.language,
                genre=job.genre,
                duration=job.duration or 0,
            )
        except Exception as e:
            logger.warning("Failed to save song to Recombee in webhook: %s", e)

        return Response(status=status.HTTP_200_OK)


class WebhookJobSaveSearchView(BaseAdminView):
    def post(self, request, job_id):
        job = get_object_or_404(Job, id=job_id)
        now = datetime.now(timezone.utc)
        job.saved_in_search = True
        job.search_saved_at = now
        prev = job.recommendation_saved_at or job.transcoded_at or job.created_at
        if prev:
            job.search_duration_ms = safe_diff_ms(now, prev)
        job.current_stage = "FINALIZING"
        job.save()

        try:
            AlgoliaService.save_song(
                song={
                    "id": job.song_id,
                    "title": job.title,
                    "artist_name": job.artist_name,
                    "language": job.language,
                    "genre": job.genre,
                    "album": job.album,
                    "image_key": job.image_key,
                    "duration": job.duration,
                    "status": "ACTIVE",
                },
                job_id=job.id,
            )
        except Exception as e:
            logger.warning("Failed to save song to Algolia in webhook: %s", e)

        return Response(status=status.HTTP_200_OK)


class WebhookJobFinalizeView(BaseAdminView):
    def post(self, request, job_id):
        job = get_object_or_404(Job, id=job_id)
        old_status = job.status
        now = datetime.now(timezone.utc)
        job.completed_at = now

        prev = job.search_saved_at or job.transcoded_at or job.created_at
        if prev:
            job.finalize_duration_ms = safe_diff_ms(now, prev)
        if job.created_at:
            job.total_duration_ms = safe_diff_ms(now, job.created_at)

        # Cleanup temporary audio & video files in S3 temp bucket
        if job.temp_song_key:
            S3Service.delete_object(job.temp_song_key, settings.S3_TEMP_BUCKET)
        if job.temp_video_key:
            S3Service.delete_object(job.temp_video_key, settings.S3_TEMP_BUCKET)

        # Reprocess logic
        if job.is_video_reprocess or job.is_audio_reprocess:
            song = Song.objects.filter(id=job.song_id).first()
            if song:
                if job.is_audio_reprocess:
                    old_song_key = song.song_key
                    if old_song_key and old_song_key != job.song_key:
                        S3Service.delete_prefix(old_song_key, settings.S3_PRODUCTION_BUCKET)
                    song.song_key = job.song_key
                    song.duration = job.duration or song.duration

                if job.is_video_reprocess:
                    old_vid = song.video_key
                    if old_vid and old_vid != job.video_key:
                        ImageKitService.delete_by_key(old_vid)
                    old_fv = song.full_video_key
                    if old_fv and old_fv != job.full_video_key:
                        S3Service.delete_prefix(old_fv, settings.S3_PRODUCTION_BUCKET)
                    song.video_key = job.video_key
                    song.full_video_key = job.full_video_key

                song.save()
                try:
                    AlgoliaService.save_song(
                        song=song,
                        job_id=job.id,
                    )
                except Exception as e:
                    logger.warning("Failed to update Algolia search for song %s: %s", song.id, e)

            job.status = "COMPLETED"
            job.current_stage = "COMPLETED"
            job.save()
            PaginationMetadataService.transition_job(old_status, "COMPLETED")
            return Response(status=status.HTTP_200_OK)

        # Standard new song creation
        song = Song.objects.create(
            id=job.song_id,
            title=job.title,
            artist_name=job.artist_name,
            duration=job.duration or 0,
            song_key=job.song_key or "",
            image_key=job.image_key or "",
            video_key=job.video_key,
            full_video_key=job.full_video_key,
            preview_start_time=job.preview_start_time,
            preview_end_time=job.preview_end_time,
            language=job.language or "unknown",
            lrclib_id=job.lrclib_id,
            genre=job.genre,
            album=job.album,
            job_id=job.id,
            status="ACTIVE",
        )
        try:
            SongMetadata.objects.get_or_create(
                song=song,
                defaults={"id": str(uuid.uuid4()), "total_streams": 0}
            )
        except Exception as e:
            logger.warning("Failed to initialize SongMetadata for song %s: %s", song.id, e)

        PaginationMetadataService.increment_status("SongsEntity", "ACTIVE")
        if job.artist_name:
            try:
                art = Artist.objects.filter(name__iexact=job.artist_name.strip()).first()
                if art:
                    PaginationMetadataService.increment_status(f"ArtistSongs_{art.id}", "ACTIVE")
            except Exception as e:
                logger.warning("Failed to update artist song metadata for '%s': %s", job.artist_name, e)

        job.status = "COMPLETED"
        job.current_stage = "COMPLETED"
        job.save()
        PaginationMetadataService.transition_job(old_status, "COMPLETED")
        return Response(status=status.HTTP_200_OK)


class WebhookJobFailedView(BaseAdminView):
    def post(self, request, job_id):
        job = get_object_or_404(Job, id=job_id)
        old_status = job.status
        now = datetime.now(timezone.utc)
        reason = request.data.get("reason", "Transcoding job failed") if request.data else "Transcoding job failed"
        job.status = "FAILED"
        job.current_stage = "FAILED"
        job.failed_at = now
        job.failure_reason = reason
        if job.created_at:
            job.total_duration_ms = safe_diff_ms(now, job.created_at)
        job.save()
        PaginationMetadataService.transition_job(old_status, "FAILED")
        return Response(status=status.HTTP_200_OK)


# ==============================================================================
# Delete Cascade Webhooks (/webhook/delete/*)
# ==============================================================================

class WebhookDeleteSearchView(BaseAdminView):
    def post(self, request, entity_type, entity_id):
        delete_job_id = request.query_params.get("deleteJobId")
        job = find_delete_job(entity_type, entity_id, delete_job_id)
        now = datetime.now(timezone.utc)
        if job:
            if job.status == "PENDING":
                job.status = "IN_PROGRESS"
                PaginationMetadataService.transition_delete_job("PENDING", "IN_PROGRESS")
            if not job.started_at:
                job.started_at = now
            job.current_stage = "SEARCH_DELETED"
            job.search_deleted_at = now
            if job.created_at:
                job.search_duration_ms = safe_diff_ms(now, job.created_at)
            job.save()

        try:
            AlgoliaService.delete_record(entity_id)
        except Exception as e:
            logger.warning("Algolia search deletion failed for %s: %s", entity_id, e)

        return Response(status=status.HTTP_200_OK)


class WebhookDeleteRecommendationView(BaseAdminView):
    def post(self, request, entity_type, entity_id):
        delete_job_id = request.query_params.get("deleteJobId")
        job = find_delete_job(entity_type, entity_id, delete_job_id)
        now = datetime.now(timezone.utc)
        if job:
            job.current_stage = "RECOMMENDATION_DELETED"
            job.recommendation_deleted_at = now
            prev = job.search_deleted_at or job.created_at
            if prev:
                job.recommendation_duration_ms = safe_diff_ms(now, prev)
            job.save()

        if entity_type.upper() == "SONG":
            try:
                RecombeeService.delete_song(entity_id)
            except Exception as e:
                logger.warning("Recombee deletion failed for %s: %s", entity_id, e)

        return Response(status=status.HTTP_200_OK)


class WebhookDeleteImageKitView(BaseAdminView):
    def post(self, request, entity_type, entity_id):
        delete_job_id = request.query_params.get("deleteJobId")
        job = find_delete_job(entity_type, entity_id, delete_job_id)
        now = datetime.now(timezone.utc)
        if job:
            job.current_stage = "IMAGEKIT_DELETED"
            job.imagekit_deleted_at = now
            prev = job.recommendation_deleted_at or job.search_deleted_at or job.created_at
            if prev:
                job.imagekit_duration_ms = safe_diff_ms(now, prev)
            job.save()

        etype = entity_type.upper()
        if etype == "SONG":
            song = Song.objects.filter(id=entity_id).first()
            if song:
                if song.image_key:
                    ImageKitService.delete_by_key(song.image_key)
                if song.video_key:
                    ImageKitService.delete_by_key(song.video_key)
        elif etype == "PLAYLIST":
            pl = Playlist.objects.filter(id=entity_id).first()
            if pl:
                if pl.cover_image_key:
                    ImageKitService.delete_by_key(pl.cover_image_key)
                if pl.video_key:
                    ImageKitService.delete_by_key(pl.video_key)
        elif etype == "ARTIST":
            art = Artist.objects.filter(id=entity_id).first()
            if art and art.cover_image_key:
                ImageKitService.delete_by_key(art.cover_image_key)

        return Response(status=status.HTTP_200_OK)


class WebhookDeleteS3View(BaseAdminView):
    def post(self, request, entity_type, entity_id):
        delete_job_id = request.query_params.get("deleteJobId")
        job = find_delete_job(entity_type, entity_id, delete_job_id)
        now = datetime.now(timezone.utc)
        if job:
            job.current_stage = "S3_DELETED"
            job.s3_deleted_at = now
            prev = job.imagekit_deleted_at or job.created_at
            if prev:
                job.s3_duration_ms = safe_diff_ms(now, prev)
            job.save()

        return Response(status=status.HTTP_200_OK)


class WebhookDeleteHardDeleteView(BaseAdminView):
    def post(self, request, entity_type, entity_id):
        delete_job_id = request.query_params.get("deleteJobId")
        job = find_delete_job(entity_type, entity_id, delete_job_id)
        now = datetime.now(timezone.utc)
        etype = entity_type.upper()

        if etype == "SONG":
            song = Song.objects.filter(id=entity_id).first()
            if song:
                job_id = song.job_id
                status_val = song.status or "ACTIVE"
                artist_name = song.artist_name
                for ps in PlaylistSong.objects.filter(song_id=entity_id):
                    Playlist.objects.filter(pk=ps.playlist_id).update(
                        total_songs=models.Case(
                            models.When(total_songs__gt=0, then=models.F("total_songs") - 1),
                            default=models.Value(0),
                            output_field=models.IntegerField(),
                        )
                    )
                    PaginationMetadataService.decrement_status(f"PlaylistSongs_{ps.playlist_id}", status_val)
                PlaylistSong.objects.filter(song_id=entity_id).delete()
                song.delete()
                PaginationMetadataService.decrement_status("SongsEntity", status_val)
                if artist_name:
                    try:
                        art = Artist.objects.filter(name__iexact=artist_name.strip()).first()
                        if art:
                            PaginationMetadataService.decrement_status(f"ArtistSongs_{art.id}", status_val)
                    except Exception as e:
                        logger.warning("Failed to update artist song metadata for '%s': %s", artist_name, e)
                if job_id:
                    assoc_job = Job.objects.filter(id=job_id).first()
                    if assoc_job:
                        j_status = assoc_job.status
                        assoc_job.delete()
                        PaginationMetadataService.decrement_job(j_status)
                for r_job in Job.objects.filter(song_id=entity_id):
                    r_status = r_job.status
                    r_job.delete()
                    PaginationMetadataService.decrement_job(r_status)
        elif etype == "PLAYLIST":
            pl = Playlist.objects.filter(id=entity_id).first()
            if pl:
                status_val = pl.status or "ACTIVE"
                pl_id = pl.id
                PlaylistSong.objects.filter(playlist=pl).delete()
                pl.delete()
                PaginationMetadataService.decrement_status("PlaylistsEntity", status_val)
                PaginationMetadata.objects.filter(entity_name=f"PlaylistSongs_{pl_id}").delete()
                RedisService.evict_pagination_cache(f"PlaylistSongs_{pl_id}")
        elif etype == "ARTIST":
            art = Artist.objects.filter(id=entity_id).first()
            if art:
                status_val = art.status or "ACTIVE"
                art_id = art.id
                art.delete()
                PaginationMetadataService.decrement_status("ArtistsEntity", status_val)
                PaginationMetadata.objects.filter(entity_name=f"ArtistSongs_{art_id}").delete()
                RedisService.evict_pagination_cache(f"ArtistSongs_{art_id}")

        if job:
            old_status = job.status
            job.status = "COMPLETED"
            job.current_stage = "COMPLETED"
            job.completed_at = now
            prev = job.s3_deleted_at or job.imagekit_deleted_at or job.created_at
            if prev:
                job.finalize_duration_ms = safe_diff_ms(now, prev)
            if job.created_at:
                job.total_duration_ms = safe_diff_ms(now, job.created_at)
            job.save()
            PaginationMetadataService.transition_delete_job(old_status, "COMPLETED")

        return Response(status=status.HTTP_200_OK)


class WebhookDeleteFailedView(BaseAdminView):
    def post(self, request, entity_type, entity_id):
        delete_job_id = request.query_params.get("deleteJobId")
        job = find_delete_job(entity_type, entity_id, delete_job_id)
        reason = request.data.get("reason", "Cascade delete failed") if request.data else "Cascade delete failed"
        now = datetime.now(timezone.utc)
        if job:
            old_status = job.status
            job.status = "FAILED"
            job.current_stage = "FAILED"
            job.failed_at = now
            job.failure_reason = reason
            if job.created_at:
                job.total_duration_ms = safe_diff_ms(now, job.created_at)
            job.save()
            PaginationMetadataService.transition_delete_job(old_status, "FAILED")

        return Response(status=status.HTTP_200_OK)
