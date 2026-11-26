"""webhooks ke URL routes: /webhook/internal/*, /webhook/job/*, /webhook/short/*, /webhook/delete/*."""
from django.urls import path
from .views import (
    WebhookShortFailedView,
    WebhookShortProcessedView,
    ImageUploadParamWebhookView,
    SongUploadUrlWebhookView,
    VideoUploadParamWebhookView,
    VideoUploadUrlWebhookView,
    WebhookDeleteFailedView,
    WebhookDeleteHardDeleteView,
    WebhookDeleteImageKitView,
    WebhookDeleteRecommendationView,
    WebhookDeleteS3View,
    WebhookDeleteSearchView,
    WebhookJobAudioFeaturesView,
    WebhookJobDetailView,
    WebhookJobFailedView,
    WebhookJobFinalizeView,
    WebhookJobSaveRecommendationView,
    WebhookJobSaveSearchView,
    WebhookJobTranscodedView,
    WebhookJobTranscodingStartedView,
)

app_name = "webhooks"

urlpatterns = [
    # Upload ke liye presigned URLs / params
    path("webhook/internal/song-upload-url", SongUploadUrlWebhookView.as_view(), name="webhook-song-upload-url"),
    path("webhook/internal/video-upload-url", VideoUploadUrlWebhookView.as_view(), name="webhook-video-upload-url"),
    path("webhook/internal/image-upload-param", ImageUploadParamWebhookView.as_view(), name="webhook-image-upload-param"),
    path("webhook/internal/video-upload-param", VideoUploadParamWebhookView.as_view(), name="webhook-video-upload-param"),

    # Upload job ke callbacks (/webhook/job/*)
    path("webhook/job/<str:job_id>/transcoding-started", WebhookJobTranscodingStartedView.as_view(), name="webhook-job-transcoding-started"),
    path("webhook/job/<str:job_id>/transcoded", WebhookJobTranscodedView.as_view(), name="webhook-job-transcoded"),
    path("webhook/job/<str:job_id>/audio-features", WebhookJobAudioFeaturesView.as_view(), name="webhook-job-audio-features"),
    path("webhook/job/<str:job_id>/save-recommendation", WebhookJobSaveRecommendationView.as_view(), name="webhook-job-save-recommendation"),
    path("webhook/job/<str:job_id>/save-search", WebhookJobSaveSearchView.as_view(), name="webhook-job-save-search"),
    path("webhook/job/<str:job_id>/finalize", WebhookJobFinalizeView.as_view(), name="webhook-job-finalize"),
    path("webhook/job/<str:job_id>/failed", WebhookJobFailedView.as_view(), name="webhook-job-failed"),
    path("webhook/job/<str:job_id>", WebhookJobDetailView.as_view(), name="webhook-job-detail"),

    # Shorts ke callbacks (/webhook/short/*)
    path("webhook/short/<str:short_id>/processed", WebhookShortProcessedView.as_view(), name="webhook-short-processed"),
    path("webhook/short/<str:short_id>/failed", WebhookShortFailedView.as_view(), name="webhook-short-failed"),

    # Delete chain ke callbacks (/webhook/delete/*)
    path("webhook/delete/<str:entity_type>/<str:entity_id>/delete-search", WebhookDeleteSearchView.as_view(), name="webhook-delete-search"),
    path("webhook/delete/<str:entity_type>/<str:entity_id>/delete-recommendation", WebhookDeleteRecommendationView.as_view(), name="webhook-delete-recommendation"),
    path("webhook/delete/<str:entity_type>/<str:entity_id>/delete-imagekit", WebhookDeleteImageKitView.as_view(), name="webhook-delete-imagekit"),
    path("webhook/delete/<str:entity_type>/<str:entity_id>/delete-s3", WebhookDeleteS3View.as_view(), name="webhook-delete-s3"),
    path("webhook/delete/<str:entity_type>/<str:entity_id>/hard-delete", WebhookDeleteHardDeleteView.as_view(), name="webhook-delete-hard-delete"),
    path("webhook/delete/<str:entity_type>/<str:entity_id>/failed", WebhookDeleteFailedView.as_view(), name="webhook-delete-failed"),
]
