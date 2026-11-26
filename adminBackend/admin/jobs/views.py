"""jobs ke views: upload jobs aur delete jobs dekhna, retry, recover media aur saaf karna.

Flow: admin dashboard -> yeh views -> Postgres + Inngest (dobara bhejne ke liye) + S3 / ImageKit / Algolia / Recombee (saaf karne ke liye).
"""
import logging
from django.conf import settings
from django.db import models
from django.db.models import Avg, Q
from django.utils import timezone
# pyrefly: ignore[missing-import]
from core.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.response import Response

# pyrefly: ignore[missing-import]
from catalog.models import Artist, Playlist, PlaylistSong, Song
# pyrefly: ignore[missing-import]
from core.authentication import IsSuperAdminUserPermission
# pyrefly: ignore[missing-import]
from core.helpers import (
    format_paginated_response,
    to_delete_job_progress_dto,
    to_job_progress_dto,
)
# pyrefly: ignore[missing-import]
from core.services import (
    AlgoliaService,
    ExternalJobDispatcher,
    ImageKitService,
    PaginationMetadataService,
    RecombeeService,
    RedisService,
    S3Service,
)
# pyrefly: ignore[missing-import]
from core.views import BaseAdminView
from .models import DeleteJob, Job
from .serializers import DeleteJobSerializer, JobSerializer

logger = logging.getLogger(__name__)


# ==============================================================================
# Upload jobs dekhna aur sambhalna (/admin/jobs)
# ==============================================================================

class JobSummaryView(BaseAdminView):
    """GET /admin/jobs/summary - upload jobs ka summary card (status counts, stage counts, average time)."""
    def get(self, request):
        """Har status aur stage ki ginti, COMPLETED jobs ka average time har step ka, aur queue ka backpressure lautao."""
        total = Job.objects.count()
        processing = Job.objects.filter(status="PROCESSING").count()
        pending = Job.objects.filter(status="PENDING").count()
        completed = Job.objects.filter(status="COMPLETED").count()
        failed = Job.objects.filter(status="FAILED").count()

        stage_names = [
            "QUEUED",
            "TRANSCODING",
            "RECOMMENDATION_INDEXING",
            "SEARCH_INDEXING",
            "FINALIZING",
            "COMPLETED",
            "FAILED",
        ]
        stage_breakdown = {stage: Job.objects.filter(current_stage=stage).count() for stage in stage_names}

        completed_qs = Job.objects.filter(status="COMPLETED")
        avg_dict = completed_qs.aggregate(
            avg_transcoding=Avg("transcoding_duration_ms"),
            avg_rec=Avg("recommendation_duration_ms"),
            avg_search=Avg("search_duration_ms"),
            avg_fin=Avg("finalize_duration_ms"),
            avg_total=Avg("total_duration_ms"),
        )

        data = {
            "totalJobs": total,
            "currentlyProcessing": processing,
            "pendingQueued": pending,
            "completed": completed,
            "failed": failed,
            "stageBreakdown": stage_breakdown,
            "avgTranscodingMs": avg_dict.get("avg_transcoding") or 0.0,
            "avgRecommendationMs": avg_dict.get("avg_rec") or 0.0,
            "avgSearchMs": avg_dict.get("avg_search") or 0.0,
            "avgFinalizeMs": avg_dict.get("avg_fin") or 0.0,
            "avgTotalMs": avg_dict.get("avg_total") or 0.0,
            "queueBackpressure": RedisService.get_queue_backpressure_summary(),
        }
        return Response(data, status=status.HTTP_200_OK)


class JobQueuesView(BaseAdminView):
    """GET /admin/jobs/queues - queue me kitna kaam ruka hai (backpressure)."""
    def get(self, request):
        """RedisService ka queue backpressure summary lautao."""
        return Response(RedisService.get_queue_backpressure_summary(), status=status.HTTP_200_OK)


