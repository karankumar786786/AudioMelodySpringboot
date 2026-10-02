from django.urls import path
from .views import (
    # Dashboard
    DashboardStatsView,
    GlobalSearchView,
    # Artist
    ArtistListView,
    ArtistDetailView,
    ArtistSongsView,
    # Playlist
    PlaylistListView,
    PlaylistDetailView,
    PlaylistSongsView,
    PlaylistAddSongView,
    PlaylistRemoveSongView,
    # Song
    SongListView,
    SongDetailView,
    SongToggleFeaturedView,
    SongJobDetailView,
    SongJobsListView,
    SongReprocessAudioView,
    SongReprocessVideoView,
    SongRecoverMediaView,
    SongReindexRecombeeView,
    # Jobs
    JobSummaryView,
    JobQueuesView,
    JobActiveView,
    JobListView,
    JobDetailView,
    JobRetryView,
    JobRecoverMediaView,
    JobDeleteAllFailedView,
    JobSyncMetadataView,
    # Delete Jobs
    DeleteJobSummaryView,
    DeleteJobActiveView,
    DeleteJobListView,
    DeleteJobDetailView,
    DeleteJobRetryView,
    # Account
    AccountListView,
    AccountDeleteView,
    AccountUpgradeView,
    AccountBlockView,
    AccountUnblockView,
    AccountDemoteView,
    # Auth
    AdminLoginView,
    AdminRegisterView,
    AdminVerifyOtpView,
    AdminResendOtpView,
    AdminRefreshTokenView,
    AdminProfileView,
    AdminLogoutView,
    # Webhooks
    SongUploadUrlWebhookView,
    VideoUploadUrlWebhookView,
    ImageUploadParamWebhookView,
    VideoUploadParamWebhookView,
    WebhookJobDetailView,
    WebhookJobTranscodingStartedView,
    WebhookJobTranscodedView,
    WebhookJobSaveRecommendationView,
    WebhookJobSaveSearchView,
    WebhookJobFinalizeView,
    WebhookJobFailedView,
    WebhookDeleteSearchView,
    WebhookDeleteRecommendationView,
    WebhookDeleteImageKitView,
    WebhookDeleteS3View,
    WebhookDeleteHardDeleteView,
    WebhookDeleteFailedView,
)

