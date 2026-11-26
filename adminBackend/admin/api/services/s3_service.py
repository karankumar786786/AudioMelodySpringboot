"""Purane imports ke liye "facade" (sirf aage bhejta hai). Asli code ab core.services.s3_service me hai."""
# pyrefly: ignore[missing-import]
from core.services.s3_service import S3Service

__all__ = ["S3Service"]
