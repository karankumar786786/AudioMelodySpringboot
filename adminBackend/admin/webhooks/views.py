import logging
import sys
import uuid
from datetime import datetime, timezone
from typing import Optional
from django.conf import settings
from django.db import models
# pyrefly: ignore[missing-import]
from core.shortcuts import get_object_or_404
from rest_framework import status
# pyrefly: ignore[missing-import]
from core.authentication import AdminSessionAuthentication, IsAdminUserPermission
from rest_framework.response import Response
from rest_framework.views import APIView

# pyrefly: ignore[missing-import]
from catalog.models import Artist, Playlist, PlaylistSong, Song, SongMetadata
# pyrefly: ignore[missing-import]
from core.helpers import safe_diff_ms
# pyrefly: ignore[missing-import]
from core.models import PaginationMetadata
# pyrefly: ignore[missing-import]
from core.services import (
    AlgoliaService,
    ImageKitService,
    PaginationMetadataService,
    RecombeeService,
    RedisService,
    S3Service,
)
# pyrefly: ignore[missing-import]
from core.views import BaseAdminView
# pyrefly: ignore[missing-import]
from jobs.models import DeleteJob, Job

logger = logging.getLogger(__name__)



def find_delete_job(entity_type: str, entity_id: str, delete_job_id: Optional[str] = None) -> Optional[DeleteJob]:
    """DeleteJob record dhoondo; tests me api.views.find_delete_job patch kiya ho to wahi use karo."""
    if "api.views" in sys.modules and hasattr(sys.modules["api.views"], "find_delete_job"):
        patched = getattr(sys.modules["api.views"], "find_delete_job")
        if patched is not find_delete_job:
            return patched(entity_type, entity_id, delete_job_id)

    if delete_job_id and delete_job_id.strip():
        return DeleteJob.objects.filter(id=delete_job_id.strip()).first()
    return DeleteJob.objects.filter(entity_type=entity_type.upper(), entity_id=entity_id).order_by("-created_at").first()


# Wo audio features jin pe core API ranking karta hai; job se song pe copy hote hain (Flyway V15).
SONG_AUDIO_FEATURE_FIELDS = ("tempo", "energy", "valence", "danceability")


def copy_audio_features_to_song(job, song) -> list:
    """Job ke (null nahi) audio features ``song`` pe copy karo (memory me) aur badle fields ke naam lautao.
    Job ki null value song ki pehle se pata value ko kabhi nahi mitati - isliye sirf video reprocess
    (jisme features nahi bante) song ke purane features rakhta hai.
    """
    changed = []
    for field in SONG_AUDIO_FEATURE_FIELDS:
        value = getattr(job, field, None)
        if value is not None and getattr(song, field, None) != value:
            setattr(song, field, value)
            changed.append(field)
    return changed


# Media pipeline jo saare audio features bhejti hai (Spotify jaise), is order me Job table me save hote hain.
JOB_AUDIO_FEATURE_FIELDS = (
    "tempo",
    "danceability",
    "energy",
    "valence",
    "acousticness",
    "instrumentalness",
    "liveness",
    "speechiness",
    "loudness",
    "key",
    "mode",
)


def apply_audio_features(job, source: dict) -> None:
    """``source`` dict se har audio feature job pe set karo (save nahi karta).
    Jo feature ``source`` me nahi hai, uski job wali purani value waisi hi rehti hai.
    """
    for name in JOB_AUDIO_FEATURE_FIELDS:
        setattr(job, name, source.get(name, getattr(job, name)))


# ==============================================================================
# Andar ke webhooks aur presigned uploads (/webhook/internal/*)
# ==============================================================================

