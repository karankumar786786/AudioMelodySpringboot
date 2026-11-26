"""accounts ke views (API endpoints): admin login (email + password -> OTP -> session), refresh, logout,
admin ke sessions, aur app users ko block / unblock / delete / admin banana.

Flow: admin dashboard -> yeh views -> AdminAuthService / RedisService (sessions Redis me) -> Postgres.
"""
import json
import logging
import uuid
from django.conf import settings
from django.db.models import Q
from core.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from core.authentication import IsSuperAdminUserPermission
from core.helpers import format_paginated_response
from core.services import (
    AdminAuthService,
    PaginationMetadataService,
    RecombeeService,
    RedisService,
)
from core.views import BaseAdminView
from .models import Admin, Session, User
from .serializers import AdminSerializer, UserSerializer, UserSessionSerializer

logger = logging.getLogger(__name__)


def set_auth_cookies(response: Response, session_id: str, refresh_session_id: str = "") -> None:
    """Response pe secure, HttpOnly login cookies lagao:
    - admin_session: Redis access session id
    - refresh_session: Redis refresh session id
    """
    is_secure = not settings.DEBUG
    # admin_session cookie (HttpOnly: browser ka JavaScript ise padh nahi sakta)
    response.set_cookie(
        key="admin_session",
        value=session_id,
        max_age=7 * 86400,
        httponly=True,
        secure=is_secure,
        samesite="Lax",
        path="/",
    )
    if refresh_session_id:
        response.set_cookie(
            key="refresh_session",
            value=refresh_session_id,
            max_age=30 * 86400,
            httponly=True,
            secure=is_secure,
            samesite="Lax",
            path="/",
        )
        response.set_cookie(
            key="refresh_token",
            value=refresh_session_id,
            max_age=30 * 86400,
            httponly=True,
            secure=is_secure,
            samesite="Lax",
            path="/",
        )


WEB_CLIENT_HEADER = "X-Admin-Client"
_SESSION_BODY_KEYS = ("sessionId", "refreshSessionId", "accessToken", "refreshToken")


def is_web_cookie_client(request) -> bool:
    """Admin website "X-Admin-Client: web" header bhejti hai aur HttpOnly cookies pe chalti hai - wahi check."""
    return (request.headers.get(WEB_CLIENT_HEADER) or "").strip().lower() == "web"


def session_body(request, tokens: dict) -> dict:
    """Website ke liye JSON body me session ids mat bhejo (cookies me hain); scripts ko inki zaroorat nahi."""
    if not is_web_cookie_client(request):
        return tokens
    return {k: v for k, v in tokens.items() if k not in _SESSION_BODY_KEYS}


def clear_auth_cookies(response: Response) -> None:
    """Saari admin login cookies mita do."""
    for key in ("admin_session", "session_id", "refresh_session", "refresh_token", "access_token"):
        response.delete_cookie(key, path="/", samesite="Lax")


# ==============================================================================
# Admin login aur sessions
# ==============================================================================

