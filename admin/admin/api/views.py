import jwt
from datetime import datetime, timezone
import logging
from typing import Any, Dict, List, Optional
import uuid

from django.conf import settings
from django.db.models import Avg, Q
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .authentication import (
    AdminJWTAuthentication,
    IsAdminUserPermission,
    IsSuperAdminUserPermission,
)
from .helpers import (
    format_paginated_response,
    to_delete_job_progress_dto,
    to_job_progress_dto,
)
from .models import (
    Admin,
    Artist,
    DeleteJob,
    Job,
    PaginationMetadata,
    Playlist,
    PlaylistSong,
    Song,
    User,
)
from .serializers import (
    AdminSerializer,
    ArtistSerializer,
    JobSerializer,
    PaginationMetadataSerializer,
    PlaylistSerializer,
    SongSerializer,
    UserSerializer,
)
from .services import (
    AdminAuthService,
    AlgoliaService,
    ExternalJobDispatcher,
    ImageKitService,
    PaginationMetadataService,
    RecombeeService,
    RedisService,
    S3Service,
)

logger = logging.getLogger(__name__)


# Base Admin API View with standard JWT + Role authentication
class BaseAdminView(APIView):
    authentication_classes = [AdminJWTAuthentication]
    permission_classes = [IsAdminUserPermission]


# ==============================================================================
# 0. Admin Authentication & Session Management (/auth/*, /api/user/profile)
# ==============================================================================