class SongUploadUrlWebhookView(APIView):
    # Upload ki permission deta hai, isliye admin login zaroori. Ise kabhi AllowAny mat banana.
    """GET /webhook/internal/song-upload-url - gaana S3 temp bucket me seedha upload karne ke liye presigned URL.

    Presigned URL = thodi der ke liye valid aisa link jisse browser bina AWS keys ke S3 me file daal sake.
    """
    authentication_classes = [AdminSessionAuthentication]
    permission_classes = [IsAdminUserPermission]

    def get(self, request):
        """Naya random key (uuid) banao aur us key ka upload URL do. Output: { key, preSignedUrl }."""
        key = str(uuid.uuid4())
        pre_signed_url = S3Service.generate_presigned_upload_url(key)
        return Response({"key": key, "preSignedUrl": pre_signed_url}, status=status.HTTP_200_OK)


class VideoUploadUrlWebhookView(APIView):
    # Upload ki permission deta hai, isliye admin login zaroori. Ise kabhi AllowAny mat banana.
    """GET /webhook/internal/video-upload-url - video ke liye S3 presigned upload URL (song wale jaisa hi)."""
    authentication_classes = [AdminSessionAuthentication]
    permission_classes = [IsAdminUserPermission]

    def get(self, request):
        """Naya uuid key aur uska upload URL do. Output: { key, preSignedUrl }."""
        key = str(uuid.uuid4())
        pre_signed_url = S3Service.generate_presigned_upload_url(key)
        return Response({"key": key, "preSignedUrl": pre_signed_url}, status=status.HTTP_200_OK)


class ImageUploadParamWebhookView(APIView):
    # Upload ki permission deta hai, isliye admin login zaroori. Ise kabhi AllowAny mat banana.
    """GET /webhook/internal/image-upload-param - browser se ImageKit pe image upload karne ke signed params."""
    authentication_classes = [AdminSessionAuthentication]
    permission_classes = [IsAdminUserPermission]

    def get(self, request):
        """ImageKit ke upload params (token, expire, signature...) lautao."""
        params = ImageKitService.generate_upload_params()
        return Response(params, status=status.HTTP_200_OK)


class VideoUploadParamWebhookView(APIView):
    # Upload ki permission deta hai, isliye admin login zaroori. Ise kabhi AllowAny mat banana.
    """GET /webhook/internal/video-upload-param - ImageKit pe chhota video upload karne ke signed params."""
    authentication_classes = [AdminSessionAuthentication]
    permission_classes = [IsAdminUserPermission]

    def get(self, request):
        """ImageKit ke upload params lautao (image wale jaise hi)."""
        params = ImageKitService.generate_upload_params()
        return Response(params, status=status.HTTP_200_OK)


# ==============================================================================
# Upload job ke callbacks (/webhook/job/*) - media pipeline X-API-KEY ke saath call karti hai
# ==============================================================================

class WebhookJobDetailView(BaseAdminView):
    """GET /webhook/job/<job_id> - media pipeline ko job ki poori detail chahiye (keys, clip time, flags, features)."""
    def get(self, request, job_id):
        """Job dhoondo (na mile to 404) aur camelCase JSON me saari fields lautao."""
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
            "tempo": job.tempo,
            "danceability": job.danceability,
            "energy": job.energy,
            "valence": job.valence,
            "acousticness": job.acousticness,
            "instrumentalness": job.instrumentalness,
            "liveness": job.liveness,
            "speechiness": job.speechiness,
            "loudness": job.loudness,
            "key": job.key,
            "mode": job.mode,
            "audioFeatures": job.audio_features,
            "createdAt": job.created_at.isoformat() if job.created_at else None,
        }
        return Response(data, status=status.HTTP_200_OK)


