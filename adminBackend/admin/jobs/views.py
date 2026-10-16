import logging
from django.conf import settings
from django.db import models
from django.db.models import Avg, Q
from core.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.response import Response

from catalog.models import Artist, Playlist, PlaylistSong, Song
from core.authentication import IsSuperAdminUserPermission
from core.helpers import (
    format_paginated_response,
    to_delete_job_progress_dto,
    to_job_progress_dto,
)
from core.services import (
    AlgoliaService,
    ExternalJobDispatcher,
    ImageKitService,
    PaginationMetadataService,
    RecombeeService,
    RedisService,
    S3Service,
)
from core.views import BaseAdminView
from .models import DeleteJob, Job
from .serializers import DeleteJobSerializer, JobSerializer

logger = logging.getLogger(__name__)


# ==============================================================================
# Ingestion Job Monitoring & Administration (/admin/jobs)
# ==============================================================================

class JobSummaryView(BaseAdminView):
    def get(self, request):
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
    def get(self, request):
        return Response(RedisService.get_queue_backpressure_summary(), status=status.HTTP_200_OK)


class JobActiveView(BaseAdminView):
    def get(self, request):
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
    def get(self, request, filter_status=None):
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
    def get(self, request, pk):
        job = get_object_or_404(Job, pk=pk)
        return Response(to_job_progress_dto(job), status=status.HTTP_200_OK)

    def delete(self, request, pk):
        job = get_object_or_404(Job, pk=pk)
        song_id = job.song_id

        # Cancel Inngest & worker execution
        ExternalJobDispatcher.cancel_inngest_and_worker(pk, song_id, job)

        # Cleanup Algolia & Recombee
        if song_id:
            AlgoliaService.delete_object(song_id)
            RecombeeService.delete_song(song_id)

        # Cleanup S3
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

        # Cleanup ImageKit
        if job.image_key:
            ImageKitService.delete_by_key(job.image_key)
        if job.video_key:
            ImageKitService.delete_by_key(job.video_key)

        # Delete associated song if half-created
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


class JobRetryView(BaseAdminView):
    def post(self, request, pk):
        job = get_object_or_404(Job, pk=pk)
        old_status = job.status

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
        job.transcoding_attempt = (job.transcoding_attempt or 0) + 1
        job.save()

        PaginationMetadataService.transition_job(old_status, "PENDING")
        RedisService.queue_audio_processing(job.id)

        return Response(to_job_progress_dto(job), status=status.HTTP_200_OK)


class JobRecoverMediaView(BaseAdminView):
    def post(self, request, pk):
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
        job.transcoding_attempt = (job.transcoding_attempt or 0) + 1
        job.save()

        PaginationMetadataService.transition_job(old_status, "PENDING")
        RedisService.queue_audio_processing(job.id)

        return Response(to_job_progress_dto(job), status=status.HTTP_200_OK)


class JobDeleteAllFailedView(BaseAdminView):
    permission_classes = [IsSuperAdminUserPermission]

    def delete(self, request):
        failed_jobs = list(Job.objects.filter(status="FAILED"))
        count = 0
        for j in failed_jobs:
            try:
                # Cancel Inngest & worker
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
    permission_classes = [IsSuperAdminUserPermission]

    def post(self, request):
        res = PaginationMetadataService.sync_all_metadata()
        return Response(res, status=status.HTTP_200_OK)


# ==============================================================================
# Delete Job Monitoring (/admin/delete-jobs)
# ==============================================================================

class DeleteJobSummaryView(BaseAdminView):
    def get(self, request):
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
            "deleteQueueDepth": RedisService.get_queue_size(settings.REDIS_DELETE_QUEUE),
        }
        return Response(data, status=status.HTTP_200_OK)


class DeleteJobActiveView(BaseAdminView):
    def get(self, request):
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
    def get(self, request, filter_status=None):
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
    def get(self, request, pk):
        job = get_object_or_404(DeleteJob, pk=pk)
        return Response(to_delete_job_progress_dto(job), status=status.HTTP_200_OK)

    def delete(self, request, pk):
        job = get_object_or_404(DeleteJob, pk=pk)
        PaginationMetadataService.decrement_delete_job(job.status)
        job.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class DeleteJobRetryView(BaseAdminView):
    def post(self, request, pk):
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
