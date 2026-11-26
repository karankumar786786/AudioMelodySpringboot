"""Purane imports ke liye "facade" (sirf aage bhejta hai). Asli code ab accounts.management.commands.createsuperuser me hai."""
# pyrefly: ignore[missing-import]
from accounts.management.commands.createsuperuser import Command

__all__ = ["Command"]
