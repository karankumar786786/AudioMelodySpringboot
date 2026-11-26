"""Admin API ka login check (Redis sessions) aur permissions.
Flow: request -> AdminSessionAuthentication (session dhoondo) -> IsAdminUserPermission (role check) -> view.
"""
import hmac
import logging
from django.conf import settings
from rest_framework import authentication, exceptions, permissions
from .services import RedisService

logger = logging.getLogger(__name__)


def _get_admin_model():
    """AdminUser model lazily import karo (circular import se bachne ke liye)."""
    from django.apps import apps
    try:
        return apps.get_model("accounts", "Admin")
    except Exception:
        # pyrefly: ignore[missing-import]
        from accounts.models import Admin
        return Admin


def _matches_any_key(provided: str, expected_keys) -> bool:
    """Har configured key se "constant-time" compare (beech me ruke bina), taaki time naap ke key ka andaza na lage."""
    provided_b = provided.encode("utf-8")
    matched = False
    for key in expected_keys:
        if hmac.compare_digest(provided_b, str(key).encode("utf-8")):
            matched = True
    return matched


class AdminUser:
    """Redis session se bana halka sa "user" object (DB model nahi) - request.user isi ka hota hai."""
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
        """ADMIN ya SUPER_ADMIN hai?"""
        return self.role in ("ADMIN", "SUPER_ADMIN")

    @property
    def is_super_admin(self) -> bool:
        """SUPER_ADMIN hai?"""
        return self.role == "SUPER_ADMIN"

    def __str__(self):
        return f"{self.email} ({self.role})"


class AdminSessionAuthentication(authentication.BaseAuthentication):
    """Admin login check: Redis me rakhe session se (JWT nahi, sirf Redis session).
    Session ID in jagahon se le sakte hain:
    1. X-Session-Id header (ya X-Admin-Session / Session-Id)
    2. Authorization header ("Session <id>" ya "Bearer <id>")
    3. HttpOnly cookie ("admin_session" ya "session_id")
    Media pipeline jaisi services X-API-KEY header se aati hain.
    """

    def authenticate_header(self, request):
        """401 response ka WWW-Authenticate header."""
        return 'Session realm="admin"'

    def authenticate(self, request):
        # 1. Andar ki service ka API key header (service-to-service, jaise media pipeline)
        """Request se admin pehchaano: API key -> session id -> Redis session -> blacklist -> DB me admin ki halat.
        Sab theek ho to (user, session) lautata hai; nahi to AuthenticationFailed (401).
        """
        api_key = (
            request.headers.get("X-API-KEY")
            or request.headers.get("X-APPLICATION-API-KEY")
            or request.headers.get("api-key")
        )
        expected_keys = [
            getattr(settings, "AUDIO_PROCESSING_API_KEY", None),
            getattr(settings, "APPLICATION_API_KEY", None),
        ]
        expected_keys = [k for k in expected_keys if k]
        if api_key and _matches_any_key(api_key, expected_keys):
            # Services (audioProcessing webhooks) ko sirf ADMIN level chahiye;
            # SUPER_ADMIN sirf insaan admins ke liye rakha hai.
            user = AdminUser(
                user_id="system-api",
                email="system@internal",
                role="ADMIN",
                user_name="Internal Service Worker",
                status="ACTIVE"
            )
            return (user, api_key)

        # 2. Session ID nikalo (header cookie se pehle dekha jaata hai)
        session_id = (
            request.headers.get("X-Session-Id")
            or request.headers.get("X-Admin-Session")
            or request.headers.get("Session-Id")
        )

        if not session_id:
            auth_header = request.headers.get("Authorization")
            if auth_header:
                parts = auth_header.split()
                if len(parts) == 2 and parts[0].lower() in ("session", "bearer", "token"):
                    session_id = parts[1]

        if not session_id:
            session_id = request.COOKIES.get("admin_session") or request.COOKIES.get("session_id")

        if not session_id:
            return None

        # 3. Redis me session dhoondo
        session = RedisService.get_admin_session(session_id)
        if not session:
            raise exceptions.AuthenticationFailed("Admin session has expired or is invalid. Please log in again.")

        user_id = session.get("userId", "")
        email = session.get("email", "")
        role = session.get("role", "ADMIN")
        user_name = session.get("userName", "")
        status_val = session.get("status", "ACTIVE")

        # 4. Redis blacklist check (blocked user?)
        if user_id and RedisService.is_user_blocked(user_id):
            logger.warning("Blocked user [%s - %s] attempted admin request", user_id, email)
            raise exceptions.AuthenticationFailed("Your account has been blocked or suspended.")

        if status_val == "BLOCKED":
            raise exceptions.AuthenticationFailed("Your account has been blocked or suspended.")

        # 5. Postgres ki admin_users table me admin ki halat check karo
        if user_id or email:
            try:
                Admin = _get_admin_model()
                db_admin = None
                if user_id:
                    db_admin = Admin.objects.filter(id=user_id).first()
                if not db_admin and email:
                    db_admin = Admin.objects.filter(email__iexact=email).first()

                if db_admin and isinstance(db_admin, Admin):
                    if getattr(db_admin, "status", "ACTIVE") == "BLOCKED":
                        RedisService.block_user_in_redis(db_admin.id)
                        raise exceptions.AuthenticationFailed("Your account has been blocked or suspended.")
                    # Role badla ho (promote / demote) to turant wahi maano
                    role = db_admin.role
                    user_id = db_admin.id
                    email = db_admin.email
                    user_name = getattr(db_admin, "name", None) or user_name
                    status_val = getattr(db_admin, "status", "ACTIVE")
            except exceptions.AuthenticationFailed:
                raise
            except Exception as e:
                logger.debug("Database admin lookup during auth skipped: %s", e)

        # 6. Session ki expiry aage badhao aur request me user set karo
        RedisService.touch_admin_session(session_id, session=session)
        request.session_id = session_id

        user = AdminUser(
            user_id=user_id,
            email=email,
            role=role,
            user_name=user_name,
            status=status_val
        )
        return (user, session_id)


# Purane code ke liye doosra naam
AdminJWTAuthentication = AdminSessionAuthentication


class IsAdminUserPermission(permissions.BasePermission):
    """Sirf ADMIN ya SUPER_ADMIN role wale logged-in users ko aane do."""
    def has_permission(self, request, view) -> bool:
        """Logged-in aur ADMIN/SUPER_ADMIN?"""
        if not request.user or not getattr(request.user, "is_authenticated", False):
            return False
        return bool(getattr(request.user, "is_admin", False))


class IsSuperAdminUserPermission(permissions.BasePermission):
    """Sirf SUPER_ADMIN ko aane do - khatarnaak kaam (jaise doosre admins sambhalna) ke liye."""
    def has_permission(self, request, view) -> bool:
        """Logged-in aur SUPER_ADMIN?"""
        if not request.user or not getattr(request.user, "is_authenticated", False):
            return False
        return bool(getattr(request.user, "is_super_admin", False))
