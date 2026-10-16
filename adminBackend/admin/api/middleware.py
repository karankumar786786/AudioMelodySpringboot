"""
Backwards compatibility facade for middleware.
Distributed to core.middleware.
"""
from core.middleware import SecurityHeadersAndAuditMiddleware

__all__ = ["SecurityHeadersAndAuditMiddleware"]
