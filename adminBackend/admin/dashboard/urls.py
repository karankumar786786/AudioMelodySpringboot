from django.urls import path
from .views import DashboardStatsView, GlobalSearchView, HealthCheckView, SystemHealthView, TelemetryHeartbeatView

app_name = "dashboard"

urlpatterns = [
    # Health checks
    path("health", HealthCheckView.as_view(), name="health"),
    path("api/health", HealthCheckView.as_view(), name="api-health"),

    # Telemetry & Heartbeat (audioProcessing -> adminBackend)
    path("api/telemetry/heartbeat", TelemetryHeartbeatView.as_view(), name="api-telemetry-heartbeat"),
    path("webhook/telemetry/heartbeat", TelemetryHeartbeatView.as_view(), name="webhook-telemetry-heartbeat"),

    # System Health & CPU Telemetry (adminBackend -> adminFrontend)
    path("admin/system/health", SystemHealthView.as_view(), name="admin-system-health"),
    path("api/system/health", SystemHealthView.as_view(), name="api-system-health"),

    # Search
    path("api/search", GlobalSearchView.as_view(), name="api-search"),
    path("admin/search", GlobalSearchView.as_view(), name="admin-search"),

    # Dashboard
    path("admin/dashboard/stats", DashboardStatsView.as_view(), name="admin-dashboard-stats"),
]