class AdminLoginView(APIView):
    """POST /auth/login
    Body: { "email": "...", "password": "..." }
    Check karta hai ki admin admin_users table me hai, phir OTP banata hai.
    Jawab: { "tempToken": "<tempToken>", "message": "OTP sent" }
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        """Email + password check karo, sahi ho to OTP bhejo aur tempToken lautao. Galat ho to error."""
        email = (request.data.get("email") or "").strip().lower()
        if not email:
            return Response({"message": "Email is required"}, status=status.HTTP_400_BAD_REQUEST)

        admin = Admin.objects.filter(email__iexact=email).first()
        if not admin:
            try:
                if Admin.objects.count() == 0:
                    return Response(
                        {
                            "message": "No administrator accounts registered yet. Please navigate to the Register tab to create the initial Super Administrator.",
                            "initialSetupRequired": True,
                        },
                        status=status.HTTP_404_NOT_FOUND,
                    )
            except Exception:
                pass
            return Response(
                {"message": f"No admin account found with email '{email}'. Please contact your super administrator."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if admin.status == "BLOCKED":
            return Response(
                {"message": "Your admin account has been suspended or blocked."},
                status=status.HTTP_403_FORBIDDEN,
            )

        otp = AdminAuthService.generate_otp()
        temp_token = AdminAuthService.create_temp_token(admin.email, purpose="LOGIN")
        AdminAuthService.save_otp(admin.email, {
            "otp": otp,
            "email": admin.email,
            "role": admin.role,
            "purpose": "LOGIN",
            "failed_attempts": 0,
            "max_attempts": 5,
        })
        AdminAuthService.notify_otp(admin.email, "LOGIN", otp)

        res = Response({
            "tempToken": temp_token,
            "message": "Verification code has been sent to your email.",
        }, status=status.HTTP_200_OK)
        clear_auth_cookies(res)
        return res


class AdminRegisterView(APIView):
    """POST /auth/register
    Body: { "userName": "...", "email": "...", "password": "..." }
    Naya admin OTP ke through register karna shuru karta hai.
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        """Naye admin ka data rakh ke OTP bhejo; asli account OTP verify hone par banta hai."""
        email = (request.data.get("email") or "").strip().lower()
        name = (request.data.get("userName") or request.data.get("name") or "").strip()

        if not email:
            return Response({"message": "Email is required"}, status=status.HTTP_400_BAD_REQUEST)
        if not name:
            return Response({"message": "Name is required"}, status=status.HTTP_400_BAD_REQUEST)

        if Admin.objects.filter(email__iexact=email).exists():
            return Response(
                {"message": f"An admin account with email '{email}' already exists. Please log in."},
                status=status.HTTP_409_CONFLICT,
            )

        # Sabse pehla admin apne aap SUPER_ADMIN banta hai, baaki ADMIN
        assigned_role = "SUPER_ADMIN" if Admin.objects.count() == 0 else "ADMIN"
        otp = AdminAuthService.generate_otp()
        temp_token = AdminAuthService.create_temp_token(email, purpose="REGISTER")
        AdminAuthService.save_otp(email, {
            "otp": otp,
            "email": email,
            "userName": name,
            "role": assigned_role,
            "purpose": "REGISTER",
            "failed_attempts": 0,
            "max_attempts": 5,
        })
        AdminAuthService.notify_otp(email, "REGISTER", otp)

        res = Response({
            "tempToken": temp_token,
            "message": "Registration verification code sent.",
        }, status=status.HTTP_201_CREATED)
        clear_auth_cookies(res)
        return res


