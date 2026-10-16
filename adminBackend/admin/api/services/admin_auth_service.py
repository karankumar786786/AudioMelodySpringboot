"""
Backwards compatibility facade for AdminAuthService.
Moved to core.services.admin_auth_service
"""
# pyrefly: ignore[missing-import]
from core.services.admin_auth_service import AdminAuthService

__all__ = ["AdminAuthService"]
