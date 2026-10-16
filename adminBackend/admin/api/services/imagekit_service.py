"""
Backwards compatibility facade for ImageKitService.
Moved to core.services.imagekit_service
"""
# pyrefly: ignore[missing-import]
from core.services.imagekit_service import ImageKitService

__all__ = ["ImageKitService"]
