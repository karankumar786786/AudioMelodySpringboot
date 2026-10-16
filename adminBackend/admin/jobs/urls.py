from django.urls import path
from .views import (
    DeleteJobActiveView,
    DeleteJobDetailView,
    DeleteJobListView,
    DeleteJobRetryView,
    DeleteJobSummaryView,
    JobActiveView,
    JobDeleteAllFailedView,
    JobDetailView,
    JobListView,
    JobQueuesView,
    JobRecoverMediaView,
    JobRetryView,
    JobSummaryView,
    JobSyncMetadataView,
)

app_name = "jobs"

urlpatterns = [
    # Jobs (static routes first)
    path("admin/jobs/summary", JobSummaryView.as_view(), name="admin-jobs-summary"),
    path("admin/jobs/queues", JobQueuesView.as_view(), name="admin-jobs-queues"),
    path("admin/jobs/active", JobActiveView.as_view(), name="admin-jobs-active"),
    path("admin/jobs/sync-metadata", JobSyncMetadataView.as_view(), name="admin-jobs-sync-metadata"),
    path("admin/sync-metadata", JobSyncMetadataView.as_view(), name="admin-sync-metadata"),
    path("admin/metadata/sync", JobSyncMetadataView.as_view(), name="admin-metadata-sync"),
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
]