class WebhookJobTranscodingStartedView(BaseAdminView):
    """POST /webhook/job/<job_id>/transcoding-started - pipeline ne transcoding shuru kar di."""
    def post(self, request, job_id):
        """Job ko PROCESSING / TRANSCODING pe le jao, start time aur processingId save karo, attempt +1.
        Dashboard ke counters bhi PROCESSING me shift hote hain. Output: khaali 200.
        """
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
    """POST /webhook/job/<job_id>/transcoded - audio/video HLS me ban gaye; nayi keys aur features aaye."""
    def post(self, request, job_id):
        """Body se songKey, duration, video keys aur audio features job pe likho, transcoding ka time naapo,
        aur agla stage set karo (naya song: RECOMMENDATION_INDEXING, reprocess: seedha FINALIZING).
        Body khaali ho to 400. Job pehle se COMPLETED ho to stage nahi badalta.
        """
        job = get_object_or_404(Job, id=job_id)
        data = request.data
        if not data:
            return Response({"error": "Body required"}, status=status.HTTP_400_BAD_REQUEST)

        now = datetime.now(timezone.utc)
        job.song_key = data.get("songKey", job.song_key)
        job.duration = data.get("duration", job.duration)
        job.full_video_key = data.get("fullVideoKey", job.full_video_key)
        job.video_key = data.get("videoKey", job.video_key)

        # Audio features (Spotify jaise: tempo, energy...) Job table me save karo
        features = data.get("audioFeatures")
        if isinstance(features, dict) and features:
            apply_audio_features(job, features)
            job.audio_features = features
        elif "tempo" in data:
            apply_audio_features(job, data)
            job.audio_features = {name: getattr(job, name) for name in JOB_AUDIO_FEATURE_FIELDS}

        job.transcoded = True
        job.transcoded_at = now
        if job.transcoding_started_at:
            job.transcoding_duration_ms = safe_diff_ms(now, job.transcoding_started_at)
        if job.status != "COMPLETED":
            job.current_stage = "RECOMMENDATION_INDEXING" if not (job.is_video_reprocess or job.is_audio_reprocess) else "FINALIZING"
        job.save()
        return Response(status=status.HTTP_200_OK)


class WebhookJobAudioFeaturesView(BaseAdminView):
    """POST /webhook/job/<job_id>/audio-features - audio features alag se (late) aaye."""
    def post(self, request, job_id):
        """Features job pe save karo. Agar job COMPLETED ho chuka to song pe bhi copy karo.
        Song update fail ho to sirf warning log, response phir bhi 200 { status: saved }.
        """
        job = get_object_or_404(Job, id=job_id)
        data = request.data or {}
        features = data.get("audioFeatures", data)
        if isinstance(features, dict) and features:
            apply_audio_features(job, features)
            job.audio_features = features
            job.save()
            logger.info("Persisted audio features directly for job [%s]", job.id)

            # Features aam taur pe finalize se pehle aate hain (finalize unhe song pe copy karta hai).
            # Agar job pehle hi finalize ho chuka, to song ban chuka hai - use yahin update karo.
            if job.status == "COMPLETED":
                try:
                    song = Song.objects.filter(id=job.song_id).first()
                    if song:
                        changed = copy_audio_features_to_song(job, song)
                        if changed:
                            song.save(update_fields=changed)
                except Exception as e:
                    logger.warning("Failed to copy late audio features onto song %s: %s", job.song_id, e)
        return Response({"status": "saved", "jobId": job.id}, status=status.HTTP_200_OK)


class WebhookJobSaveRecommendationView(BaseAdminView):
    """POST /webhook/job/<job_id>/save-recommendation - song ko Recombee (recommendation engine) me daalo."""
    def post(self, request, job_id):
        """Job pe 'recommendation me save' mark karo, time naapo, stage SEARCH_INDEXING karo, phir Recombee me song bhejo.
        Recombee fail ho to sirf warning - pipeline nahi rukti. Output: khaali 200.
        """
        job = get_object_or_404(Job, id=job_id)
        now = datetime.now(timezone.utc)
        job.saved_in_recommendation = True
        job.recommendation_saved_at = now
        prev = job.transcoded_at or job.created_at
        if prev:
            job.recommendation_duration_ms = safe_diff_ms(now, prev)
        if job.status != "COMPLETED":
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
                album=job.album,
                image_key=job.image_key,
                song_key=job.song_key,
                video_key=job.video_key,
                full_video_key=job.full_video_key,
                preview_start_time=job.preview_start_time,
                preview_end_time=job.preview_end_time,
                is_featured=False,
                lrclib_id=job.lrclib_id,
                status="ACTIVE",
                job_id=job.id,
                total_streams=0,
                tempo=job.tempo,
                danceability=job.danceability,
                energy=job.energy,
                valence=job.valence,
                acousticness=job.acousticness,
                instrumentalness=job.instrumentalness,
                liveness=job.liveness,
                speechiness=job.speechiness,
                loudness=job.loudness,
                key=job.key,
                mode=job.mode,
            )
        except Exception as e:
            logger.warning("Failed to save song to Recombee in webhook: %s", e)

        return Response(status=status.HTTP_200_OK)


