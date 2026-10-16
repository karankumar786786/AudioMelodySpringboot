"""
Backwards compatibility facade for RecombeeService.
Moved to core.services.recombee_service
"""
# pyrefly: ignore[missing-import]
from core.services.recombee_service import RecombeeService

__all__ = ["RecombeeService"]
