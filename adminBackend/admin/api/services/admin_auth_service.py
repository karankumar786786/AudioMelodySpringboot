"""Purane imports ke liye "facade" (sirf aage bhejta hai). Asli code ab core.services.admin_auth_service me hai."""
# pyrefly: ignore[missing-import]
from core.services.admin_auth_service import AdminAuthService

__all__ = ["AdminAuthService"]
