"""Purane imports ke liye "facade" (sirf aage bhejta hai). Asli code ab jobs.management.commands.sync_pagination_metadata me hai."""
# pyrefly: ignore[missing-import]
from jobs.management.commands.sync_pagination_metadata import Command

__all__ = ["Command"]
