import jwt
from django.conf import settings
from rest_framework import authentication, exceptions, permissions


class AdminUser:
    """Lightweight user representation from validated JWT claims."""
    def __init__(self, user_id: str, email: str, role: str, user_name: str = ""):
        self.id = user_id
        self.email = email
        self.role = role
        self.userName = user_name
        self.is_authenticated = True

    @property
    def is_admin(self) -> bool:
        return self.role in ("ADMIN", "SUPER_ADMIN")

    def __str__(self):
        return f"{self.email} ({self.role})"


class AdminJWTAuthentication(authentication.BaseAuthentication):
    """
    Validates HMAC-SHA256 JWT tokens created by CoreEngine / auth system.
    Extracts user_id, email, and role from token claims.
    """
    def authenticate(self, request):
        # Check for Internal API Key header
        api_key = request.headers.get("X-API-KEY") or request.headers.get("X-APPLICATION-API-KEY") or request.headers.get("api-key")
        expected_keys = [
            getattr(settings, "AUDIO_PROCESSING_API_KEY", None),
            getattr(settings, "APPLICATION_API_KEY", None),
        ]
        expected_keys = [k for k in expected_keys if k]
        if api_key and api_key in expected_keys:
            user = AdminUser(user_id="system-api", email="system@internal", role="ADMIN", user_name="Internal Service")
            return (user, api_key)

        auth_header = request.headers.get("Authorization")
        if not auth_header:
            return None

        parts = auth_header.split()
        if len(parts) != 2 or parts[0].lower() != "bearer":
            return None

        token = parts[1]
        try:
            payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
        except jwt.ExpiredSignatureError:
            raise exceptions.AuthenticationFailed("Token has expired")
        except jwt.InvalidTokenError as e:
            raise exceptions.AuthenticationFailed(f"Invalid token: {str(e)}")

        user_id = payload.get("id") or payload.get("sub", "")
        email = payload.get("email", "")
        role = payload.get("role", "USER")
        user_name = payload.get("userName", "")

        user = AdminUser(user_id=user_id, email=email, role=role, user_name=user_name)
        return (user, token)


class IsAdminUserPermission(permissions.BasePermission):
    """
    Allows access only to authenticated users with ADMIN or SUPER_ADMIN role.
    """
    def has_permission(self, request, view):
        if not request.user or not getattr(request.user, "is_authenticated", False):
            return False
        return getattr(request.user, "is_admin", False)