urlpatterns = [
    # Authentication & User Profile for adminFrontend
    path("auth/login", AdminLoginView.as_view(), name="auth-login"),
    path("auth/register", AdminRegisterView.as_view(), name="auth-register"),
    path("auth/verify-otp", AdminVerifyOtpView.as_view(), name="auth-verify-otp"),
    path("auth/resend-otp", AdminResendOtpView.as_view(), name="auth-resend-otp"),
    path("auth/refresh-token", AdminRefreshTokenView.as_view(), name="auth-refresh-token"),
    path("auth/logout", AdminLogoutView.as_view(), name="auth-logout"),
    path("api/user/profile", AdminProfileView.as_view(), name="api-user-profile"),

    # Admin prefixed aliases
    path("admin/auth/login", AdminLoginView.as_view(), name="admin-auth-login"),
    path("admin/auth/register", AdminRegisterView.as_view(), name="admin-auth-register"),
    path("admin/auth/verify-otp", AdminVerifyOtpView.as_view(), name="admin-auth-verify-otp"),
    path("admin/auth/resend-otp", AdminResendOtpView.as_view(), name="admin-auth-resend-otp"),
    path("admin/auth/refresh-token", AdminRefreshTokenView.as_view(), name="admin-auth-refresh-token"),
    path("admin/auth/profile", AdminProfileView.as_view(), name="admin-auth-profile"),
    path("admin/auth/me", AdminProfileView.as_view(), name="admin-auth-me"),

    # Search (called by GlobalSearch component)
    path("api/search", GlobalSearchView.as_view(), name="api-search"),
    path("admin/search", GlobalSearchView.as_view(), name="admin-search"),

    # Dashboard
    path("admin/dashboard/stats", DashboardStatsView.as_view(), name="admin-dashboard-stats"),

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
    path("admin/song/reindex-recombee", SongReindexRecombeeView.as_view(), name="admin-song-reindex-recombee"),
    path("admin/song", SongListView.as_view(), name="admin-song-list"),
    path("admin/song/<str:pk>/featured", SongToggleFeaturedView.as_view(), name="admin-song-featured"),
    path("admin/song/<str:pk>/reprocess-audio", SongReprocessAudioView.as_view(), name="admin-song-reprocess-audio"),
    path("admin/song/<str:pk>/reprocess-video", SongReprocessVideoView.as_view(), name="admin-song-reprocess-video"),
    path("admin/song/<str:pk>/recover-media", SongRecoverMediaView.as_view(), name="admin-song-recover-media"),
    path("admin/song/<str:pk>", SongDetailView.as_view(), name="admin-song-detail"),

    # Jobs (static routes first)
    path("admin/jobs/summary", JobSummaryView.as_view(), name="admin-jobs-summary"),
    path("admin/jobs/queues", JobQueuesView.as_view(), name="admin-jobs-queues"),
    path("admin/jobs/active", JobActiveView.as_view(), name="admin-jobs-active"),
    path("admin/jobs/sync-metadata", JobSyncMetadataView.as_view(), name="admin-jobs-sync-metadata"),
    path("admin/jobs/failed", JobDeleteAllFailedView.as_view(), name="admin-jobs-delete-all-failed"),
    path("admin/jobs/status/<str:filter_status>", JobListView.as_view(), name="admin-jobs-by-status"),
    path("admin/jobs/pending", JobListView.as_view(), {"filter_status": "PENDING"}, name="admin-jobs-pending"),
    path("admin/jobs/processing", JobListView.as_view(), {"filter_status": "PROCESSING"}, name="admin-jobs-processing"),
    path("admin/jobs/completed", JobListView.as_view(), {"filter_status": "COMPLETED"}, name="admin-jobs-completed"),
    path("admin/jobs", JobListView.as_view(), name="admin-jobs-list"),
    path("admin/jobs/<str:pk>/retry", JobRetryView.as_view(), name="admin-jobs-retry"),
    path("admin/jobs/<str:pk>/recover-media", JobRecoverMediaView.as_view(), name="admin-jobs-recover-media"),
    path("admin/jobs/<str:pk>", JobDetailView.as_view(), name="admin-jobs-detail"),

    # Delete Jobs (static routes first)
    path("admin/delete-jobs/summary", DeleteJobSummaryView.as_view(), name="admin-delete-jobs-summary"),
    path("admin/delete-jobs/active", DeleteJobActiveView.as_view(), name="admin-delete-jobs-active"),
    path("admin/delete-jobs/status/<str:filter_status>", DeleteJobListView.as_view(), name="admin-delete-jobs-by-status"),
    path("admin/delete-jobs/pending", DeleteJobListView.as_view(), {"filter_status": "PENDING"}, name="admin-delete-jobs-pending"),
    path("admin/delete-jobs/in-progress", DeleteJobListView.as_view(), {"filter_status": "IN_PROGRESS"}, name="admin-delete-jobs-in-progress"),
    path("admin/delete-jobs/failed", DeleteJobListView.as_view(), {"filter_status": "FAILED"}, name="admin-delete-jobs-failed"),
    path("admin/delete-jobs/completed", DeleteJobListView.as_view(), {"filter_status": "COMPLETED"}, name="admin-delete-jobs-completed"),
    path("admin/delete-jobs", DeleteJobListView.as_view(), name="admin-delete-jobs-list"),
    path("admin/delete-jobs/<str:pk>/retry", DeleteJobRetryView.as_view(), name="admin-delete-jobs-retry"),
    path("admin/delete-jobs/<str:pk>", DeleteJobDetailView.as_view(), name="admin-delete-jobs-detail"),

    # Account
    path("admin/account/<str:email>/block", AccountBlockView.as_view(), name="admin-account-block"),
    path("admin/account/<str:email>/unblock", AccountUnblockView.as_view(), name="admin-account-unblock"),
    path("admin/account/<str:email>/demote", AccountDemoteView.as_view(), name="admin-account-demote"),
    path("admin/account/<str:email>/delete", AccountDeleteView.as_view(), name="admin-account-delete"),
    path("admin/account/<str:email>", AccountUpgradeView.as_view(), name="admin-account-action"),
    path("admin/account", AccountListView.as_view(), name="admin-account-list"),

    # Internal Webhook Uploads
    path("webhook/internal/song-upload-url", SongUploadUrlWebhookView.as_view(), name="webhook-song-upload-url"),
    path("webhook/internal/video-upload-url", VideoUploadUrlWebhookView.as_view(), name="webhook-video-upload-url"),
    path("webhook/internal/image-upload-param", ImageUploadParamWebhookView.as_view(), name="webhook-image-upload-param"),
    path("webhook/internal/video-upload-param", VideoUploadParamWebhookView.as_view(), name="webhook-video-upload-param"),

    # Background Job Webhooks (/webhook/job/*)
    path("webhook/job/<str:job_id>/transcoding-started", WebhookJobTranscodingStartedView.as_view(), name="webhook-job-transcoding-started"),
    path("webhook/job/<str:job_id>/transcoded", WebhookJobTranscodedView.as_view(), name="webhook-job-transcoded"),
    path("webhook/job/<str:job_id>/save-recommendation", WebhookJobSaveRecommendationView.as_view(), name="webhook-job-save-recommendation"),
    path("webhook/job/<str:job_id>/save-search", WebhookJobSaveSearchView.as_view(), name="webhook-job-save-search"),
    path("webhook/job/<str:job_id>/finalize", WebhookJobFinalizeView.as_view(), name="webhook-job-finalize"),
    path("webhook/job/<str:job_id>/failed", WebhookJobFailedView.as_view(), name="webhook-job-failed"),
    path("webhook/job/<str:job_id>", WebhookJobDetailView.as_view(), name="webhook-job-detail"),

    # Delete Cascade Webhooks (/webhook/delete/*)
    path("webhook/delete/<str:entity_type>/<str:entity_id>/delete-search", WebhookDeleteSearchView.as_view(), name="webhook-delete-search"),
    path("webhook/delete/<str:entity_type>/<str:entity_id>/delete-recommendation", WebhookDeleteRecommendationView.as_view(), name="webhook-delete-recommendation"),
    path("webhook/delete/<str:entity_type>/<str:entity_id>/delete-imagekit", WebhookDeleteImageKitView.as_view(), name="webhook-delete-imagekit"),
    path("webhook/delete/<str:entity_type>/<str:entity_id>/delete-s3", WebhookDeleteS3View.as_view(), name="webhook-delete-s3"),
    path("webhook/delete/<str:entity_type>/<str:entity_id>/hard-delete", WebhookDeleteHardDeleteView.as_view(), name="webhook-delete-hard-delete"),
    path("webhook/delete/<str:entity_type>/<str:entity_id>/failed", WebhookDeleteFailedView.as_view(), name="webhook-delete-failed"),
]
