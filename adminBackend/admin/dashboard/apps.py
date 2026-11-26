from django.apps import AppConfig


class DashboardConfig(AppConfig):
    """Django ko batata hai ki 'dashboard' naam ka app hai."""
    default_auto_field = "django.db.models.BigAutoField"
    name = "dashboard"
    verbose_name = "System Analytics, Metrics & Search"
