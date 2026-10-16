"""
Backwards compatibility facade for RedisService.
Moved to core.services.redis_service
"""
# pyrefly: ignore[missing-import]
from core.services.redis_service import RedisService

__all__ = ["RedisService"]
