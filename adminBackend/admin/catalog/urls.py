from django.urls import path
from .analytics_views import AnalyticsOverviewView, SongAnalyticsView
from .shorts_views import (
    ShortBanView,
    ShortDetailView,
    ShortHideView,
    ShortListView,
    ShortReportListView,
    ShortReportResolveView,
    ShortUnhideView,
    ShortUploadUrlView,
)
from .views import (
    ArtistDetailView,
    ArtistListView,
    ArtistSongsView,
    PlaylistAddSongView,
    PlaylistDetailView,
    PlaylistListView,
    PlaylistRemoveSongView,
    PlaylistSongsView,
    SongDetailView,
    SongJobDetailView,
    SongJobsListView,
    SongListView,
    SongRecoverMediaView,
    SongReindexRecombeeView,
    SongReindexAlgoliaView,
    ArtistReindexAlgoliaView,
    PlaylistReindexAlgoliaView,
    CatalogReindexAllView,
    CatalogSyncStreamCountsView,
    CatalogSyncHealthView,
    CatalogHealthView,
    CatalogHealthResyncView,
    CatalogHealthReprocessView,
    SongReprocessAudioView,
    SongReprocessVideoView,
    SongToggleFeaturedView,
)

app_name = "catalog"

urlpatterns = [
    # Reindex & Sync
    path("admin/catalog/reindex-all", CatalogReindexAllView.as_view(), name="admin-catalog-reindex-all"),
    path("admin/catalog/sync-streams", CatalogSyncStreamCountsView.as_view(), name="admin-catalog-sync-streams"),
    path("admin/catalog/sync-health", CatalogSyncHealthView.as_view(), name="admin-catalog-sync-health"),
    path("admin/catalog/health", CatalogHealthView.as_view(), name="admin-catalog-health"),
    path("admin/catalog/health/resync", CatalogHealthResyncView.as_view(), name="admin-catalog-health-resync"),
    path("admin/catalog/health/reprocess", CatalogHealthReprocessView.as_view(), name="admin-catalog-health-reprocess"),
    path("admin/song/reindex-algolia", SongReindexAlgoliaView.as_view(), name="admin-song-reindex-algolia"),
    path("admin/song/reindex-recombee", SongReindexRecombeeView.as_view(), name="admin-song-reindex-recombee"),
    path("admin/artist/reindex-algolia", ArtistReindexAlgoliaView.as_view(), name="admin-artist-reindex-algolia"),
    path("admin/playlist/reindex-algolia", PlaylistReindexAlgoliaView.as_view(), name="admin-playlist-reindex-algolia"),

    # Artists
    path("admin/artist", ArtistListView.as_view(), name="admin-artist-list"),
    path("api/artists/<str:pk>/songs", ArtistSongsView.as_view(), name="api-artist-songs"),
    path("admin/artist/<str:pk>/songs", ArtistSongsView.as_view(), name="admin-artist-songs"),
    path("admin/artist/<str:pk>", ArtistDetailView.as_view(), name="admin-artist-detail"),

    # Playlists
    path("admin/playlist", PlaylistListView.as_view(), name="admin-playlist-list"),
    path("admin/playlist/<str:pk>/songs/<str:song_id>", PlaylistRemoveSongView.as_view(), name="admin-playlist-remove-song"),
    path("admin/playlist/<str:pk>/songs/add", PlaylistAddSongView.as_view(), name="admin-playlist-add-song"),
    path("admin/playlist/<str:pk>/songs", PlaylistSongsView.as_view(), name="admin-playlist-songs"),
    path("admin/playlist/<str:pk>", PlaylistDetailView.as_view(), name="admin-playlist-detail"),

    # Shorts (static routes first)
    path("admin/shorts/upload-url", ShortUploadUrlView.as_view(), name="admin-shorts-upload-url"),
    path("admin/shorts/reports", ShortReportListView.as_view(), name="admin-shorts-reports"),
    path("admin/shorts/reports/<str:report_id>/resolve", ShortReportResolveView.as_view(), name="admin-shorts-report-resolve"),
    path("admin/shorts/ban/<str:user_id>", ShortBanView.as_view(), name="admin-shorts-ban"),
    path("admin/shorts", ShortListView.as_view(), name="admin-shorts-list"),
    path("admin/shorts/<str:pk>/hide", ShortHideView.as_view(), name="admin-shorts-hide"),
    path("admin/shorts/<str:pk>/unhide", ShortUnhideView.as_view(), name="admin-shorts-unhide"),
    path("admin/shorts/<str:pk>", ShortDetailView.as_view(), name="admin-shorts-detail"),

    # Songs (static routes first)
    path("admin/song/jobs", SongJobsListView.as_view(), name="admin-song-jobs"),
    path("admin/song/job/<str:pk>", SongJobDetailView.as_view(), name="admin-song-job-detail"),
    path("admin/song", SongListView.as_view(), name="admin-song-list"),
    path("admin/analytics/overview", AnalyticsOverviewView.as_view(), name="admin-analytics-overview"),
    path("admin/song/<str:pk>/analytics", SongAnalyticsView.as_view(), name="admin-song-analytics"),
    path("admin/song/<str:pk>/featured", SongToggleFeaturedView.as_view(), name="admin-song-featured"),
    path("admin/song/<str:pk>/reprocess-audio", SongReprocessAudioView.as_view(), name="admin-song-reprocess-audio"),
    path("admin/song/<str:pk>/reprocess-video", SongReprocessVideoView.as_view(), name="admin-song-reprocess-video"),
    path("admin/song/<str:pk>/recover-media", SongRecoverMediaView.as_view(), name="admin-song-recover-media"),
    path("admin/song/<str:pk>", SongDetailView.as_view(), name="admin-song-detail"),
]