class AdminLoginView(APIView):
    """
    POST /auth/login
    Accepts { "email": "...", "password": "..." }
    Verifies admin exists in admin_users table and generates an OTP.
    Returns { "tempToken": "<tempToken>", "message": "OTP sent" }
    """
    permission_classes = [AllowAny]

    def post(self, request):
        email = (request.data.get("email") or "").strip().lower()
        if not email:
            return Response({"message": "Email is required"}, status=status.HTTP_400_BAD_REQUEST)

        admin = Admin.objects.filter(email__iexact=email).first()
        if not admin:
            return Response(
                {"message": f"No admin account found with email '{email}'. Please contact your super administrator."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if admin.status == "BLOCKED":
            return Response(
                {"message": "Your admin account has been suspended or blocked."},
                status=status.HTTP_403_FORBIDDEN,
            )

        otp = AdminAuthService.generate_otp()
        temp_token = AdminAuthService.create_temp_token(admin.email, purpose="LOGIN")
        AdminAuthService.save_otp(admin.email, {
            "otp": otp,
            "email": admin.email,
            "role": admin.role,
            "purpose": "LOGIN"
        })
        AdminAuthService.notify_otp(admin.email, "LOGIN", otp)

        return Response({
            "tempToken": temp_token,
            "message": "Verification code has been sent to your email.",
        }, status=status.HTTP_200_OK)


class AdminRegisterView(APIView):
    """
    POST /auth/register
    Accepts { "userName": "...", "email": "...", "password": "..." }
    Initiates registration of a new admin in admin_users table via OTP.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        email = (request.data.get("email") or "").strip().lower()
        name = (request.data.get("userName") or request.data.get("name") or "").strip()

        if not email:
            return Response({"message": "Email is required"}, status=status.HTTP_400_BAD_REQUEST)
        if not name:
            return Response({"message": "Name is required"}, status=status.HTTP_400_BAD_REQUEST)

        if Admin.objects.filter(email__iexact=email).exists():
            return Response(
                {"message": f"An admin account with email '{email}' already exists. Please log in."},
                status=status.HTTP_409_CONFLICT,
            )

        # First registered admin automatically becomes SUPER_ADMIN, otherwise ADMIN
        assigned_role = "SUPER_ADMIN" if Admin.objects.count() == 0 else "ADMIN"
        otp = AdminAuthService.generate_otp()
        temp_token = AdminAuthService.create_temp_token(email, purpose="REGISTER")
        AdminAuthService.save_otp(email, {
            "otp": otp,
            "email": email,
            "userName": name,
            "role": assigned_role,
            "purpose": "REGISTER"
        })
        AdminAuthService.notify_otp(email, "REGISTER", otp)

        return Response({
            "tempToken": temp_token,
            "message": "Registration verification code sent.",
        }, status=status.HTTP_201_CREATED)


class AdminVerifyOtpView(APIView):
    """
    POST /auth/verify-otp
    Header: X-TEMP-TOKEN: <tempToken> (or body { "token": "..." })
    Body: { "otp": "..." }
    Verifies OTP and returns { "accessToken": "...", "refreshToken": "..." }
    """
    permission_classes = [AllowAny]

    def post(self, request):
        temp_token = (
            request.headers.get("X-TEMP-TOKEN")
            or request.headers.get("x-temp-token")
            or request.data.get("token")
            or request.data.get("tempToken")
            or ""
        ).strip()
        otp = str(request.data.get("otp", "")).strip()

        if not temp_token:
            return Response(
                {"message": "Temporary verification token is required in X-TEMP-TOKEN header."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not otp:
            return Response({"message": "OTP code is required."}, status=status.HTTP_400_BAD_REQUEST)

        decoded = AdminAuthService.decode_temp_token(temp_token)
        if not decoded:
            return Response(
                {"message": "Verification session has expired or is invalid. Please log in again."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        email = decoded.get("email")
        otp_data = AdminAuthService.get_otp(email)
        if not otp_data:
            return Response(
                {"message": "Verification code has expired. Please request a new OTP."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if str(otp_data.get("otp", "")).strip() != otp:
            return Response(
                {"message": "Invalid verification code. Please check and try again."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        purpose = otp_data.get("purpose", "LOGIN")
        if purpose == "REGISTER":
            admin, _ = Admin.objects.get_or_create(
                email=email,
                defaults={
                    "id": str(uuid.uuid4()),
                    "name": otp_data.get("userName") or email.split("@")[0],
                    "role": otp_data.get("role", "ADMIN"),
                    "status": "ACTIVE",
                }
            )
        else:
            admin = Admin.objects.filter(email__iexact=email).first()
            if not admin:
                return Response({"message": "Admin account not found."}, status=status.HTTP_404_NOT_FOUND)
            if admin.status == "BLOCKED":
                return Response({"message": "Your admin account is suspended or blocked."}, status=status.HTTP_403_FORBIDDEN)

        AdminAuthService.delete_otp(email)
        tokens = AdminAuthService.issue_tokens_for_admin(admin)
        return Response(tokens, status=status.HTTP_200_OK)


class AdminResendOtpView(APIView):
    """
    POST /auth/resend-otp
    Header: X-TEMP-TOKEN: <tempToken>
    Generates and resends a new OTP code.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        temp_token = (
            request.headers.get("X-TEMP-TOKEN")
            or request.headers.get("x-temp-token")
            or request.data.get("token")
            or request.data.get("tempToken")
            or ""
        ).strip()

        if not temp_token:
            return Response({"message": "Missing temporary verification token."}, status=status.HTTP_400_BAD_REQUEST)

        decoded = AdminAuthService.decode_temp_token(temp_token)
        if not decoded:
            return Response({"message": "Verification session has expired."}, status=status.HTTP_400_BAD_REQUEST)

        email = decoded.get("email")
        purpose = decoded.get("purpose", "LOGIN")
        cached = AdminAuthService.get_otp(email) or {"email": email, "purpose": purpose}

        new_otp = AdminAuthService.generate_otp()
        cached["otp"] = new_otp
        AdminAuthService.save_otp(email, cached)
        AdminAuthService.notify_otp(email, purpose, new_otp)

        return Response({
            "tempToken": temp_token,
            "message": "New OTP sent successfully.",
        }, status=status.HTTP_200_OK)


class AdminRefreshTokenView(APIView):
    """
    POST /auth/refresh-token
    Body: { "refreshToken": "..." }
    Validates refresh token and issues a new pair of access/refresh tokens.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        refresh_token = (request.data.get("refreshToken") or "").strip()
        if not refresh_token:
            return Response({"message": "Refresh token is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            payload = jwt.decode(
                refresh_token,
                settings.JWT_SECRET,
                algorithms=["HS256"],
                options={"verify_signature": True, "verify_exp": True},
            )
        except Exception as e:
            return Response({"message": f"Invalid or expired refresh token: {str(e)}"}, status=status.HTTP_401_UNAUTHORIZED)

        user_id = payload.get("id") or payload.get("sub")
        email = payload.get("email")

        admin = None
        if user_id:
            admin = Admin.objects.filter(id=user_id).first()
        if not admin and email:
            admin = Admin.objects.filter(email__iexact=email).first()

        if not admin or admin.status == "BLOCKED":
            return Response({"message": "Admin session revoked or account suspended."}, status=status.HTTP_403_FORBIDDEN)

        tokens = AdminAuthService.issue_tokens_for_admin(admin)
        return Response(tokens, status=status.HTTP_200_OK)


class AdminProfileView(BaseAdminView):
    """
    GET /api/user/profile (and /auth/me, /admin/auth/me)
    Returns the currently authenticated admin's profile data.
    """
    def get(self, request):
        user = request.user
        return Response({
            "id": user.id,
            "email": user.email,
            "userName": getattr(user, "userName", "") or getattr(user, "name", "") or getattr(user, "user_name", ""),
            "name": getattr(user, "userName", "") or getattr(user, "name", "") or getattr(user, "user_name", ""),
            "role": user.role,
            "status": user.status,
        }, status=status.HTTP_200_OK)


class AdminLogoutView(APIView):
    """
    POST /auth/logout
    """
    permission_classes = [AllowAny]

    def post(self, request):
        return Response({"message": "Logged out successfully"}, status=status.HTTP_200_OK)



# ==============================================================================
# 1. Dashboard Stats
# ==============================================================================

class DashboardStatsView(BaseAdminView):
    def get(self, request):
        songs_meta = PaginationMetadataService.get_metadata("SongsEntity")
        artists_meta = PaginationMetadataService.get_metadata("ArtistsEntity")
        playlists_meta = PaginationMetadataService.get_metadata("PlaylistsEntity")
        users_meta = PaginationMetadataService.get_metadata("UsersEntity")

        featured_songs = Song.objects.filter(is_featured=True, status="ACTIVE").count()

        total_jobs = Job.objects.count()
        pending_jobs = Job.objects.filter(status="PENDING").count()
        failed_jobs = Job.objects.filter(status="FAILED").count()
        processing_jobs = Job.objects.filter(status="PROCESSING").count()
        completed_jobs = Job.objects.filter(status="COMPLETED").count()

        recent_songs = Song.objects.filter(status="ACTIVE").order_by("-created_at")[:5]
        recent_jobs = Job.objects.all().order_by("-created_at")[:5]

        queue_summary = RedisService.get_queue_backpressure_summary()

        data = {
            "totalSongs": songs_meta.total_count if songs_meta else Song.objects.count(),
            "activeSongs": songs_meta.active_count if songs_meta else Song.objects.filter(status="ACTIVE").count(),
            "featuredSongs": featured_songs,
            "totalArtists": artists_meta.total_count if artists_meta else Artist.objects.count(),
            "activeArtists": artists_meta.active_count if artists_meta else Artist.objects.filter(status="ACTIVE").count(),
            "totalPlaylists": playlists_meta.total_count if playlists_meta else Playlist.objects.count(),
            "activePlaylists": playlists_meta.active_count if playlists_meta else Playlist.objects.filter(status="ACTIVE").count(),
            "totalUsers": users_meta.total_count if users_meta else User.objects.count(),
            "activeUsers": users_meta.active_count if users_meta else User.objects.filter(status="ACTIVE").count(),
            "blockedUsers": users_meta.blocked_count if users_meta else User.objects.filter(status="BLOCKED").count(),
            "totalJobs": total_jobs,
            "pendingJobs": pending_jobs,
            "failedJobs": failed_jobs,
            "processingJobs": processing_jobs,
            "completedJobs": completed_jobs,
            "recentSongs": SongSerializer(recent_songs, many=True).data,
            "recentJobs": JobSerializer(recent_jobs, many=True).data,
            "queueStats": queue_summary,
        }
        return Response(data, status=status.HTTP_200_OK)


# ==============================================================================
# 2. Artist Management
# ==============================================================================

class ArtistListView(BaseAdminView):
    def get(self, request):
        page = int(request.query_params.get("page", 0))
        size = int(request.query_params.get("size", 20))
        offset = page * size

        qs = Artist.objects.filter(status="ACTIVE").order_by("-created_at")
        artists = list(qs[offset : offset + size])

        meta = PaginationMetadataService.get_metadata("ArtistsEntity")
        total_count = meta.total_count if meta and meta.total_count > 0 else qs.count()
        meta_dict = {
            "id": meta.id if meta else "ArtistsEntity",
            "entityName": "ArtistsEntity",
            "totalCount": total_count,
            "activeCount": meta.active_count if meta else total_count,
            "blockedCount": 0,
            "deletedCount": meta.deleted_count if meta else 0,
        }

        return Response(
            format_paginated_response(ArtistSerializer(artists, many=True).data, page, size, meta_dict),
            status=status.HTTP_200_OK,
        )

    def post(self, request):
        name = request.data.get("name")
        about = request.data.get("about")
        cover_image_key = request.data.get("coverImageKey")
        dob = request.data.get("dob")

        if not name or not str(name).strip():
            return Response({"error": "Artist name is required"}, status=status.HTTP_400_BAD_REQUEST)

        artist = Artist.objects.create(
            id=str(uuid.uuid4()),
            name=str(name).strip(),
            about=about,
            cover_image_key=cover_image_key,
            dob=dob,
            status="ACTIVE",
        )
        PaginationMetadataService.increment_status("ArtistsEntity", "ACTIVE")
        AlgoliaService.save_artist(artist)

        return Response(ArtistSerializer(artist).data, status=status.HTTP_201_CREATED)


class ArtistDetailView(BaseAdminView):
    def get(self, request, pk):
        artist = get_object_or_404(Artist, pk=pk)
        return Response(ArtistSerializer(artist).data, status=status.HTTP_200_OK)

    def put(self, request, pk):
        artist = get_object_or_404(Artist, pk=pk)
        old_cover = artist.cover_image_key

        if "name" in request.data:
            artist.name = request.data["name"]
        if "about" in request.data:
            artist.about = request.data["about"]
        if "dob" in request.data:
            artist.dob = request.data["dob"]
        if "coverImageKey" in request.data:
            new_cover = request.data["coverImageKey"]
            if new_cover and new_cover != old_cover:
                artist.cover_image_key = new_cover
                if old_cover:
                    ImageKitService.delete_by_key(old_cover)

        artist.save()
        AlgoliaService.save_artist(artist)
        return Response(ArtistSerializer(artist).data, status=status.HTTP_202_ACCEPTED)

    def delete(self, request, pk):
        artist = get_object_or_404(Artist, pk=pk)
        if artist.status != "DELETED":
            old_status = artist.status
            artist.status = "DELETED"
            artist.save()
            PaginationMetadataService.transition_status("ArtistsEntity", old_status, "DELETED")
            RedisService.queue_delete_event({
                "entityType": "ARTIST",
                "entityId": artist.id,
                "entityTitle": artist.name,
                "coverImageKey": artist.cover_image_key,
            })
        return Response(status=status.HTTP_202_ACCEPTED)


# ==============================================================================
# 3. Playlist Management
# ==============================================================================

class PlaylistListView(BaseAdminView):
    def get(self, request):
        page = int(request.query_params.get("page", 0))
        size = int(request.query_params.get("size", 20))
        offset = page * size

        qs = Playlist.objects.filter(status="ACTIVE").order_by("-created_at")
        playlists = list(qs[offset : offset + size])

        meta = PaginationMetadataService.get_metadata("PlaylistsEntity")
        total_count = meta.total_count if meta and meta.total_count > 0 else qs.count()
        meta_dict = {
            "id": meta.id if meta else "PlaylistsEntity",
            "entityName": "PlaylistsEntity",
            "totalCount": total_count,
            "activeCount": meta.active_count if meta else total_count,
            "blockedCount": 0,
            "deletedCount": meta.deleted_count if meta else 0,
        }

        return Response(
            format_paginated_response(PlaylistSerializer(playlists, many=True).data, page, size, meta_dict),
            status=status.HTTP_200_OK,
        )

    def post(self, request):
        name = request.data.get("name")
        description = request.data.get("description")
        cover_image_key = request.data.get("coverImageKey")
        video_key = request.data.get("videoKey")

        if not name or not str(name).strip():
            return Response({"error": "Playlist name is required"}, status=status.HTTP_400_BAD_REQUEST)

        playlist = Playlist.objects.create(
            id=str(uuid.uuid4()),
            name=str(name).strip(),
            description=description,
            cover_image_key=cover_image_key or "",
            video_key=video_key,
            status="ACTIVE",
        )
        PaginationMetadataService.increment_status("PlaylistsEntity", "ACTIVE")
        AlgoliaService.save_playlist(playlist)

        return Response(PlaylistSerializer(playlist).data, status=status.HTTP_201_CREATED)


class PlaylistDetailView(BaseAdminView):
    def get(self, request, pk):
        playlist = get_object_or_404(Playlist, pk=pk)
        return Response(PlaylistSerializer(playlist).data, status=status.HTTP_200_OK)

    def put(self, request, pk):
        playlist = get_object_or_404(Playlist, pk=pk)
        old_cover = playlist.cover_image_key
        old_video = playlist.video_key

        if "name" in request.data:
            playlist.name = request.data["name"]
        if "description" in request.data:
            playlist.description = request.data["description"]
        if "coverImageKey" in request.data:
            new_cover = request.data["coverImageKey"]
            if new_cover and new_cover != old_cover:
                playlist.cover_image_key = new_cover
                if old_cover:
                    ImageKitService.delete_by_key(old_cover)
        if "videoKey" in request.data:
            new_vid = (request.data.get("videoKey") or "").strip()
            if not new_vid or new_vid.lower() == "null":
                if old_video:
                    ImageKitService.delete_by_key(old_video)
                playlist.video_key = None
            elif new_vid != old_video:
                if old_video:
                    ImageKitService.delete_by_key(old_video)
                playlist.video_key = new_vid

        playlist.save()
        AlgoliaService.save_playlist(playlist)
        return Response(PlaylistSerializer(playlist).data, status=status.HTTP_200_OK)

    def delete(self, request, pk):
        playlist = get_object_or_404(Playlist, pk=pk)
        if playlist.status != "DELETED":
            old_status = playlist.status
            playlist.status = "DELETED"
            playlist.save()
            PaginationMetadataService.transition_status("PlaylistsEntity", old_status, "DELETED")
            RedisService.queue_delete_event({
                "entityType": "PLAYLIST",
                "entityId": playlist.id,
                "entityTitle": playlist.name,
                "coverImageKey": playlist.cover_image_key,
                "videoKey": playlist.video_key,
            })
        return Response(status=status.HTTP_204_NO_CONTENT)


class PlaylistSongsView(BaseAdminView):
    def get(self, request, pk):
        playlist = get_object_or_404(Playlist, pk=pk)
        page = int(request.query_params.get("page", 0))
        size = int(request.query_params.get("size", 20))
        offset = page * size

        song_ids = PlaylistSong.objects.filter(playlist=playlist).values_list("song_id", flat=True)
        qs = Song.objects.filter(id__in=song_ids, status="ACTIVE").order_by("-created_at")
        songs = list(qs[offset : offset + size])

        meta = PaginationMetadataService.get_metadata(f"PlaylistSongs_{pk}")
        total = qs.count()
        meta_dict = {
            "id": meta.id if meta else f"PlaylistSongs_{pk}",
            "entityName": f"PlaylistSongs_{pk}",
            "totalCount": total,
            "activeCount": total,
            "blockedCount": 0,
            "deletedCount": 0,
        }
        return Response(
            format_paginated_response(SongSerializer(songs, many=True).data, page, size, meta_dict),
            status=status.HTTP_200_OK,
        )

    def post(self, request, pk):
        return PlaylistAddSongView().post(request, pk)



class PlaylistAddSongView(BaseAdminView):
    def post(self, request, pk):
        playlist = get_object_or_404(Playlist, pk=pk)
        song_id = request.data.get("songId")
        if not song_id:
            return Response({"error": "songId is required"}, status=status.HTTP_400_BAD_REQUEST)
        song = get_object_or_404(Song, pk=song_id)

        PlaylistSong.objects.get_or_create(playlist=playlist, song=song)
        return Response(PlaylistSerializer(playlist).data, status=status.HTTP_200_OK)


class PlaylistRemoveSongView(BaseAdminView):
    def delete(self, request, pk, song_id):
        playlist = get_object_or_404(Playlist, pk=pk)
        PlaylistSong.objects.filter(playlist=playlist, song_id=song_id).delete()
        return Response(PlaylistSerializer(playlist).data, status=status.HTTP_200_OK)


# ==============================================================================
# 4. Song Management
# ==============================================================================

class SongListView(BaseAdminView):
    def get(self, request):
        page = int(request.query_params.get("page", 0))
        size = int(request.query_params.get("size", 20))
        search = (request.query_params.get("search") or "").strip()
        offset = page * size

        qs = Song.objects.filter(status="ACTIVE")
        if search:
            qs = qs.filter(
                Q(title__icontains=search)
                | Q(artist_name__icontains=search)
                | Q(language__icontains=search)
            )

        songs = list(qs.order_by("-created_at")[offset : offset + size])
        meta = PaginationMetadataService.get_metadata("SongsEntity")

        if search:
            total_count = qs.count()
        else:
            total_count = meta.total_count if (meta and meta.total_count > 0) else qs.count()

        meta_dict = {
            "id": meta.id if meta else "SongsEntity",
            "entityName": "SongsEntity",
            "totalCount": total_count,
            "activeCount": meta.active_count if meta else total_count,
            "blockedCount": meta.blocked_count if meta else 0,
            "deletedCount": meta.deleted_count if meta else 0,
        }

        return Response(
            format_paginated_response(SongSerializer(songs, many=True).data, page, size, meta_dict),
            status=status.HTTP_200_OK,
        )

    def post(self, request):
        data = request.data
        temp_song_key = (data.get("tempSongKey") or "").strip()
        temp_video_key = (data.get("tempVideoKey") or "").strip()

        if not temp_song_key and not temp_video_key:
            return Response(
                {"error": "Either audio file (tempSongKey) or full video file (tempVideoKey) must be provided"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        clip_start_sec = None
        if data.get("clipStartMin") is not None or data.get("clipStartSec") is not None:
            c_min = int(data.get("clipStartMin") or 0)
            c_sec = int(data.get("clipStartSec") or 0)
            clip_start_sec = c_min * 60 + c_sec

        clip_end_sec = None
        if data.get("clipEndMin") is not None or data.get("clipEndSec") is not None:
            c_min = int(data.get("clipEndMin") or 0)
            c_sec = int(data.get("clipEndSec") or 0)
            clip_end_sec = c_min * 60 + c_sec

        preview_start = data.get("previewStartTime")
        if preview_start is None and (data.get("previewStartMin") is not None or data.get("previewStartSec") is not None):
            preview_start = int(data.get("previewStartMin") or 0) * 60 + int(data.get("previewStartSec") or 0)
        if preview_start is not None and preview_start < 0:
            preview_start = None

        preview_end = data.get("previewEndTime")
        if preview_end is None and (data.get("previewEndMin") is not None or data.get("previewEndSec") is not None):
            preview_end = int(data.get("previewEndMin") or 0) * 60 + int(data.get("previewEndSec") or 0)
        if preview_end is not None and preview_end < 0:
            preview_end = None

        job_id = str(uuid.uuid4())
        song_id = str(uuid.uuid4())

        job = Job.objects.create(
            id=job_id,
            title=data.get("title", ""),
            artist_name=data.get("artistName", ""),
            temp_song_key=temp_song_key or None,
            temp_video_key=temp_video_key or None,
            clip_start_sec=clip_start_sec,
            clip_end_sec=clip_end_sec,
            preview_start_time=preview_start,
            preview_end_time=preview_end,
            image_key=data.get("imageKey", ""),
            video_key=data.get("videoKey"),
            language=data.get("language", "English"),
            lrclib_id=data.get("lrclibId", "0"),
            genre=data.get("genre"),
            song_id=song_id,
            transcoding_attempt=0,
            transcoded=False,
            saved_in_search=False,
            saved_in_recommendation=False,
            status="PENDING",
            current_stage="QUEUED",
        )
        PaginationMetadataService.increment_job()
        RedisService.queue_audio_processing(job_id)

        return Response({"jobId": job_id, "status": "PENDING"}, status=status.HTTP_201_CREATED)


class SongDetailView(BaseAdminView):
    def get(self, request, pk):
        song = get_object_or_404(Song, pk=pk)
        return Response(SongSerializer(song).data, status=status.HTTP_200_OK)

    def put(self, request, pk):
        song = get_object_or_404(Song, pk=pk)
        data = request.data

        if "title" in data and str(data["title"]).strip():
            song.title = str(data["title"]).strip()
        if "artistName" in data and str(data["artistName"]).strip():
            song.artist_name = str(data["artistName"]).strip()
        if "language" in data and str(data["language"]).strip():
            song.language = str(data["language"]).strip()
        if "genre" in data:
            g = str(data["genre"]).strip() if data["genre"] else None
            song.genre = g
        if "lrclibId" in data and data["lrclibId"]:
            song.lrclib_id = str(data["lrclibId"])
        if "isFeatured" in data:
            song.is_featured = bool(data["isFeatured"])
        if "previewStartTime" in data:
            val = data["previewStartTime"]
            song.preview_start_time = None if (val is None or val < 0) else int(val)
        if "previewEndTime" in data:
            val = data["previewEndTime"]
            song.preview_end_time = None if (val is None or val < 0) else int(val)

        old_img = None
        if "imageKey" in data and data["imageKey"] and data["imageKey"] != song.image_key:
            old_img = song.image_key
            song.image_key = data["imageKey"]

        old_vid = None
        if "videoKey" in data:
            new_v = (data["videoKey"] or "").strip()
            if not new_v or new_v.lower() == "null":
                if song.video_key:
                    old_vid = song.video_key
                    song.video_key = None
            elif new_v != song.video_key:
                old_vid = song.video_key
                song.video_key = new_v

        if "fullVideoKey" in data:
            new_fv = (data["fullVideoKey"] or "").strip()
            song.full_video_key = None if (not new_fv or new_fv.lower() == "null") else new_fv

        song.save()

        if old_img:
            ImageKitService.delete_by_key(old_img)
        if old_vid:
            ImageKitService.delete_by_key(old_vid)

        RecombeeService.save_song(song.id, song.title, song.artist_name, song.language, song.genre, song.duration)
        AlgoliaService.save_song(song)

        return Response(SongSerializer(song).data, status=status.HTTP_200_OK)

    def delete(self, request, pk):
        song = get_object_or_404(Song, pk=pk)
        if song.status != "DELETED":
            old_status = song.status
            song.status = "DELETED"
            song.save()
            PaginationMetadataService.transition_status("SongsEntity", old_status, "DELETED")
            RedisService.queue_delete_event({
                "entityType": "SONG",
                "entityId": song.id,
                "entityTitle": song.title,
                "songKey": song.song_key,
                "imageKey": song.image_key,
                "videoKey": song.video_key,
                "fullVideoKey": song.full_video_key,
            })
        return Response(status=status.HTTP_204_NO_CONTENT)


class SongToggleFeaturedView(BaseAdminView):
    def patch(self, request, pk):
        song = get_object_or_404(Song, pk=pk)
        featured = bool(request.data.get("featured", not song.is_featured))
        song.is_featured = featured
        song.save()
        return Response(SongSerializer(song).data, status=status.HTTP_200_OK)


class SongJobDetailView(BaseAdminView):
    def get(self, request, pk):
        job = get_object_or_404(Job, pk=pk)
        return Response(JobSerializer(job).data, status=status.HTTP_200_OK)


class SongJobsListView(BaseAdminView):
    def get(self, request):
        page = int(request.query_params.get("page", 0))
        size = int(request.query_params.get("size", 20))
        offset = page * size

        jobs = list(Job.objects.all().order_by("-created_at")[offset : offset + size])
        meta = PaginationMetadataService.get_metadata("JobsEntity")

        return Response(
            format_paginated_response(JobSerializer(jobs, many=True).data, page, size, meta),
            status=status.HTTP_200_OK,
        )


class SongReprocessAudioView(BaseAdminView):
    def post(self, request, pk):
        song = get_object_or_404(Song, pk=pk)
        temp_song_key = (request.data.get("tempSongKey") or "").strip()
        temp_video_key = (request.data.get("tempVideoKey") or "").strip() or None

        if not temp_song_key:
            return Response({"error": "tempSongKey is required for audio reprocessing"}, status=status.HTTP_400_BAD_REQUEST)

        job_id = str(uuid.uuid4())
        job = Job.objects.create(
            id=job_id,
            title=song.title,
            artist_name=song.artist_name,
            temp_song_key=temp_song_key,
            temp_video_key=temp_video_key,
            image_key=song.image_key,
            video_key=song.video_key,
            preview_start_time=song.preview_start_time,
            preview_end_time=song.preview_end_time,
            language=song.language,
            lrclib_id=song.lrclib_id or "0",
            song_id=song.id,
            transcoding_attempt=0,
            transcoded=False,
            saved_in_search=False,
            saved_in_recommendation=False,
            is_audio_reprocess=True,
            is_video_reprocess=False,
            status="PENDING",
            current_stage="QUEUED",
        )
        PaginationMetadataService.increment_job()
        RedisService.queue_audio_processing(job_id)

        return Response({"jobId": job_id, "status": "PENDING"}, status=status.HTTP_202_ACCEPTED)


class SongReprocessVideoView(BaseAdminView):
    def post(self, request, pk):
        song = get_object_or_404(Song, pk=pk)
        temp_video_key = (request.data.get("tempVideoKey") or "").strip()
        if not temp_video_key:
            return Response({"error": "tempVideoKey is required for video reprocessing"}, status=status.HTTP_400_BAD_REQUEST)

        clip_start_sec = None
        if request.data.get("clipStartMin") is not None or request.data.get("clipStartSec") is not None:
            clip_start_sec = int(request.data.get("clipStartMin") or 0) * 60 + int(request.data.get("clipStartSec") or 0)

        clip_end_sec = None
        if request.data.get("clipEndMin") is not None or request.data.get("clipEndSec") is not None:
            clip_end_sec = int(request.data.get("clipEndMin") or 0) * 60 + int(request.data.get("clipEndSec") or 0)

        job_id = str(uuid.uuid4())
        job = Job.objects.create(
            id=job_id,
            title=song.title,
            artist_name=song.artist_name,
            temp_video_key=temp_video_key,
            clip_start_sec=clip_start_sec,
            clip_end_sec=clip_end_sec,
            image_key=song.image_key,
            video_key=song.video_key,
            preview_start_time=song.preview_start_time,
            preview_end_time=song.preview_end_time,
            language=song.language,
            lrclib_id=song.lrclib_id or "0",
            song_id=song.id,
            transcoding_attempt=0,
            transcoded=False,
            saved_in_search=False,
            saved_in_recommendation=False,
            is_video_reprocess=True,
            is_audio_reprocess=False,
            status="PENDING",
            current_stage="QUEUED",
        )
        PaginationMetadataService.increment_job()
        RedisService.queue_audio_processing(job_id)

        return Response({"jobId": job_id, "status": "PENDING"}, status=status.HTTP_202_ACCEPTED)


class SongRecoverMediaView(BaseAdminView):
    def post(self, request, pk):
        song = get_object_or_404(Song, pk=pk)
        temp_song_key = (request.data.get("tempSongKey") or "").strip() or None
        temp_video_key = (request.data.get("tempVideoKey") or "").strip() or None

        if not temp_song_key and not temp_video_key:
            return Response(
                {"error": "Either replacement audio (tempSongKey) or video (tempVideoKey) must be provided"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        clip_start_sec = None
        if request.data.get("clipStartMin") is not None or request.data.get("clipStartSec") is not None:
            clip_start_sec = int(request.data.get("clipStartMin") or 0) * 60 + int(request.data.get("clipStartSec") or 0)

        clip_end_sec = None
        if request.data.get("clipEndMin") is not None or request.data.get("clipEndSec") is not None:
            clip_end_sec = int(request.data.get("clipEndMin") or 0) * 60 + int(request.data.get("clipEndSec") or 0)

        job_id = str(uuid.uuid4())
        job = Job.objects.create(
            id=job_id,
            title=song.title,
            artist_name=song.artist_name,
            temp_song_key=temp_song_key,
            temp_video_key=temp_video_key,
            clip_start_sec=clip_start_sec,
            clip_end_sec=clip_end_sec,
            image_key=song.image_key,
            video_key=song.video_key,
            preview_start_time=song.preview_start_time,
            preview_end_time=song.preview_end_time,
            language=song.language,
            lrclib_id=song.lrclib_id or "0",
            song_id=song.id,
            transcoding_attempt=0,
            transcoded=False,
            saved_in_search=False,
            saved_in_recommendation=False,
            is_audio_reprocess=bool(temp_song_key),
            is_video_reprocess=bool(temp_video_key),
            status="PENDING",
            current_stage="QUEUED",
        )
        PaginationMetadataService.increment_job()
        RedisService.queue_audio_processing(job_id)

        return Response({"jobId": job_id, "status": "PENDING"}, status=status.HTTP_202_ACCEPTED)


class SongReindexRecombeeView(BaseAdminView):
    def post(self, request):
        active_songs = list(Song.objects.filter(status="ACTIVE"))
        try:
            count = RecombeeService.reindex_all_active_songs(active_songs)
            return Response({"status": "success", "reindexed": count}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"status": "error", "message": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ==============================================================================
# 5. Ingestion Job Monitoring & Administration (/admin/jobs)
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
            Song.objects.filter(id=song_id).delete()

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
                    Song.objects.filter(id=j.song_id).delete()
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
# 6. Delete Job Monitoring (/admin/delete-jobs)
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


# ==============================================================================
# 7. Account Management (/admin/account)
# ==============================================================================

class AccountListView(BaseAdminView):
    def get(self, request):
        page = int(request.query_params.get("page", 0))
        size = int(request.query_params.get("size", 20))
        search = (request.query_params.get("search") or "").strip()
        role = (request.query_params.get("role") or "").strip()
        status_param = (request.query_params.get("status") or "").strip()
        offset = page * size

        qs = User.objects.all()
        if search:
            qs = qs.filter(Q(email__icontains=search) | Q(user_name__icontains=search))
        if role and role.upper() != "ALL":
            qs = qs.filter(role=role.upper())
        if status_param and status_param.upper() != "ALL":
            qs = qs.filter(status=status_param.upper())

        has_filters = bool(search or (role and role.upper() != "ALL") or (status_param and status_param.upper() != "ALL"))
        meta = PaginationMetadataService.get_metadata("UsersEntity")

        total_count = qs.count() if has_filters else (meta.total_count if (meta and meta.total_count > 0) else qs.count())
        users = list(qs.order_by("-created_at")[offset : offset + size])

        meta_dict = {
            "id": meta.id if meta else "UsersEntity",
            "entityName": "UsersEntity",
            "totalCount": total_count,
            "activeCount": meta.active_count if meta else total_count,
            "blockedCount": meta.blocked_count if meta else 0,
            "deletedCount": meta.deleted_count if meta else 0,
        }

        return Response(
            format_paginated_response(UserSerializer(users, many=True).data, page, size, meta_dict),
            status=status.HTTP_200_OK,
        )


class AccountDeleteView(BaseAdminView):
    permission_classes = [IsSuperAdminUserPermission]

    def delete(self, request, email):
        user = get_object_or_404(User, email=email)
        if user.role == "SUPER_ADMIN" and user.id == request.user.id:
            return Response({"error": "Super Admin cannot delete their own account"}, status=status.HTTP_400_BAD_REQUEST)
        RecombeeService.delete_user(user.id)
        RedisService.block_user_in_redis(user.id)
        PaginationMetadataService.decrement_status("UsersEntity", user.status)
        Admin.objects.filter(email=user.email).delete()
        user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class AccountUpgradeView(BaseAdminView):
    permission_classes = [IsSuperAdminUserPermission]

    def post(self, request, email):
        user = get_object_or_404(User, email=email)
        if user.role in ("ADMIN", "SUPER_ADMIN"):
            return Response({"error": "User is already an Admin or Super Admin"}, status=status.HTTP_409_CONFLICT)
        user.role = "ADMIN"
        user.save()
        admin, _ = Admin.objects.get_or_create(
            email=user.email,
            defaults={"id": user.id, "name": user.user_name, "role": "ADMIN", "status": "ACTIVE"}
        )
        admin.role = "ADMIN"
        admin.status = "ACTIVE"
        admin.save()
        return Response(status=status.HTTP_202_ACCEPTED)


class AccountBlockView(BaseAdminView):
    def post(self, request, email):
        user = get_object_or_404(User, email=email)
        if user.role == "SUPER_ADMIN":
            return Response({"error": "Super Admin cannot be blocked"}, status=status.HTTP_409_CONFLICT)
        if user.role == "ADMIN" and not getattr(request.user, "is_super_admin", False):
            return Response({"error": "Only Super Admin can block another Admin"}, status=status.HTTP_403_FORBIDDEN)
        old_status = user.status
        if old_status != "BLOCKED":
            user.status = "BLOCKED"
            user.save()
            Admin.objects.filter(email=user.email).update(status="BLOCKED")
            RedisService.block_user_in_redis(user.id)
            PaginationMetadataService.transition_status("UsersEntity", old_status, "BLOCKED")
        return Response(status=status.HTTP_200_OK)


class AccountUnblockView(BaseAdminView):
    def post(self, request, email):
        user = get_object_or_404(User, email=email)
        if user.role == "ADMIN" and not getattr(request.user, "is_super_admin", False):
            return Response({"error": "Only Super Admin can unblock an Admin"}, status=status.HTTP_403_FORBIDDEN)
        old_status = user.status
        if old_status != "ACTIVE":
            user.status = "ACTIVE"
            user.save()
            Admin.objects.filter(email=user.email).update(status="ACTIVE")
            RedisService.unblock_user_in_redis(user.id)
            PaginationMetadataService.transition_status("UsersEntity", old_status, "ACTIVE")
        return Response(status=status.HTTP_200_OK)


class AccountDemoteView(BaseAdminView):
    permission_classes = [IsSuperAdminUserPermission]

    def post(self, request, email):
        user = get_object_or_404(User, email=email)
        if user.role == "SUPER_ADMIN":
            return Response({"error": "Super Admin cannot be demoted"}, status=status.HTTP_409_CONFLICT)
        user.role = "USER"
        user.save()
        Admin.objects.filter(email=user.email).delete()
        return Response(status=status.HTTP_200_OK)



# ==============================================================================
# 8. Internal Webhooks & Presigned Uploads (/webhook/internal/*)
# ==============================================================================

class SongUploadUrlWebhookView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        key = str(uuid.uuid4())
        pre_signed_url = S3Service.generate_presigned_upload_url(key)
        return Response({"key": key, "preSignedUrl": pre_signed_url}, status=status.HTTP_200_OK)


class VideoUploadUrlWebhookView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        key = str(uuid.uuid4())
        pre_signed_url = S3Service.generate_presigned_upload_url(key)
        return Response({"key": key, "preSignedUrl": pre_signed_url}, status=status.HTTP_200_OK)


class ImageUploadParamWebhookView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        params = ImageKitService.generate_upload_params()
        return Response(params, status=status.HTTP_200_OK)


class VideoUploadParamWebhookView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        params = ImageKitService.generate_upload_params()
        return Response(params, status=status.HTTP_200_OK)


# ==============================================================================
# 9. Background Job Webhooks (/webhook/job/*)
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
        job.status = "PROCESSING"
        job.current_stage = "TRANSCODING"
        job.transcoding_started_at = datetime.now(timezone.utc)
        job.save()
        PaginationMetadataService.transition_job(old_status, "PROCESSING")
        return Response(status=status.HTTP_200_OK)


class WebhookJobTranscodedView(BaseAdminView):
    def post(self, request, job_id):
        job = get_object_or_404(Job, id=job_id)
        song_key = request.data.get("songKey")
        duration = request.data.get("duration")
        full_video_key = request.data.get("fullVideoKey")
        video_key = request.data.get("videoKey")

        if song_key:
            job.song_key = song_key
        if duration is not None:
            job.duration = int(duration)
        if full_video_key:
            job.full_video_key = full_video_key
        if video_key:
            job.video_key = video_key

        now = datetime.now(timezone.utc)
        job.transcoded = True
        job.transcoded_at = now
        if job.transcoding_started_at:
            job.transcoding_duration_ms = int((now - job.transcoding_started_at).total_seconds() * 1000)

        is_reprocess = bool(job.is_video_reprocess or job.is_audio_reprocess)
        job.current_stage = "FINALIZING" if is_reprocess else "RECOMMENDATION_INDEXING"

        # Delete temp files from temporary upload bucket
        if job.temp_song_key:
            try:
                S3Service.delete_object(job.temp_song_key, bucket=settings.S3_TEMP_BUCKET)
            except Exception as e:
                logger.warning("Failed to delete tempSongKey %s: %s", job.temp_song_key, e)
        if job.temp_video_key:
            try:
                S3Service.delete_object(job.temp_video_key, bucket=settings.S3_TEMP_BUCKET)
            except Exception as e:
                logger.warning("Failed to delete tempVideoKey %s: %s", job.temp_video_key, e)

        job.save()
        return Response(status=status.HTTP_200_OK)


class WebhookJobSaveRecommendationView(BaseAdminView):
    def post(self, request, job_id):
        job = get_object_or_404(Job, id=job_id)
        try:
            RecombeeService.save_song(
                song_id=job.song_id,
                title=job.title,
                artist_name=job.artist_name,
                language=job.language or "unknown",
                genre=job.genre,
            )
        except Exception as e:
            logger.error("Failed to save job %s in Recombee: %s", job_id, e)
            return Response({"error": f"Recombee indexing failed: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        now = datetime.now(timezone.utc)
        job.saved_in_recommendation = True
        job.recommendation_saved_at = now
        if job.transcoded_at:
            job.recommendation_duration_ms = int((now - job.transcoded_at).total_seconds() * 1000)
        job.current_stage = "SEARCH_INDEXING"
        job.save()
        return Response(status=status.HTTP_200_OK)


class WebhookJobSaveSearchView(BaseAdminView):
    def post(self, request, job_id):
        job = get_object_or_404(Job, id=job_id)
        try:
            AlgoliaService.save_song(
                song_id=job.song_id,
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
                job_id=job.id,
            )
        except Exception as e:
            logger.error("Failed to save job %s in Algolia: %s", job_id, e)
            return Response({"error": f"Algolia search indexing failed: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        now = datetime.now(timezone.utc)
        job.saved_in_search = True
        job.search_saved_at = now
        prev = job.recommendation_saved_at or job.transcoded_at
        if prev:
            job.search_duration_ms = int((now - prev).total_seconds() * 1000)
        job.current_stage = "FINALIZING"
        job.save()
        return Response(status=status.HTTP_200_OK)


class WebhookJobFinalizeView(BaseAdminView):
    def post(self, request, job_id):
        job = get_object_or_404(Job, id=job_id)
        now = datetime.now(timezone.utc)
        job.completed_at = now
        prev = job.search_saved_at or job.transcoded_at
        if prev:
            job.finalize_duration_ms = int((now - prev).total_seconds() * 1000)
        if job.created_at:
            job.total_duration_ms = int((now - job.created_at).total_seconds() * 1000)

        is_reprocess = bool(job.is_video_reprocess or job.is_audio_reprocess)
        old_status = job.status

        if is_reprocess:
            song = get_object_or_404(Song, id=job.song_id)
            if job.song_key:
                song.song_key = job.song_key
            if job.duration and job.duration > 0:
                song.duration = job.duration
            if job.full_video_key:
                song.full_video_key = job.full_video_key
            if job.video_key:
                song.video_key = job.video_key
            song.save()

            if job.is_audio_reprocess:
                try:
                    AlgoliaService.save_song(
                        song_id=song.id,
                        title=song.title,
                        artist_name=song.artist_name,
                        duration=song.duration,
                        song_key=song.song_key or "",
                        image_key=song.image_key or "",
                        video_key=song.video_key,
                        full_video_key=song.full_video_key,
                        preview_start_time=song.preview_start_time,
                        preview_end_time=song.preview_end_time,
                        language=song.language or "unknown",
                        lrclib_id=song.lrclib_id,
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
            job_id=job.id,
            status="ACTIVE",
        )
        PaginationMetadataService.increment_status("SongsEntity", "ACTIVE")

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
            job.total_duration_ms = int((now - job.created_at).total_seconds() * 1000)
        job.save()
        PaginationMetadataService.transition_job(old_status, "FAILED")
        return Response(status=status.HTTP_200_OK)


# ==============================================================================
# 10. Delete Cascade Webhooks (/webhook/delete/*)
# ==============================================================================

def find_delete_job(entity_type: str, entity_id: str, delete_job_id: Optional[str] = None) -> Optional[DeleteJob]:
    if delete_job_id and str(delete_job_id).strip():
        return DeleteJob.objects.filter(id=delete_job_id.strip()).first()
    return DeleteJob.objects.filter(entity_type=entity_type.upper(), entity_id=entity_id).order_by("-created_at").first()


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
                job.search_duration_ms = int((now - job.created_at).total_seconds() * 1000)
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
                job.recommendation_duration_ms = int((now - prev).total_seconds() * 1000)
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
                job.imagekit_duration_ms = int((now - prev).total_seconds() * 1000)
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
                job.s3_duration_ms = int((now - prev).total_seconds() * 1000)
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
                song.delete()
                PaginationMetadataService.decrement_status("SongsEntity", status_val)
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
                pl.delete()
                PaginationMetadataService.decrement_status("PlaylistsEntity", status_val)
        elif etype == "ARTIST":
            art = Artist.objects.filter(id=entity_id).first()
            if art:
                status_val = art.status or "ACTIVE"
                art.delete()
                PaginationMetadataService.decrement_status("ArtistsEntity", status_val)

        if job:
            old_status = job.status
            job.status = "COMPLETED"
            job.current_stage = "COMPLETED"
            job.completed_at = now
            prev = job.s3_deleted_at or job.imagekit_deleted_at or job.created_at
            if prev:
                job.finalize_duration_ms = int((now - prev).total_seconds() * 1000)
            if job.created_at:
                job.total_duration_ms = int((now - job.created_at).total_seconds() * 1000)
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
                job.total_duration_ms = int((now - job.created_at).total_seconds() * 1000)
            job.save()
            PaginationMetadataService.transition_delete_job(old_status, "FAILED")

        return Response(status=status.HTTP_200_OK)