class AdminVerifyOtpView(APIView):
    """POST /auth/verify-otp
    Header: X-TEMP-TOKEN: <tempToken> (ya body { "token": "..." }), Body: { "otp": "..." }
    OTP check, Redis session banao, HttpOnly cookies lagao,
    aur { "sessionId", "accessToken", "refreshToken" } lautao.
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        """OTP check karo; sahi ho to sessions banao, web app ke liye cookies lagao aur tokens lautao."""
        temp_token = (
            request.headers.get("X-TEMP-TOKEN")
            or request.headers.get("x-temp-token")
            or request.data.get("token")
            or request.data.get("tempToken")
            or ""
        ).strip()
        otp = str(request.data.get("otp", "")).strip()

        if not temp_token:
            return Response(
                {"message": "Temporary verification token is required in X-TEMP-TOKEN header."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not otp:
            return Response({"message": "OTP code is required."}, status=status.HTTP_400_BAD_REQUEST)

        decoded = AdminAuthService.decode_temp_token(temp_token)
        if not decoded:
            return Response(
                {"message": "Verification session has expired or is invalid. Please log in again."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        email = decoded.get("email")
        if not email:
            return Response(
                {"message": "Invalid verification session payload."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        otp_data = AdminAuthService.get_otp(email)
        if not otp_data:
            return Response(
                {"message": "Verification code has expired. Please request a new OTP."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        failed_attempts = otp_data.get("failed_attempts", 0)
        max_attempts = otp_data.get("max_attempts", 5)
        if failed_attempts >= max_attempts:
            AdminAuthService.delete_otp(email)
            return Response(
                {"message": "Maximum verification attempts exceeded. For security, this OTP has been invalidated. Please request a new OTP."},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        if str(otp_data.get("otp", "")).strip() != otp:
            failed_attempts += 1
            otp_data["failed_attempts"] = failed_attempts
            AdminAuthService.save_otp(email, otp_data)
            remaining = max_attempts - failed_attempts
            if remaining <= 0:
                AdminAuthService.delete_otp(email)
                return Response(
                    {"message": "Maximum verification attempts exceeded. For security, this OTP has been invalidated. Please request a new OTP."},
                    status=status.HTTP_429_TOO_MANY_REQUESTS,
                )
            return Response(
                {"message": f"Invalid verification code. {remaining} attempt(s) remaining."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        purpose = otp_data.get("purpose", "LOGIN")
        if purpose == "REGISTER":
            admin, _ = Admin.objects.get_or_create(
                email=email,
                defaults={
                    "id": str(uuid.uuid4()),
                    "name": otp_data.get("userName") or email.split("@")[0],
                    "role": otp_data.get("role", "ADMIN"),
                    "status": "ACTIVE",
                }
            )
        else:
            admin = Admin.objects.filter(email__iexact=email).first()
            if not admin:
                return Response({"message": "Admin account not found."}, status=status.HTTP_404_NOT_FOUND)
            if admin.status == "BLOCKED":
                return Response({"message": "Your admin account is suspended or blocked."}, status=status.HTTP_403_FORBIDDEN)

        AdminAuthService.delete_otp(email)
        tokens = AdminAuthService.issue_tokens_for_admin(admin, request)

        res = Response(session_body(request, tokens), status=status.HTTP_200_OK)
        set_auth_cookies(res, tokens["sessionId"], tokens["refreshSessionId"])
        return res


class AdminResendOtpView(APIView):
    """POST /auth/resend-otp
    Header: X-TEMP-TOKEN: <tempToken>
    Naya OTP bana ke dobara bhejo.
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        """Usi tempToken ke liye naya OTP bhejo."""
        temp_token = (
            request.headers.get("X-TEMP-TOKEN")
            or request.headers.get("x-temp-token")
            or request.data.get("token")
            or request.data.get("tempToken")
            or ""
        ).strip()

        if not temp_token:
            return Response({"message": "Missing temporary verification token."}, status=status.HTTP_400_BAD_REQUEST)

        decoded = AdminAuthService.decode_temp_token(temp_token)
        if not decoded:
            return Response({"message": "Verification session has expired."}, status=status.HTTP_400_BAD_REQUEST)

        email = decoded.get("email")
        if not email:
            return Response({"message": "Invalid verification session payload."}, status=status.HTTP_400_BAD_REQUEST)

        purpose = decoded.get("purpose", "LOGIN")
        cached = AdminAuthService.get_otp(email) or {"email": email, "purpose": purpose}

        new_otp = AdminAuthService.generate_otp()
        cached["otp"] = new_otp
        cached["failed_attempts"] = 0
        cached["max_attempts"] = 5
        AdminAuthService.save_otp(email, cached)
        AdminAuthService.notify_otp(email, purpose, new_otp)

        return Response({
            "tempToken": temp_token,
            "message": "New OTP sent successfully.",
        }, status=status.HTTP_200_OK)


