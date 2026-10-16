"""
Backwards compatibility facade for ExternalJobDispatcher.
Moved to core.services.dispatcher_service
"""
# pyrefly: ignore[missing-import]
from core.services.dispatcher_service import ExternalJobDispatcher

__all__ = ["ExternalJobDispatcher"]