class JobActiveView(BaseAdminView):
    """GET /admin/jobs/active - abhi chal rahe (PENDING / PROCESSING) jobs."""
    def get(self, request):
        """page aur size dono diye hon to paginated response, warna saare active jobs ki list."""
        page = request.query_params.get("page")
        size = request.query_params.get("size")

        qs = Job.objects.filter(status__in=["PENDING", "PROCESSING"]).order_by("-created_at")

        if page is not None and size is not None:
            p = int(page)
            s = int(size)
            total = qs.count()
            jobs = list(qs[p * s : (p + 1) * s])
            content = [to_job_progress_dto(j) for j in jobs]
            meta = {
                "totalCount": total,
                "activeCount": total,
                "blockedCount": 0,
            }
            return Response(format_paginated_response(content, p, s, meta), status=status.HTTP_200_OK)

        content = [to_job_progress_dto(j) for j in qs]
        return Response(content, status=status.HTTP_200_OK)


class JobListView(BaseAdminView):
    """GET /admin/jobs (aur /admin/jobs/status/<status>, /pending, /processing, /completed) - jobs ki list."""
    def get(self, request, filter_status=None):
        """status, stage aur search (title / artist / id) se filter karo, naye pehle, page aur size se kaato."""
        req_status = filter_status or request.query_params.get("status")
        stage = request.query_params.get("stage")
        search = (request.query_params.get("search") or "").strip()
        page = int(request.query_params.get("page", 0))
        size = int(request.query_params.get("size", 20))
        offset = page * size

        qs = Job.objects.all()
        if req_status and req_status.upper() != "ALL":
            qs = qs.filter(status=req_status.upper())
        if stage and stage.upper() != "ALL":
            qs = qs.filter(current_stage=stage.upper())
        if search:
            qs = qs.filter(
                Q(title__icontains=search)
                | Q(artist_name__icontains=search)
                | Q(id__icontains=search)
                | Q(song_id__icontains=search)
            )

        total_count = qs.count()
        jobs = list(qs.order_by("-created_at")[offset : offset + size])
        content = [to_job_progress_dto(j) for j in jobs]

        meta_dict = {
            "totalCount": total_count,
            "activeCount": total_count,
            "blockedCount": 0,
            "deletedCount": 0,
        }
        return Response(format_paginated_response(content, page, size, meta_dict), status=status.HTTP_200_OK)