class AdminRefreshTokenView(APIView):
    """POST /auth/refresh-token
    refreshSessionId HttpOnly cookie se ya body { "refreshSessionId": "..." } se.
    Redis me refresh session check karke naye active sessions ka joda deta hai.
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        """Refresh session valid ho to purane band karke naya joda (access + refresh) do."""
        refresh_id = (
            request.COOKIES.get("refresh_session")
            or request.COOKIES.get("refresh_token")
            or request.data.get("refreshSessionId")
            or request.data.get("refreshToken")
            or ""
        ).strip()
        if not refresh_id:
            res = Response({"message": "Refresh session ID is required."}, status=status.HTTP_400_BAD_REQUEST)
            clear_auth_cookies(res)
            return res

        refresh_data = RedisService.get_refresh_session(refresh_id)
        if not refresh_data:
            res = Response({"message": "Refresh session has expired or is invalid. Please log in again."}, status=status.HTTP_401_UNAUTHORIZED)
            clear_auth_cookies(res)
            return res

        user_id = refresh_data.get("userId")
        email = refresh_data.get("email")
        old_sid = refresh_data.get("sessionId")

        # Purana access session band karo
        if old_sid:
            RedisService.revoke_admin_session(old_sid)

        admin = None
        if user_id:
            admin = Admin.objects.filter(id=user_id).first()
        if not admin and email:
            admin = Admin.objects.filter(email__iexact=email).first()

        if not admin or admin.status == "BLOCKED":
            RedisService.revoke_refresh_session(refresh_id)
            res = Response({"message": "Admin session revoked or account suspended."}, status=status.HTTP_403_FORBIDDEN)
            clear_auth_cookies(res)
            return res

        # Rotation: purana refresh session band aur naya joda do
        RedisService.revoke_refresh_session(refresh_id)
        tokens = AdminAuthService.issue_tokens_for_admin(admin, request)
        res = Response(session_body(request, tokens), status=status.HTTP_200_OK)
        set_auth_cookies(res, tokens["sessionId"], tokens["refreshSessionId"])
        return res


class AdminProfileView(BaseAdminView):
    """
    GET /api/user/profile (aur /admin/auth/profile, /admin/auth/me)
    PATCH /api/user/profile
    Logged-in admin ka apna profile dekhna aur badalna.
    """
    def get(self, request):
        """Logged-in admin ka profile lautao."""
        user = request.user
        last_login = None
        if getattr(request, "session_id", None) not in RedisService._MEMORY_SESSIONS:
            try:
                r = RedisService.get_client()
                raw = r.get(f"admin:last_login:{user.email.lower()}")
                if raw:
                    last_login = json.loads(raw)
            except Exception:
                pass

        body = {
            "id": user.id,
            "email": user.email,
            "userName": getattr(user, "userName", "") or getattr(user, "name", "") or getattr(user, "user_name", ""),
            "name": getattr(user, "userName", "") or getattr(user, "name", "") or getattr(user, "user_name", ""),
            "role": user.role,
            "status": user.status,
            "sessionId": getattr(request, "session_id", None),
            "lastLogin": last_login,
        }
        return Response(session_body(request, body), status=status.HTTP_200_OK)

    def patch(self, request):
        """Logged-in admin ka naam jaisi profile fields badlo."""
        user = request.user
        admin = Admin.objects.filter(id=user.id).first()
        if not admin and user.email:
            admin = Admin.objects.filter(email__iexact=user.email).first()
        if not admin:
            return Response({"message": "Admin profile not found"}, status=status.HTTP_404_NOT_FOUND)

        new_name = (request.data.get("name") or request.data.get("userName") or "").strip()
        if new_name:
            admin.name = new_name
            admin.save()
            sid = getattr(request, "session_id", None)
            if sid:
                RedisService.update_session_user_name(sid, new_name)

        return Response({
            "id": admin.id,
            "email": admin.email,
            "userName": admin.name or "",
            "name": admin.name or "",
            "role": admin.role,
            "status": admin.status,
            "message": "Profile updated successfully.",
        }, status=status.HTTP_200_OK)


class AdminLogoutView(APIView):
    """POST /auth/logout
    Redis session turant band aur login cookies saaf.
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        """Is admin ka session band karo aur cookies hatao."""
        session_id = (
            request.headers.get("X-Session-Id")
            or request.headers.get("X-Admin-Session")
            or request.COOKIES.get("admin_session")
            or getattr(request, "session_id", None)
        )
        if not session_id:
            auth_header = request.headers.get("Authorization")
            if auth_header:
                parts = auth_header.split()
                if len(parts) == 2:
                    session_id = parts[1]

        refresh_id = (
            request.COOKIES.get("refresh_session")
            or request.COOKIES.get("refresh_token")
            or request.data.get("refreshSessionId")
            or request.data.get("refreshToken")
        )

        if session_id:
            RedisService.revoke_admin_session(session_id)
        if refresh_id:
            RedisService.revoke_refresh_session(refresh_id)

        res = Response({"message": "Logged out successfully"}, status=status.HTTP_200_OK)
        clear_auth_cookies(res)
        return res


