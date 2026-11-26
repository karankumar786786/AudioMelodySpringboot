"""dashboard ke views: health check, media pipeline ka heartbeat, system health, global search aur stats.

Flow: admin dashboard (aur media pipeline ka heartbeat) -> yeh views -> SystemHealthService / Postgres.
"""
from django.db.models import Q, Sum
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

# pyrefly: ignore[missing-import]
from accounts.models import User
# pyrefly: ignore[missing-import]
from catalog.models import Artist, Playlist, Song, SongMetadata
# pyrefly: ignore[missing-import]
from catalog.serializers import SongSerializer
# pyrefly: ignore[missing-import]
from core.services import PaginationMetadataService, RedisService, SystemHealthService
# pyrefly: ignore[missing-import]
from core.views import BaseAdminView
# pyrefly: ignore[missing-import]
from jobs.models import Job
# pyrefly: ignore[missing-import]
from jobs.serializers import JobSerializer
from django.conf import settings


class HealthCheckView(APIView):
    """Bina login ka halka health check (container probes aur Caddy ke liye)."""
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        """Hamesha { status: UP, service: admin } lautao - DB check nahi karta, bas process zinda hai ye batata hai."""
        return Response({"status": "UP", "service": "admin"}, status=status.HTTP_200_OK)


class TelemetryHeartbeatView(APIView):
    """POST /api/telemetry/heartbeat/ aur /webhook/telemetry/heartbeat/
    Media pipeline ke heartbeats aur CPU telemetry yahan aate hain.
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        """X-API-KEY check karo (key set ho aur match na kare to 401), phir heartbeat save karke ack lautao."""
        api_key = request.headers.get("X-API-KEY") or request.headers.get("X-Api-Key")
        expected_key = getattr(settings, "APPLICATION_API_KEY", None)
        if expected_key and (not api_key or api_key != expected_key):
            return Response({"error": "Unauthorized"}, status=status.HTTP_401_UNAUTHORIZED)

        ack = SystemHealthService.record_audio_processing_heartbeat(request.data)
        return Response(ack, status=status.HTTP_200_OK)


class SystemHealthView(BaseAdminView):
    """GET /admin/system/health (aur /api/system/health)
    Admin dashboard ke liye health aur live CPU telemetry.
    """
    def get(self, request):
        """SystemHealthService se health ka poora summary lautao."""
        health_data = SystemHealthService.get_system_health()
        return Response(health_data, status=status.HTTP_200_OK)



class GlobalSearchView(BaseAdminView):
    """GET /admin/search?q=<query> (aur /api/search)
    Songs, artists, playlists ek saath dhoondo - dashboard ka GlobalSearch isko use karta hai.
    """
    def get(self, request):
        """q 2 akshar se chhota ho to khaali lists. Warna songs, artists aur playlists DB me naam se dhoondo."""
        q = (request.query_params.get("q") or "").strip()
        if not q or len(q) < 2:
            return Response({"songs": [], "artists": [], "playlists": []}, status=status.HTTP_200_OK)

        # 1. Songs dhoondo
        songs_qs = Song.objects.filter(
            Q(title__icontains=q)
            | Q(artist_name__icontains=q)
            | Q(album__icontains=q)
            | Q(genre__icontains=q)
            | Q(country__icontains=q)
            | Q(language__icontains=q),
            status="ACTIVE",
        ).order_by("-created_at")[:15]
        songs = [
            {
                "id": s.id,
                "title": s.title,
                "artistName": s.artist_name,
                "imageKey": s.image_key,
                "duration": s.duration,
            }
            for s in songs_qs
        ]

        # 2. Artists dhoondo
        artists_qs = Artist.objects.filter(
            name__icontains=q,
            status="ACTIVE",
        ).order_by("-created_at")[:15]
        artists = [
            {
                "id": a.id,
                "name": a.name,
                "coverImageKey": a.cover_image_key,
                "about": a.about,
            }
            for a in artists_qs
        ]

        # 3. Playlists dhoondo
        playlists_qs = Playlist.objects.filter(
            name__icontains=q,
            status="ACTIVE",
        ).order_by("-created_at")[:15]
        playlists = [
            {
                "id": p.id,
                "name": p.name,
                "coverImageKey": p.cover_image_key,
                "description": p.description,
            }
            for p in playlists_qs
        ]

        return Response({
            "songs": songs,
            "artists": artists,
            "playlists": playlists,
        }, status=status.HTTP_200_OK)


class DashboardStatsView(BaseAdminView):
    """GET /admin/dashboard/stats
    Dashboard ke liye counts aur telemetry ek saath.
    """
    def get(self, request):
        """Songs, artists, playlists, users ke counters aur jobs ke counts ek JSON me lautao."""
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

        recent_songs = Song.objects.filter(status="ACTIVE").select_related("metadata").order_by("-created_at")[:5]
        recent_jobs = Job.objects.all().order_by("-created_at")[:5]

        total_streams = SongMetadata.objects.aggregate(total=Sum("total_streams"))["total"] or 0

        queue_summary = RedisService.get_queue_backpressure_summary()

        data = {
            "totalSongs": songs_meta.total_count if songs_meta else Song.objects.count(),
            "activeSongs": songs_meta.active_count if songs_meta else Song.objects.filter(status="ACTIVE").count(),
            "featuredSongs": featured_songs,
            "totalStreams": total_streams,
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
            "systemHealth": SystemHealthService.get_system_health(),
        }
        return Response(data, status=status.HTTP_200_OK)
