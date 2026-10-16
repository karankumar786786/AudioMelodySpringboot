from django.urls import path
from .views import DashboardStatsView, GlobalSearchView, HealthCheckView

app_name = "dashboard"

urlpatterns = [
    # Health checks
    path("health", HealthCheckView.as_view(), name="health"),
    path("api/health", HealthCheckView.as_view(), name="api-health"),

    # Search
    path("api/search", GlobalSearchView.as_view(), name="api-search"),
    path("admin/search", GlobalSearchView.as_view(), name="admin-search"),

    # Dashboard
    path("admin/dashboard/stats", DashboardStatsView.as_view(), name="admin-dashboard-stats"),
]
