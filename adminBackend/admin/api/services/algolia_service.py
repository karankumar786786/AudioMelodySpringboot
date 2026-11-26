"""Purane imports ke liye "facade" (sirf aage bhejta hai). Asli code ab core.services.algolia_service me hai."""
# pyrefly: ignore[missing-import]
from core.services.algolia_service import AlgoliaService

__all__ = ["AlgoliaService"]