class WebhookJobSaveSearchView(BaseAdminView):
    """POST /webhook/job/<job_id>/save-search - song ko Algolia (search) me daalo."""
    def post(self, request, job_id):
        """Job pe 'search me save' mark karo, time naapo, stage FINALIZING karo, phir Algolia me record bhejo.
        Algolia fail ho to sirf warning. Output: { status: indexed, songId }.
        """
        job = get_object_or_404(Job, id=job_id)
        now = datetime.now(timezone.utc)
        job.saved_in_search = True
        job.search_saved_at = now
        prev = job.recommendation_saved_at or job.transcoded_at or job.created_at
        if prev:
            job.search_duration_ms = safe_diff_ms(now, prev)
        if job.status != "COMPLETED":
            job.current_stage = "FINALIZING"
        job.save()

        try:
            AlgoliaService.save_song(
                song={
                    "id": job.song_id,
                    "title": job.title,
                    "artist_name": job.artist_name,
                    "genre": job.genre,
                    "album": job.album,
                    "image_key": job.image_key,
                    "duration": job.duration,
                    "song_key": job.song_key,
                    "video_key": job.video_key,
                    "full_video_key": job.full_video_key,
                    "preview_start_time": job.preview_start_time,
                    "preview_end_time": job.preview_end_time,
                    "clip_start_sec": job.clip_start_sec,
                    "clip_end_sec": job.clip_end_sec,
                    "language": job.language,
                    "lrclib_id": job.lrclib_id,
                    "is_featured": False,
                    "status": "ACTIVE",
                    "job_id": job.id,
                    "total_streams": 0,
                    "search_count": 0,
                },
            )
        except Exception as e:
            logger.warning("Failed to save song to Algolia in webhook: %s", e)

        return Response({"status": "indexed", "songId": job.song_id}, status=status.HTTP_200_OK)


