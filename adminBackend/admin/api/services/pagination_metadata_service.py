"""
Backwards compatibility facade for PaginationMetadataService.
Moved to core.services.pagination_metadata_service
"""
# pyrefly: ignore[missing-import]
from core.services.pagination_metadata_service import PaginationMetadataService

__all__ = ["PaginationMetadataService"]
