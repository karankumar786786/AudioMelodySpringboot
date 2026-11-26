"""Purane imports ke liye "facade" (sirf aage bhejta hai). Asli code ab core.services.imagekit_service me hai."""
# pyrefly: ignore[missing-import]
from core.services.imagekit_service import ImageKitService

__all__ = ["ImageKitService"]
