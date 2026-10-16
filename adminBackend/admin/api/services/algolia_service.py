"""
Backwards compatibility facade for AlgoliaService.
Moved to core.services.algolia_service
"""
# pyrefly: ignore[missing-import]
from core.services.algolia_service import AlgoliaService

__all__ = ["AlgoliaService"]
