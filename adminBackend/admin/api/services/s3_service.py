"""
Backwards compatibility facade for S3Service.
Moved to core.services.s3_service
"""
# pyrefly: ignore[missing-import]
from core.services.s3_service import S3Service

__all__ = ["S3Service"]
