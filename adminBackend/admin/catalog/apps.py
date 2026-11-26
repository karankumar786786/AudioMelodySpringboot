"""catalog app ka Django config (ready() me signals jodta hai)."""
from django.apps import AppConfig


class CatalogConfig(AppConfig):
    """'catalog' app ka config."""
    default_auto_field = "django.db.models.BigAutoField"
    name = "catalog"
    verbose_name = "Music Catalog & Media"

    def ready(self):
        """App load hone par signals import karo taaki song save hone par outbox event bane."""
        from catalog import signals  # noqa: F401  (import karte hi outbox wale receivers register ho jaate hain)