class AdminSessionsListView(BaseAdminView):
    """GET /admin/auth/sessions
    Is admin ke saare active Redis sessions.
    """
    def get(self, request):
        """Is admin ke saare active sessions lautao."""
        user = request.user
        current_sid = getattr(request, "session_id", None) or request.COOKIES.get("admin_session")
        sessions = RedisService.list_user_sessions(user.email, current_session_id=current_sid)
        return Response({"sessions": sessions}, status=status.HTTP_200_OK)


class AdminSessionRevokeView(BaseAdminView):
    """DELETE /admin/auth/sessions/<session_id> - ek session band karo.
    POST /admin/auth/sessions/revoke-all - is wale ko chhod ke baaki sab band.
    """
    def delete(self, request, session_id):
        """Ek session_id wala session band karo."""
        user = request.user
        sess = RedisService.get_admin_session(session_id)
        if sess and sess.get("email", "").lower() != user.email.lower() and not getattr(user, "is_super_admin", False):
            return Response({"error": "Cannot revoke another admin's session"}, status=status.HTTP_403_FORBIDDEN)

        RedisService.revoke_admin_session(session_id)
        return Response({"message": f"Session {session_id} revoked successfully"}, status=status.HTTP_200_OK)

    def post(self, request):
        """Abhi wale session ko chhod ke baaki saare band karo."""
        user = request.user
        current_sid = getattr(request, "session_id", None) or request.COOKIES.get("admin_session")
        revoked = RedisService.revoke_all_admin_sessions(user.email, except_session_id=current_sid)
        return Response({"message": f"Revoked {revoked} session(s). Current session preserved."}, status=status.HTTP_200_OK)


# ==============================================================================
# App users ke accounts sambhalne wale views
# ==============================================================================

class AccountListView(BaseAdminView):
    """GET /admin/account - app users ki list (search, role, status filter ke saath)."""
    def get(self, request):
        """Filters lagao aur page karo. Koi filter na ho to total count pagination metadata se
        (sasta), filter ho to asli COUNT query se.
        """
        page = int(request.query_params.get("page", 0))
        size = int(request.query_params.get("size", 20))
        search = (request.query_params.get("search") or "").strip()
        role = (request.query_params.get("role") or "").strip()
        status_param = (request.query_params.get("status") or "").strip()
        offset = page * size

        qs = User.objects.all()
        if search:
            qs = qs.filter(Q(email__icontains=search) | Q(user_name__icontains=search))
        if role and role.upper() != "ALL":
            target_role = role.upper()
            if target_role in ("ADMIN", "SUPER_ADMIN"):
                admin_emails = Admin.objects.filter(role=target_role).values_list("email", flat=True)
                qs = qs.filter(email__in=admin_emails)
            elif target_role == "USER":
                all_admin_emails = Admin.objects.values_list("email", flat=True)
                qs = qs.exclude(email__in=all_admin_emails)
        if status_param and status_param.upper() != "ALL":
            qs = qs.filter(status=status_param.upper())

        has_filters = bool(search or (role and role.upper() != "ALL") or (status_param and status_param.upper() != "ALL"))
        meta = PaginationMetadataService.get_metadata("UsersEntity")

        total_count = qs.count() if has_filters else (meta.total_count if (meta and meta.total_count > 0) else qs.count())
        users = list(qs.order_by("-created_at")[offset : offset + size])

        meta_dict = {
            "id": meta.id if meta else "UsersEntity",
            "entityName": "UsersEntity",
            "totalCount": total_count,
            "activeCount": meta.active_count if meta else total_count,
            "blockedCount": meta.blocked_count if meta else 0,
            "deletedCount": meta.deleted_count if meta else 0,
        }

        return Response(
            format_paginated_response(UserSerializer(users, many=True).data, page, size, meta_dict),
            status=status.HTTP_200_OK,
        )


