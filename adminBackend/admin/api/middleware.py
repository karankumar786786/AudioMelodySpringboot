"""Purane imports ke liye "facade" (sirf aage bhejta hai). Asli code ab core.middleware me hai."""
from core.middleware import SecurityHeadersAndAuditMiddleware

__all__ = ["SecurityHeadersAndAuditMiddleware"]
