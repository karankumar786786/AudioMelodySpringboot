"""Purane imports ke liye "facade" (sirf aage bhejta hai). Asli code ab core.services.redis_service me hai."""
# pyrefly: ignore[missing-import]
from core.services.redis_service import RedisService

__all__ = ["RedisService"]