class WebhookJobFinalizeView(BaseAdminView):
    """POST /webhook/job/<job_id>/finalize - pipeline ka aakhri step: songs table me song banao / update karo."""
    def post(self, request, job_id):
        """Idempotent hai: job pehle se COMPLETED ho to kuch dobara nahi karta, bas { status: already_completed }.

        Warna: temp S3 files hatao; reprocess ho to purani media hata ke song ki keys badlo; naya song ho to
        Song + SongMetadata banao (pehle se ho to update). Phir Algolia/Recombee sync (fail = warning),
        counters update aur job COMPLETED. Output: khaali 200.
        """
        job = get_object_or_404(Job, id=job_id)
        if job.status == "COMPLETED":
            if job.current_stage != "COMPLETED":
                job.current_stage = "COMPLETED"
                job.save(update_fields=["current_stage"])
            return Response({"status": "already_completed", "jobId": str(job.id)}, status=status.HTTP_200_OK)

        old_status = job.status
        now = datetime.now(timezone.utc)
        job.completed_at = now

        prev = job.search_saved_at or job.transcoded_at or job.created_at
        if prev:
            job.finalize_duration_ms = safe_diff_ms(now, prev)
        if job.created_at:
            job.total_duration_ms = safe_diff_ms(now, job.created_at)

        # S3 temp bucket se temporary audio/video files hatao
        if job.temp_song_key:
            S3Service.delete_object(job.temp_song_key, settings.S3_TEMP_BUCKET)
        if job.temp_video_key:
            S3Service.delete_object(job.temp_video_key, settings.S3_TEMP_BUCKET)

        # Reprocess (dobara process) wala raasta
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

                copy_audio_features_to_song(job, song)
                song.save()
                try:
                    AlgoliaService.save_song(
                        song=song,
                    )
                except Exception as e:
                    logger.warning("Failed to update Algolia search for song %s: %s", song.id, e)

                try:
                    RecombeeService.save_song(
                        song=song,
                        tempo=job.tempo,
                        danceability=job.danceability,
                        energy=job.energy,
                        valence=job.valence,
                        acousticness=job.acousticness,
                        instrumentalness=job.instrumentalness,
                        liveness=job.liveness,
                        speechiness=job.speechiness,
                        loudness=job.loudness,
                        key=job.key,
                        mode=job.mode,
                    )
                except Exception as e:
                    logger.warning("Failed to update Recombee recommendations for song %s: %s", song.id, e)

            job.status = "COMPLETED"
            job.current_stage = "COMPLETED"
            job.save()
            PaginationMetadataService.transition_job(old_status, "COMPLETED")
            return Response(status=status.HTTP_200_OK)

        # Naya song banao (idempotent: pehle se ho to wahi, warna naya)
        song = Song.objects.filter(id=job.song_id).first()
        created = False
        if not song:
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
                country=getattr(job, "country", None) or "India",
                job_id=job.id,
                status="ACTIVE",
                tempo=job.tempo,
                energy=job.energy,
                valence=job.valence,
                danceability=job.danceability,
            )
            created = True
        else:
            song.title = job.title or song.title
            song.artist_name = job.artist_name or song.artist_name
            song.duration = job.duration or song.duration
            song.song_key = job.song_key or song.song_key
            song.image_key = job.image_key or song.image_key
            song.video_key = job.video_key or song.video_key
            song.full_video_key = job.full_video_key or song.full_video_key
            song.preview_start_time = job.preview_start_time or song.preview_start_time
            song.preview_end_time = job.preview_end_time or song.preview_end_time
            song.genre = job.genre or song.genre
            song.album = job.album or song.album
            if hasattr(job, "country") and job.country:
                song.country = job.country
            song.language = job.language or song.language
            song.lrclib_id = job.lrclib_id or song.lrclib_id
            song.status = "ACTIVE"
            copy_audio_features_to_song(job, song)
            song.save()
        try:
            AlgoliaService.save_song(
                song=song,
                clip_start_sec=job.clip_start_sec,
                clip_end_sec=job.clip_end_sec,
            )
        except Exception as e:
            logger.warning("Failed to sync finalized song %s to Algolia: %s", song.id, e)

        try:
            RecombeeService.save_song(
                song=song,
                clip_start_sec=job.clip_start_sec,
                clip_end_sec=job.clip_end_sec,
                tempo=job.tempo,
                danceability=job.danceability,
                energy=job.energy,
                valence=job.valence,
                acousticness=job.acousticness,
                instrumentalness=job.instrumentalness,
                liveness=job.liveness,
                speechiness=job.speechiness,
                loudness=job.loudness,
                key=job.key,
                mode=job.mode,
            )
        except Exception as e:
            logger.warning("Failed to sync finalized song %s to Recombee: %s", song.id, e)

        try:
            SongMetadata.objects.get_or_create(
                song=song,
                defaults={"id": str(uuid.uuid4()), "total_streams": 0}
            )
        except Exception as e:
            logger.warning("Failed to initialize SongMetadata for song %s: %s", song.id, e)

        if created:
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
    """POST /webhook/job/<job_id>/failed - pipeline me koi step fail ho gaya."""
    def post(self, request, job_id):
        """Job ko FAILED karo, reason save karo (body me na ho to default message), total time naapo. Output: khaali 200."""
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
# Delete chain ke callbacks (/webhook/delete/*)
# ==============================================================================