class JobDetailView(BaseAdminView):
    """GET / DELETE /admin/jobs/<id> - ek job dekho ya poora hata do."""
    def get(self, request, pk):
        """Ek job ki progress detail (na mile to 404)."""
        job = get_object_or_404(Job, pk=pk)
        return Response(to_job_progress_dto(job), status=status.HTTP_200_OK)

    def delete(self, request, pk):
        """Job ko har jagah se saaf karo: Inngest cancel, Algolia / Recombee, S3, ImageKit,
        aadha bana song aur uske counters, phir job row. Output: 204.
        """
        job = get_object_or_404(Job, pk=pk)
        song_id = job.song_id

        # Inngest aur media pipeline me chal raha kaam cancel
        ExternalJobDispatcher.cancel_inngest_and_worker(pk, song_id, job)

        # Algolia aur Recombee se saaf karo
        if song_id:
            AlgoliaService.delete_object(song_id)
            RecombeeService.delete_song(song_id)

        # S3 se files saaf karo
        if job.temp_song_key:
            S3Service.delete_object(job.temp_song_key, settings.S3_TEMP_BUCKET)
        if job.temp_video_key:
            S3Service.delete_object(job.temp_video_key, settings.S3_TEMP_BUCKET)
        if song_id:
            S3Service.delete_prefix(f"audios/{song_id}", settings.S3_TEMP_BUCKET)
            S3Service.delete_prefix(f"videos/{song_id}", settings.S3_TEMP_BUCKET)
            S3Service.delete_prefix(f"audios/{song_id}", settings.S3_PRODUCTION_BUCKET)
            S3Service.delete_prefix(f"videos/{song_id}", settings.S3_PRODUCTION_BUCKET)
        if job.song_key:
            S3Service.delete_prefix(job.song_key, settings.S3_PRODUCTION_BUCKET)
        if job.full_video_key:
            S3Service.delete_prefix(job.full_video_key, settings.S3_PRODUCTION_BUCKET)

        # ImageKit se saaf karo
        if job.image_key:
            ImageKitService.delete_by_key(job.image_key)
        if job.video_key:
            ImageKitService.delete_by_key(job.video_key)

        # Aadha bana song ho to use bhi hatao
        if song_id:
            assoc_song = Song.objects.filter(id=song_id).first()
            if assoc_song:
                s_status = assoc_song.status or "ACTIVE"
                artist_name = assoc_song.artist_name
                assoc_song.delete()
                PaginationMetadataService.decrement_status("SongsEntity", s_status)
                if artist_name:
                    try:
                        art = Artist.objects.filter(name__iexact=artist_name.strip()).first()
                        if art:
                            PaginationMetadataService.decrement_status(f"ArtistSongs_{art.id}", s_status)
                    except Exception as e:
                        logger.warning("Failed to update artist song metadata: %s", e)
                for ps in PlaylistSong.objects.filter(song_id=song_id):
                    Playlist.objects.filter(pk=ps.playlist_id).update(
                        total_songs=models.Case(
                            models.When(total_songs__gt=0, then=models.F("total_songs") - 1),
                            default=models.Value(0),
                            output_field=models.IntegerField(),
                        )
                    )
                    PaginationMetadataService.decrement_status(f"PlaylistSongs_{ps.playlist_id}", s_status)

        PaginationMetadataService.decrement_job(job.status)
        job.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


def reset_pipeline_state(job: Job) -> None:
    """Job ko shuru wali state me le aao (PENDING / QUEUED) taaki pipeline dobara chale.

    Purane timestamps, durations aur "ho gaya" flags saaf karta hai aur attempt number +1 karta hai.
    Save nahi karta - caller khud job.save() karta hai.
    """
    job.status = "PENDING"
    job.current_stage = "QUEUED"
    job.failure_reason = None
    job.failed_at = None
    job.completed_at = None
    job.transcoding_started_at = None
    job.transcoded_at = None
    job.recommendation_saved_at = None
    job.search_saved_at = None
    job.transcoding_duration_ms = None
    job.recommendation_duration_ms = None
    job.search_duration_ms = None
    job.finalize_duration_ms = None
    job.total_duration_ms = None
    job.transcoded = False
    job.saved_in_search = False
    job.saved_in_recommendation = False
    # Attempt number Inngest event_id me jaata hai - naya number = naya event id, warna Inngest ise duplicate samajh kar chhod deta
    job.transcoding_attempt = (job.transcoding_attempt or 0) + 1


def requeue_job(job: Job) -> bool:
    """Job ki pipeline state reset karo, attempt +1, aur Inngest ko dobara bhejo.
    Bhejna fail ho to job phir FAILED. True = bhej diya.
    """
    old_status = job.status
    reset_pipeline_state(job)
    job.save()

    PaginationMetadataService.transition_job(old_status, "PENDING")
    success = RedisService.queue_audio_processing(job.id, attempt=job.transcoding_attempt)
    if not success:
        logger.error("Failed to dispatch retry event to Inngest for job %s (attempt=%s)", job.id, job.transcoding_attempt)
        job.status = "FAILED"
        job.current_stage = "FAILED"
        job.failure_reason = "Failed to dispatch retry event to Inngest orchestrator"
        job.failed_at = timezone.now()
        job.save()
        PaginationMetadataService.transition_job("PENDING", "FAILED")
    return success


