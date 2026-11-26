from django.apps import AppConfig


class CoreConfig(AppConfig):
    """Django ko core app ke baare me batata hai."""
    default_auto_field = "django.db.models.BigAutoField"
    name = "core"
    verbose_name = "Core Engine & Shared Utilities"
