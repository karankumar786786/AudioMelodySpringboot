"""jobs app ka Django config."""
from django.apps import AppConfig


class JobsConfig(AppConfig):
    """Django ko batata hai ki 'jobs' naam ka app hai."""
    default_auto_field = "django.db.models.BigAutoField"
    name = "jobs"
    verbose_name = "Background Ingestion & Deletion Pipelines"