class WebhookDeleteSearchView(BaseAdminView):
    """POST /webhook/delete/<type>/<id>/delete-search - delete chain ka pehla step: Algolia se record hatao."""
    def post(self, request, entity_type, entity_id):
        """DeleteJob ko IN_PROGRESS / SEARCH_DELETED pe le jao, phir Algolia se record hatao.
        DeleteJob na mile tab bhi Algolia delete chalta hai. Algolia fail = sirf warning. Output: khaali 200.
        """
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
    """POST /webhook/delete/<type>/<id>/delete-recommendation - Recombee se song hatao."""
    def post(self, request, entity_type, entity_id):
        """DeleteJob ka stage RECOMMENDATION_DELETED karo; type SONG ho to Recombee se bhi hatao. Output: khaali 200."""
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
    """POST /webhook/delete/<type>/<id>/delete-imagekit - ImageKit se image/video hatao."""
    def post(self, request, entity_type, entity_id):
        """Stage IMAGEKIT_DELETED karo. SONG: image + chhota video, PLAYLIST: cover + video, ARTIST: cover hatao. Output: khaali 200."""
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
    """POST /webhook/delete/<type>/<id>/delete-s3 - S3 files (media pipeline khud hatati hai) ke baad ka record."""
    def post(self, request, entity_type, entity_id):
        """Sirf DeleteJob ka stage S3_DELETED aur time save karta hai. Output: khaali 200."""
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
    """POST /webhook/delete/<type>/<id>/hard-delete - aakhri step: DB se row hi hata do."""
    def post(self, request, entity_type, entity_id):
        """SONG: playlists se hatao (total_songs -1, 0 se neeche nahi), song aur uske jobs delete.
        PLAYLIST / ARTIST: row delete, unke pagination counters aur Redis cache saaf.
        Phir DeleteJob COMPLETED. Output: khaali 200.
        """
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
    """POST /webhook/delete/<type>/<id>/failed - delete chain me koi step fail hua."""
    def post(self, request, entity_type, entity_id):
        """DeleteJob ko FAILED karo aur reason save karo (na ho to default). Output: khaali 200."""
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


# ==============================================================================
# Shorts ke callbacks (/webhook/short/*), media pipeline X-API-KEY ke saath call karti hai
# ==============================================================================

class WebhookShortProcessedView(APIView):
    """POST /webhook/short/<short_id>/processed - short video ka HLS ban gaya."""
    authentication_classes = [AdminSessionAuthentication]
    permission_classes = [IsAdminUserPermission]

    def post(self, request, short_id):
        """hlsKey zaroori (na ho to 400). ShortService se short ko processed mark karo aur short ka JSON lautao.
        ShortError aaye to uska message aur status code.
        """
        from core.services.short_service import ShortError, ShortService, serialize

        data = request.data or {}
        if not data.get("hlsKey"):
            return Response({"message": "hlsKey is required"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            short = ShortService.mark_processed(short_id, data)
        except ShortError as e:
            return Response({"message": str(e)}, status=e.status_code)
        logger.info("[SHORT] %s processed -> %s", short_id, short.status)
        return Response(serialize(short), status=status.HTTP_200_OK)


class WebhookShortFailedView(APIView):
    """POST /webhook/short/<short_id>/failed - short process nahi ho paya."""
    authentication_classes = [AdminSessionAuthentication]
    permission_classes = [IsAdminUserPermission]

    def post(self, request, short_id):
        """ShortService se short ko FAILED mark karo (reason ke saath). Output: { status: FAILED }; ShortError = uska code."""
        from core.services.short_service import ShortError, ShortService

        try:
            ShortService.mark_failed(short_id, (request.data or {}).get("reason"))
        except ShortError as e:
            return Response({"message": str(e)}, status=e.status_code)
        logger.warning("[SHORT] %s failed: %s", short_id, (request.data or {}).get("reason"))
        return Response({"status": "FAILED"}, status=status.HTTP_200_OK)
