from django.apps import AppConfig


class AccountsConfig(AppConfig):
    """Django ko batata hai ki 'accounts' naam ka app hai."""
    default_auto_field = "django.db.models.BigAutoField"
    name = "accounts"
    verbose_name = "Authentication & Accounts Management"
