"""
Backwards compatibility facade for sync_pagination_metadata.
Moved to jobs.management.commands.sync_pagination_metadata
"""
# pyrefly: ignore[missing-import]
from jobs.management.commands.sync_pagination_metadata import Command

__all__ = ["Command"]
