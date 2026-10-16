"""
Backwards compatibility facade for authentication.
Distributed to core.authentication.
"""
from core.authentication import (
    AdminJWTAuthentication,
    AdminSessionAuthentication,
    AdminUser,
    IsAdminUserPermission,
    IsSuperAdminUserPermission,
)

__all__ = [
    "AdminUser",
    "AdminSessionAuthentication",
    "AdminJWTAuthentication",
    "IsAdminUserPermission",
    "IsSuperAdminUserPermission",
]