class AccountDeleteView(BaseAdminView):
    """DELETE (ya POST) /admin/account/<email>/delete - user ko poora hatao (sirf Super Admin)."""
    permission_classes = [IsSuperAdminUserPermission]

    def delete(self, request, email):
        """Super Admin khud ko delete nahi kar sakta (400). Recombee, sessions, Redis block,
        counter aur admin row ke baad user row hatao. Output: 204.
        """
        user = get_object_or_404(User, email=email)
        admin_rec = Admin.objects.filter(email=email).first()
        if admin_rec and admin_rec.role == "SUPER_ADMIN" and user.id == request.user.id:
            return Response({"error": "Super Admin cannot delete their own account"}, status=status.HTTP_400_BAD_REQUEST)
        RecombeeService.delete_user(user.id)
        Session.objects.filter(user=user).delete()
        RedisService.block_user_in_redis(user.id)
        PaginationMetadataService.decrement_status("UsersEntity", user.status)
        if admin_rec:
            admin_rec.delete()
        user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    def post(self, request, email):
        """POST bhi DELETE jaisa hi chalta hai."""
        return self.delete(request, email)


class AccountUpgradeView(BaseAdminView):
    """POST /admin/account/<email> - user ko ADMIN banao (sirf Super Admin). DELETE = user delete."""
    permission_classes = [IsSuperAdminUserPermission]

    def post(self, request, email):
        """Pehle se admin ho to 409. Warna admin_users me ACTIVE ADMIN row banao / update karo. Output: 202."""
        user = get_object_or_404(User, email=email)
        admin_rec = Admin.objects.filter(email=email).first()
        if admin_rec and admin_rec.role in ("ADMIN", "SUPER_ADMIN"):
            return Response({"error": "User is already an Admin or Super Admin"}, status=status.HTTP_409_CONFLICT)
        admin, _ = Admin.objects.get_or_create(
            email=user.email,
            defaults={"id": user.id, "name": user.user_name, "role": "ADMIN", "status": "ACTIVE"}
        )
        admin.role = "ADMIN"
        admin.status = "ACTIVE"
        admin.save()
        return Response(status=status.HTTP_202_ACCEPTED)

    def delete(self, request, email):
        """AccountDeleteView.delete ko hi chalata hai."""
        return AccountDeleteView().delete(request, email)


class AccountBlockView(BaseAdminView):
    """POST /admin/account/<email>/block - user ko block karo."""
    def post(self, request, email):
        """Super Admin block nahi hota (409); admin ko sirf Super Admin block kar sakta hai (403).
        Status BLOCKED, Redis me bhi block taaki core API turant mana kare.
        """
        user = get_object_or_404(User, email=email)
        admin_rec = Admin.objects.filter(email=email).first()
        if admin_rec and admin_rec.role == "SUPER_ADMIN":
            return Response({"error": "Super Admin cannot be blocked"}, status=status.HTTP_409_CONFLICT)
        if admin_rec and admin_rec.role == "ADMIN" and not getattr(request.user, "is_super_admin", False):
            return Response({"error": "Only Super Admin can block another Admin"}, status=status.HTTP_403_FORBIDDEN)
        old_status = user.status
        if old_status != "BLOCKED":
            user.status = "BLOCKED"
            user.save()
            if admin_rec:
                admin_rec.status = "BLOCKED"
                admin_rec.save()
            Session.objects.filter(user=user).delete()
            RedisService.block_user_in_redis(user.id)
            PaginationMetadataService.transition_status("UsersEntity", old_status, "BLOCKED")
        return Response(status=status.HTTP_200_OK)


