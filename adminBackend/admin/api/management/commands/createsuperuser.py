"""
Backwards compatibility facade for createsuperuser.
Moved to accounts.management.commands.createsuperuser
"""
# pyrefly: ignore[missing-import]
from accounts.management.commands.createsuperuser import Command

__all__ = ["Command"]
