import logging
import time
from django.conf import settings

logger = logging.getLogger("security.audit")


class SecurityHeadersAndAuditMiddleware:
    """
    1. Sets strict production-grade security headers on every response.
    2. Logs structured audit events for administrative operations and security anomalies.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        start_time = time.time()

        # Capture client IP
        x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
        if x_forwarded_for:
            ip = x_forwarded_for.split(",")[0].strip()
        else:
            ip = request.META.get("REMOTE_ADDR", "unknown")

        response = self.get_response(request)

        duration_ms = int((time.time() - start_time) * 1000)

        # Apply Hardened Security Headers
        response["X-Content-Type-Options"] = "nosniff"
        response["X-Frame-Options"] = "DENY"
        response["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response["Permissions-Policy"] = "geolocation=(), microphone=(), camera=(), payment=()"
        response["Content-Security-Policy"] = "default-src 'self'; frame-ancestors 'none';"

        # HSTS when using HTTPS or non-DEBUG
        if request.is_secure() or not settings.DEBUG:
            response["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"

        # Audit Logging
        user_info = "anonymous"
        user = getattr(request, "user", None)
        if user and getattr(user, "is_authenticated", False):
            user_info = f"{getattr(user, 'email', 'unknown')} ({getattr(user, 'role', 'USER')})"

        method = request.method
        path = request.path
        status_code = response.status_code

        # Audit log classification
        if status_code in (401, 403):
            logger.warning(
                "[SECURITY ALERT] Unauthorized access attempt: %s %s | IP: %s | User: %s | Status: %d | Duration: %dms",
                method, path, ip, user_info, status_code, duration_ms
            )
        elif method in ("POST", "PUT", "PATCH", "DELETE"):
            logger.info(
                "[AUDIT ACTION] Admin mutation: %s %s | IP: %s | Actor: %s | Status: %d | Duration: %dms",
                method, path, ip, user_info, status_code, duration_ms
            )
        elif status_code >= 500:
            logger.error(
                "[SERVER ERROR] Request failed: %s %s | IP: %s | Actor: %s | Status: %d | Duration: %dms",
                method, path, ip, user_info, status_code, duration_ms
            )

        return response
