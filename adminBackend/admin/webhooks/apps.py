"""webhooks app ka Django config."""
from django.apps import AppConfig


class WebhooksConfig(AppConfig):
    """Django ko batata hai ki 'webhooks' naam ka app hai."""
    default_auto_field = "django.db.models.BigAutoField"
    name = "webhooks"
    verbose_name = "Core Engine & Worker Webhooks"
