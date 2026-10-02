import jwt
import logging
from django.conf import settings
from rest_framework import authentication, exceptions, permissions
from .models import User
from .services import RedisService

logger = logging.getLogger(__name__)


class AdminUser:
    """Lightweight user representation from validated JWT claims."""
    def __init__(self, user_id: str, email: str, role: str, user_name: str = "", status: str = "ACTIVE"):
        self.id = user_id
        self.pk = user_id
        self.email = email
        self.role = role
        self.userName = user_name
        self.status = status
        self.is_authenticated = True

    @property
    def is_admin(self) -> bool:
        return self.role in ("ADMIN", "SUPER_ADMIN")

    @property
    def is_super_admin(self) -> bool:
        return self.role == "SUPER_ADMIN"

    def __str__(self):
        return f"{self.email} ({self.role})"


class AdminJWTAuthentication(authentication.BaseAuthentication):
    """
    Validates HMAC-SHA256 JWT tokens created by CoreEngine / auth system.
    Extracts user_id, email, and role from token claims.
    Enforces real-time Redis and database blocklist verification.
    """
    def authenticate(self, request):
        # 1. Check for Internal API Key header (service-to-service)
        api_key = request.headers.get("X-API-KEY") or request.headers.get("X-APPLICATION-API-KEY") or request.headers.get("api-key")
        expected_keys = [
            getattr(settings, "AUDIO_PROCESSING_API_KEY", None),
            getattr(settings, "APPLICATION_API_KEY", None),
        ]
        expected_keys = [k for k in expected_keys if k]
        if api_key and api_key in expected_keys:
            user = AdminUser(
                user_id="system-api",
                email="system@internal",
                role="SUPER_ADMIN",
                user_name="Internal Service Worker",
                status="ACTIVE"
            )
            return (user, api_key)

        # 2. Check Bearer Authorization Token
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            return None

        parts = auth_header.split()
        if len(parts) != 2 or parts[0].lower() != "bearer":
            return None

        token = parts[1]
        try:
            payload = jwt.decode(
                token,
                settings.JWT_SECRET,
                algorithms=["HS256"],
                options={"verify_signature": True, "verify_exp": True}
            )
        except jwt.ExpiredSignatureError:
            raise exceptions.AuthenticationFailed("Authentication token has expired")
        except jwt.InvalidTokenError as e:
            raise exceptions.AuthenticationFailed(f"Invalid authentication token: {str(e)}")

        user_id = str(payload.get("id") or payload.get("sub", "")).strip()
        email = str(payload.get("email", "")).strip().lower()
        role = payload.get("role", "USER")
        user_name = payload.get("userName", "")
        status_val = "ACTIVE"

        # 3. Security: Check real-time Redis blacklist
        if user_id and RedisService.is_user_blocked(user_id):
            logger.warning("Blocked user [%s - %s] attempted admin request", user_id, email)
            raise exceptions.AuthenticationFailed("Your account has been blocked or suspended")

        # 4. Security: Check PostgreSQL database state
        if user_id or email:
            try:
                db_user = None
                if user_id:
                    db_user = User.objects.filter(id=user_id).first()
                if not db_user and email:
                    db_user = User.objects.filter(email__iexact=email).first()

                if db_user and isinstance(db_user, User):
                    if db_user.status == "BLOCKED":
                        RedisService.block_user_in_redis(db_user.id)
                        raise exceptions.AuthenticationFailed("Your account has been blocked or suspended")
                    # Dynamically reflect live role changes (promotion/demotion)
                    role = db_user.role
                    user_id = db_user.id
                    email = db_user.email
                    user_name = db_user.user_name or user_name
                    status_val = db_user.status
            except exceptions.AuthenticationFailed:
                raise
            except Exception as e:
                logger.debug("Database user lookup during auth skipped or mocked: %s", e)

        user = AdminUser(
            user_id=user_id,
            email=email,
            role=role,
            user_name=user_name,
            status=status_val
        )
        return (user, token)


class IsAdminUserPermission(permissions.BasePermission):
    """
    Allows access only to authenticated users with ADMIN or SUPER_ADMIN role.
    """
    def has_permission(self, request, view):
        if not request.user or not getattr(request.user, "is_authenticated", False):
            return False
        return getattr(request.user, "is_admin", False)


class IsSuperAdminUserPermission(permissions.BasePermission):
    """
    Allows access strictly to authenticated users with SUPER_ADMIN role.
    Used for destructive cluster operations and managing other administrators.
    """
    def has_permission(self, request, view):
        if not request.user or not getattr(request.user, "is_authenticated", False):
            return False
        return getattr(request.user, "is_super_admin", False)
