"""
Backwards compatibility facade for createsuperadmin.
Moved to accounts.management.commands.createsuperadmin
"""
# pyrefly: ignore[missing-import]
from accounts.management.commands.createsuperadmin import Command

__all__ = ["Command"]
