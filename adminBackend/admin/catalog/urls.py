from django.urls import path
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
    SongReprocessAudioView,
    SongReprocessVideoView,
    SongToggleFeaturedView,
)

app_name = "catalog"

urlpatterns = [
    # Reindex & Sync
    path("admin/catalog/reindex-all", CatalogReindexAllView.as_view(), name="admin-catalog-reindex-all"),
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

    # Songs (static routes first)
    path("admin/song/jobs", SongJobsListView.as_view(), name="admin-song-jobs"),
    path("admin/song/job/<str:pk>", SongJobDetailView.as_view(), name="admin-song-job-detail"),
    path("admin/song", SongListView.as_view(), name="admin-song-list"),
    path("admin/song/<str:pk>/featured", SongToggleFeaturedView.as_view(), name="admin-song-featured"),
    path("admin/song/<str:pk>/reprocess-audio", SongReprocessAudioView.as_view(), name="admin-song-reprocess-audio"),
    path("admin/song/<str:pk>/reprocess-video", SongReprocessVideoView.as_view(), name="admin-song-reprocess-video"),
    path("admin/song/<str:pk>/recover-media", SongRecoverMediaView.as_view(), name="admin-song-recover-media"),
    path("admin/song/<str:pk>", SongDetailView.as_view(), name="admin-song-detail"),
]
