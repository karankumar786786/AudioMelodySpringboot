"""Purane imports ke liye "facade" (sirf aage bhejta hai). Asli code ab core.authentication me hai."""
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
