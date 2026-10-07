import jwt
import logging
from django.conf import settings
from rest_framework import authentication, exceptions, permissions
from .models import Admin
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
        self.name = user_name
        self.user_name = user_name
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
    Enforces real-time Redis and database blocklist verification against admin_users.
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

        # 2. Check HTTP-Only Cookie Session directly
        session_id = request.COOKIES.get("admin_session")
        if session_id:
            session = RedisService.get_admin_session(session_id)
            if not session:
                raise exceptions.AuthenticationFailed("Admin session has been revoked or expired. Please log in again.")

            user_id = session.get("userId", "")
            email = session.get("email", "")
            role = session.get("role", "ADMIN")
            user_name = session.get("userName", "")
            status_val = session.get("status", "ACTIVE")

            if user_id and RedisService.is_user_blocked(user_id):
                raise exceptions.AuthenticationFailed("Your account has been blocked or suspended")
            if status_val == "BLOCKED":
                raise exceptions.AuthenticationFailed("Your account has been blocked or suspended")

            RedisService.touch_admin_session(session_id)
            request.session_id = session_id

            user = AdminUser(
                user_id=user_id,
                email=email,
                role=role,
                user_name=user_name,
                status=status_val
            )
            return (user, session_id)

        # 3. Check Bearer Authorization Header OR access_token Cookie
        token = None
        auth_header = request.headers.get("Authorization")
        if auth_header:
            parts = auth_header.split()
            if len(parts) == 2 and parts[0].lower() == "bearer":
                token = parts[1]

        if not token:
            token = request.COOKIES.get("access_token")

        if not token:
            return None

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

        sid = payload.get("sid")
        if sid:
            session = RedisService.get_admin_session(sid)
            if not session:
                raise exceptions.AuthenticationFailed("Admin session has been revoked or expired. Please log in again.")
            if session.get("status") == "BLOCKED":
                raise exceptions.AuthenticationFailed("Your account has been blocked or suspended")
            RedisService.touch_admin_session(sid)
            request.session_id = sid

        user_id = str(payload.get("id") or payload.get("sub", "")).strip()
        email = str(payload.get("email", "")).strip().lower()
        role = payload.get("role", "USER")
        user_name = payload.get("userName") or payload.get("name", "")
        status_val = "ACTIVE"

        # Security: Check real-time Redis blacklist
        if user_id and RedisService.is_user_blocked(user_id):
            logger.warning("Blocked user [%s - %s] attempted admin request", user_id, email)
            raise exceptions.AuthenticationFailed("Your account has been blocked or suspended")

        # Security: Check PostgreSQL database state in admin_users table
        if user_id or email:
            try:
                db_admin = None
                if user_id:
                    db_admin = Admin.objects.filter(id=user_id).first()
                if not db_admin and email:
                    db_admin = Admin.objects.filter(email__iexact=email).first()

                if db_admin and isinstance(db_admin, Admin):
                    if db_admin.status == "BLOCKED":
                        RedisService.block_user_in_redis(db_admin.id)
                        raise exceptions.AuthenticationFailed("Your account has been blocked or suspended")
                    # Dynamically reflect live role changes (promotion/demotion)
                    role = db_admin.role
                    user_id = db_admin.id
                    email = db_admin.email
                    user_name = db_admin.name or user_name
                    status_val = db_admin.status
            except exceptions.AuthenticationFailed:
                raise
            except Exception as e:
                logger.debug("Database admin lookup during auth skipped or mocked: %s", e)

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