class AccountUnblockView(BaseAdminView):
    """POST /admin/account/<email>/unblock - user ko wapas ACTIVE karo."""
    def post(self, request, email):
        """Admin ko sirf Super Admin unblock kar sakta hai (403). Status ACTIVE aur Redis block hatao."""
        user = get_object_or_404(User, email=email)
        admin_rec = Admin.objects.filter(email=email).first()
        if admin_rec and admin_rec.role == "ADMIN" and not getattr(request.user, "is_super_admin", False):
            return Response({"error": "Only Super Admin can unblock an Admin"}, status=status.HTTP_403_FORBIDDEN)
        old_status = user.status
        if old_status != "ACTIVE":
            user.status = "ACTIVE"
            user.save()
            if admin_rec:
                admin_rec.status = "ACTIVE"
                admin_rec.save()
            RedisService.unblock_user_in_redis(user.id)
            PaginationMetadataService.transition_status("UsersEntity", old_status, "ACTIVE")
        return Response(status=status.HTTP_200_OK)


class AccountDemoteView(BaseAdminView):
    """POST /admin/account/<email>/demote - admin ko wapas normal user banao (sirf Super Admin)."""
    permission_classes = [IsSuperAdminUserPermission]

    def post(self, request, email):
        """Admin na ho to 400, Super Admin ho to 409; warna admin row hatao."""
        user = get_object_or_404(User, email=email)
        admin_rec = Admin.objects.filter(email=email).first()
        if not admin_rec:
            return Response({"error": "User is not an Admin"}, status=status.HTTP_400_BAD_REQUEST)
        if admin_rec.role == "SUPER_ADMIN":
            return Response({"error": "Super Admin cannot be demoted"}, status=status.HTTP_409_CONFLICT)
        admin_rec.delete()
        return Response(status=status.HTTP_200_OK)


class AccountSessionsListView(BaseAdminView):
    """GET /admin/account/<email>/sessions
    App user ke saare login sessions (devices).
    """
    def get(self, request, email):
        """User ke saare device sessions lautao."""
        user = get_object_or_404(User, email=email)
        sessions = Session.objects.filter(user=user).order_by("-updated_at")
        return Response({
            "email": user.email,
            "userId": user.id,
            "sessions": UserSessionSerializer(sessions, many=True).data,
        }, status=status.HTTP_200_OK)


class AccountSessionRevokeView(BaseAdminView):
    """DELETE /admin/account/<email>/sessions/<session_id>
    User ka ek device session band karo.
    """
    def delete(self, request, email, session_id):
        """User ka ek device session band karo; na mile to 404."""
        user = get_object_or_404(User, email=email)
        deleted_count, _ = Session.objects.filter(user=user, id=session_id).delete()
        if deleted_count == 0:
            return Response({"error": "Session not found"}, status=status.HTTP_404_NOT_FOUND)
        return Response({"message": f"Session {session_id} revoked successfully"}, status=status.HTTP_200_OK)


class AccountSessionRevokeAllView(BaseAdminView):
    """POST /admin/account/<email>/sessions/revoke-all
    User ke saare device sessions band karo.
    """
    def post(self, request, email):
        """User ke saare device sessions band karo aur kitne band hue wo batao."""
        user = get_object_or_404(User, email=email)
        deleted_count, _ = Session.objects.filter(user=user).delete()
        return Response({"message": f"Revoked {deleted_count} session(s) for {user.email}"}, status=status.HTTP_200_OK)
