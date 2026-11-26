"""Purane imports ke liye "facade" (sirf aage bhejta hai). Asli code ab accounts.management.commands.createsuperadmin me hai."""
# pyrefly: ignore[missing-import]
from accounts.management.commands.createsuperadmin import Command

__all__ = ["Command"]
