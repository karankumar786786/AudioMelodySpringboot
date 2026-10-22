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
from core.services import PaginationMetadataService, RedisService
# pyrefly: ignore[missing-import]
from core.views import BaseAdminView
# pyrefly: ignore[missing-import]
from jobs.models import Job
# pyrefly: ignore[missing-import]
from jobs.serializers import JobSerializer


class HealthCheckView(APIView):
    """
    Lightweight, unauthenticated health check endpoint for container probes & Caddy.
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({"status": "UP", "service": "admin"}, status=status.HTTP_200_OK)


class GlobalSearchView(BaseAdminView):
    """
    GET /api/search?q=<query> and /admin/search?q=<query>
    Unified multi-entity search for songs, artists, and playlists used by GlobalSearch component.
    """
    def get(self, request):
        q = (request.query_params.get("q") or "").strip()
        if not q or len(q) < 2:
            return Response({"songs": [], "artists": [], "playlists": []}, status=status.HTTP_200_OK)

        # 1. Search Songs
        songs_qs = Song.objects.filter(
            Q(title__icontains=q) | Q(artist_name__icontains=q) | Q(language__icontains=q),
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

        # 2. Search Artists
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

        # 3. Search Playlists
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
    """
    GET /admin/dashboard/stats
    Aggregated telemetry and entity counters for executive admin dashboards.
    """
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
        }
        return Response(data, status=status.HTTP_200_OK)