class JobRetryView(BaseAdminView):
    """POST /admin/jobs/<id>/retry - fail hua job dobara chalao."""
    def post(self, request, pk):
        """requeue_job se dobara bhejo. Bhejna fail ho to 502 + job ki detail, warna 200 + job."""
        job = get_object_or_404(Job, pk=pk)
        if not requeue_job(job):
            return Response(
                {"error": "Failed to dispatch retry event to Inngest orchestrator", "job": to_job_progress_dto(job)},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        return Response(to_job_progress_dto(job), status=status.HTTP_200_OK)


class JobRecoverMediaView(BaseAdminView):
    """POST /admin/jobs/<id>/recover-media - nayi temp audio/video file de kar job dobara chalao."""
    def post(self, request, pk):
        """tempSongKey ya tempVideoKey me se ek zaroori (warna 400). Clip time (min + sec) bhi badal sakte hain.
        Phir job reset karke Inngest ko bhejo; bhejna fail = job FAILED aur 502.
        """
        job = get_object_or_404(Job, pk=pk)
        data = request.data

        temp_song_key = (data.get("tempSongKey") or "").strip() or None
        temp_video_key = (data.get("tempVideoKey") or "").strip() or None

        if not temp_song_key and not temp_video_key:
            return Response(
                {"error": "Either replacement tempSongKey or tempVideoKey must be provided"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if temp_song_key:
            job.temp_song_key = temp_song_key
        if temp_video_key:
            job.temp_video_key = temp_video_key

        if data.get("clipStartMin") is not None or data.get("clipStartSec") is not None:
            job.clip_start_sec = int(data.get("clipStartMin") or 0) * 60 + int(data.get("clipStartSec") or 0)
        if data.get("clipEndMin") is not None or data.get("clipEndSec") is not None:
            job.clip_end_sec = int(data.get("clipEndMin") or 0) * 60 + int(data.get("clipEndSec") or 0)

        old_status = job.status
        reset_pipeline_state(job)
        job.save()

        PaginationMetadataService.transition_job(old_status, "PENDING")
        success = RedisService.queue_audio_processing(job.id, attempt=job.transcoding_attempt)
        if not success:
            logger.error("Failed to dispatch recovery event to Inngest for job %s (attempt=%s)", job.id, job.transcoding_attempt)
            job.status = "FAILED"
            job.current_stage = "FAILED"
            job.failure_reason = "Failed to dispatch recovery event to Inngest orchestrator"
            job.failed_at = timezone.now()
            job.save()
            PaginationMetadataService.transition_job("PENDING", "FAILED")
            return Response(
                {"error": "Failed to dispatch recovery event to Inngest orchestrator", "job": to_job_progress_dto(job)},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        return Response(to_job_progress_dto(job), status=status.HTTP_200_OK)


class JobDeleteAllFailedView(BaseAdminView):
    """DELETE /admin/jobs/failed - saare FAILED jobs saaf karo (sirf Super Admin)."""
    permission_classes = [IsSuperAdminUserPermission]

    def delete(self, request):
        """Har failed job ko JobDetailView.delete jaise saaf karo. Ek job me error aaye to warning log karke
        agle pe chalo. Output: { success, deletedCount }.
        """
        failed_jobs = list(Job.objects.filter(status="FAILED"))
        count = 0
        for j in failed_jobs:
            try:
                # Inngest aur media pipeline cancel
                ExternalJobDispatcher.cancel_inngest_and_worker(j.id, j.song_id, j)
                if j.song_id:
                    AlgoliaService.delete_object(j.song_id)
                    RecombeeService.delete_song(j.song_id)
                if j.temp_song_key:
                    S3Service.delete_object(j.temp_song_key, settings.S3_TEMP_BUCKET)
                if j.temp_video_key:
                    S3Service.delete_object(j.temp_video_key, settings.S3_TEMP_BUCKET)
                if j.image_key:
                    ImageKitService.delete_by_key(j.image_key)
                if j.video_key:
                    ImageKitService.delete_by_key(j.video_key)
                if j.song_id:
                    assoc_song = Song.objects.filter(id=j.song_id).first()
                    if assoc_song:
                        s_status = assoc_song.status or "ACTIVE"
                        artist_name = assoc_song.artist_name
                        assoc_song.delete()
                        PaginationMetadataService.decrement_status("SongsEntity", s_status)
                        if artist_name:
                            try:
                                art = Artist.objects.filter(name__iexact=artist_name.strip()).first()
                                if art:
                                    PaginationMetadataService.decrement_status(f"ArtistSongs_{art.id}", s_status)
                            except Exception as e:
                                logger.warning("Failed to update artist song metadata: %s", e)
                        for ps in PlaylistSong.objects.filter(song_id=j.song_id):
                            PaginationMetadataService.decrement_status(f"PlaylistSongs_{ps.playlist_id}", s_status)
                PaginationMetadataService.decrement_job(j.status)
                j.delete()
                count += 1
            except Exception as e:
                logger.warning("Error deleting failed job [%s]: %s", j.id, e)

        return Response({"success": True, "deletedCount": count}, status=status.HTTP_200_OK)


class JobSyncMetadataView(BaseAdminView):
    """POST /admin/jobs/sync-metadata (aur do aur naam) - pagination counters DB se dobara milao (sirf Super Admin)."""
    permission_classes = [IsSuperAdminUserPermission]

    def post(self, request):
        """PaginationMetadataService.sync_all_metadata() ka result lautao."""
        res = PaginationMetadataService.sync_all_metadata()
        return Response(res, status=status.HTTP_200_OK)


# ==============================================================================
# Delete jobs dekhna (/admin/delete-jobs)
# ==============================================================================

class DeleteJobSummaryView(BaseAdminView):
    """GET /admin/delete-jobs/summary - delete jobs ka summary card."""
    def get(self, request):
        """Status / stage ki ginti aur COMPLETED delete jobs ka average time har step ka lautao."""
        total = DeleteJob.objects.count()
        processing = DeleteJob.objects.filter(status="IN_PROGRESS").count()
        pending = DeleteJob.objects.filter(status="PENDING").count()
        completed = DeleteJob.objects.filter(status="COMPLETED").count()
        failed = DeleteJob.objects.filter(status="FAILED").count()

        stage_names = [
            "QUEUED",
            "SEARCH_DELETED",
            "RECOMMENDATION_DELETED",
            "IMAGEKIT_DELETED",
            "S3_DELETED",
            "COMPLETED",
            "FAILED",
        ]
        stage_breakdown = {stage: DeleteJob.objects.filter(current_stage=stage).count() for stage in stage_names}

        completed_qs = DeleteJob.objects.filter(status="COMPLETED")
        avg_dict = completed_qs.aggregate(
            avg_search=Avg("search_duration_ms"),
            avg_rec=Avg("recommendation_duration_ms"),
            avg_ik=Avg("imagekit_duration_ms"),
            avg_s3=Avg("s3_duration_ms"),
            avg_fin=Avg("finalize_duration_ms"),
            avg_total=Avg("total_duration_ms"),
        )

        data = {
            "totalJobs": total,
            "currentlyProcessing": processing,
            "pendingQueued": pending,
            "completed": completed,
            "failed": failed,
            "stageBreakdown": stage_breakdown,
            "avgSearchMs": avg_dict.get("avg_search") or 0.0,
            "avgRecommendationMs": avg_dict.get("avg_rec") or 0.0,
            "avgImageKitMs": avg_dict.get("avg_ik") or 0.0,
            "avgS3Ms": avg_dict.get("avg_s3") or 0.0,
            "avgFinalizeMs": avg_dict.get("avg_fin") or 0.0,
            "avgTotalMs": avg_dict.get("avg_total") or 0.0,
            "deleteQueueDepth": 0,
        }
        return Response(data, status=status.HTTP_200_OK)


class DeleteJobActiveView(BaseAdminView):
    """GET /admin/delete-jobs/active - PENDING / IN_PROGRESS delete jobs."""
    def get(self, request):
        """page aur size dono hon to paginated, warna poori list."""
        page = request.query_params.get("page")
        size = request.query_params.get("size")

        qs = DeleteJob.objects.filter(status__in=["PENDING", "IN_PROGRESS"]).order_by("-created_at")

        if page is not None and size is not None:
            p = int(page)
            s = int(size)
            total = qs.count()
            jobs = list(qs[p * s : (p + 1) * s])
            content = [to_delete_job_progress_dto(j) for j in jobs]
            meta = {
                "totalCount": total,
                "activeCount": total,
                "blockedCount": 0,
            }
            return Response(format_paginated_response(content, p, s, meta), status=status.HTTP_200_OK)

        content = [to_delete_job_progress_dto(j) for j in qs]
        return Response(content, status=status.HTTP_200_OK)


class DeleteJobListView(BaseAdminView):
    """GET /admin/delete-jobs (aur status wale raaste) - delete jobs ki list."""
    def get(self, request, filter_status=None):
        """status, stage, entityType aur search se filter karo, naye pehle, page aur size se kaato."""
        req_status = filter_status or request.query_params.get("status")
        stage = request.query_params.get("stage")
        entity_type = request.query_params.get("entityType")
        search = (request.query_params.get("search") or "").strip()
        page = int(request.query_params.get("page", 0))
        size = int(request.query_params.get("size", 20))
        offset = page * size

        qs = DeleteJob.objects.all()
        if req_status and req_status.upper() != "ALL":
            qs = qs.filter(status=req_status.upper())
        if stage and stage.upper() != "ALL":
            qs = qs.filter(current_stage=stage.upper())
        if entity_type and entity_type.upper() != "ALL":
            qs = qs.filter(entity_type=entity_type.upper())
        if search:
            qs = qs.filter(
                Q(entity_title__icontains=search)
                | Q(entity_id__icontains=search)
                | Q(id__icontains=search)
            )

        total_count = qs.count()
        jobs = list(qs.order_by("-created_at")[offset : offset + size])
        content = [to_delete_job_progress_dto(j) for j in jobs]

        meta_dict = {
            "totalCount": total_count,
            "activeCount": total_count,
            "blockedCount": 0,
            "deletedCount": 0,
        }
        return Response(format_paginated_response(content, page, size, meta_dict), status=status.HTTP_200_OK)


class DeleteJobDetailView(BaseAdminView):
    """GET / DELETE /admin/delete-jobs/<id> - ek delete job dekho ya uska record hatao."""
    def get(self, request, pk):
        """Ek delete job ki detail (na mile to 404)."""
        job = get_object_or_404(DeleteJob, pk=pk)
        return Response(to_delete_job_progress_dto(job), status=status.HTTP_200_OK)

    def delete(self, request, pk):
        """Sirf delete job ka record aur counter hatao (asli entity ko kuch nahi hota). Output: 204."""
        job = get_object_or_404(DeleteJob, pk=pk)
        PaginationMetadataService.decrement_delete_job(job.status)
        job.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class DeleteJobRetryView(BaseAdminView):
    """POST /admin/delete-jobs/<id>/retry - delete chain dobara chalao."""
    def post(self, request, pk):
        """Job ki keys se delete event dobara queue karo aur taza job detail lautao."""
        job = get_object_or_404(DeleteJob, pk=pk)
        dto = {
            "deleteJobId": job.id,
            "entityType": job.entity_type,
            "entityId": job.entity_id,
            "entityTitle": job.entity_title,
            "songKey": job.song_key,
            "imageKey": job.image_key,
            "coverImageKey": job.cover_image_key,
            "videoKey": job.video_key,
            "fullVideoKey": job.full_video_key,
        }
        RedisService.queue_delete_event(dto)
        job.refresh_from_db()
        return Response(to_delete_job_progress_dto(job), status=status.HTTP_200_OK)
