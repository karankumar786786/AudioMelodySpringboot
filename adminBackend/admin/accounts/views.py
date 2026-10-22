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
    """
    Sets secure, HTTP-only authentication cookies on the HTTP response.
    - admin_session: stateful Redis access session ID
    - refresh_session: stateful Redis refresh session ID
    """
    is_secure = not settings.DEBUG
    # admin_session cookie (HTTP-only)
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


def clear_auth_cookies(response: Response) -> None:
    """Clears all admin authentication cookies."""
    for key in ("admin_session", "session_id", "refresh_session", "refresh_token", "access_token"):
        response.delete_cookie(key, path="/", samesite="Lax")


# ==============================================================================
# Admin Authentication & Session Management
# ==============================================================================

class AdminLoginView(APIView):
    """
    POST /auth/login
    Accepts { "email": "...", "password": "..." }
    Verifies admin exists in admin_users table and generates an OTP.
    Returns { "tempToken": "<tempToken>", "message": "OTP sent" }
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
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
    """
    POST /auth/register
    Accepts { "userName": "...", "email": "...", "password": "..." }
    Initiates registration of a new admin in admin_users table via OTP.
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
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

        # First registered admin automatically becomes SUPER_ADMIN, otherwise ADMIN
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
    """
    POST /auth/verify-otp
    Header: X-TEMP-TOKEN: <tempToken> (or body { "token": "..." })
    Body: { "otp": "..." }
    Verifies OTP, establishes Redis session, sets HTTP-only cookies,
    and returns { "sessionId": "...", "accessToken": "...", "refreshToken": "..." }
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
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

        res = Response(tokens, status=status.HTTP_200_OK)
        set_auth_cookies(res, tokens["sessionId"], tokens["refreshSessionId"])
        return res


class AdminResendOtpView(APIView):
    """
    POST /auth/resend-otp
    Header: X-TEMP-TOKEN: <tempToken>
    Generates and resends a new OTP code.
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
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
    """
    POST /auth/refresh-token
    Accepts refreshSessionId from HTTP-Only cookie OR request body { "refreshSessionId": "..." }
    Validates refresh session in Redis and issues a fresh pair of active Redis sessions.
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
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

        # Invalidate old access session
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

        # Rotate: revoke old refresh session and issue new pair
        RedisService.revoke_refresh_session(refresh_id)
        tokens = AdminAuthService.issue_tokens_for_admin(admin, request)
        res = Response(tokens, status=status.HTTP_200_OK)
        set_auth_cookies(res, tokens["sessionId"], tokens["refreshSessionId"])
        return res


class AdminProfileView(BaseAdminView):
    """
    GET /api/user/profile (and /auth/me, /admin/auth/me)
    PATCH /api/user/profile
    Manages authenticated admin profile.
    """
    def get(self, request):
        user = request.user
        last_login = None
        try:
            r = RedisService.get_client()
            raw = r.get(f"admin:last_login:{user.email.lower()}")
            if raw:
                last_login = json.loads(raw)
        except Exception:
            pass

        return Response({
            "id": user.id,
            "email": user.email,
            "userName": getattr(user, "userName", "") or getattr(user, "name", "") or getattr(user, "user_name", ""),
            "name": getattr(user, "userName", "") or getattr(user, "name", "") or getattr(user, "user_name", ""),
            "role": user.role,
            "status": user.status,
            "sessionId": getattr(request, "session_id", None),
            "lastLogin": last_login,
        }, status=status.HTTP_200_OK)

    def patch(self, request):
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
    """
    POST /auth/logout
    Instantly revokes Redis session and clears HTTP-only authentication cookies.
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
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
    """
    GET /admin/auth/sessions
    Returns all active Redis sessions for the current administrator.
    """
    def get(self, request):
        user = request.user
        current_sid = getattr(request, "session_id", None) or request.COOKIES.get("admin_session")
        sessions = RedisService.list_user_sessions(user.email, current_session_id=current_sid)
        return Response({"sessions": sessions}, status=status.HTTP_200_OK)


class AdminSessionRevokeView(BaseAdminView):
    """
    DELETE /admin/auth/sessions/<session_id>
    Revokes a specific session.
    POST /admin/auth/sessions/revoke-all
    Revokes all sessions except the current one.
    """
    def delete(self, request, session_id):
        user = request.user
        sess = RedisService.get_admin_session(session_id)
        if sess and sess.get("email", "").lower() != user.email.lower() and not getattr(user, "is_super_admin", False):
            return Response({"error": "Cannot revoke another admin's session"}, status=status.HTTP_403_FORBIDDEN)

        RedisService.revoke_admin_session(session_id)
        return Response({"message": f"Session {session_id} revoked successfully"}, status=status.HTTP_200_OK)

    def post(self, request):
        user = request.user
        current_sid = getattr(request, "session_id", None) or request.COOKIES.get("admin_session")
        revoked = RedisService.revoke_all_admin_sessions(user.email, except_session_id=current_sid)
        return Response({"message": f"Revoked {revoked} session(s). Current session preserved."}, status=status.HTTP_200_OK)


# ==============================================================================
# End-User Accounts Management Views
# ==============================================================================

class AccountListView(BaseAdminView):
    def get(self, request):
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
    permission_classes = [IsSuperAdminUserPermission]

    def delete(self, request, email):
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
        return self.delete(request, email)


class AccountUpgradeView(BaseAdminView):
    permission_classes = [IsSuperAdminUserPermission]

    def post(self, request, email):
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
        return AccountDeleteView().delete(request, email)


class AccountBlockView(BaseAdminView):
    def post(self, request, email):
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
    def post(self, request, email):
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
    permission_classes = [IsSuperAdminUserPermission]

    def post(self, request, email):
        user = get_object_or_404(User, email=email)
        admin_rec = Admin.objects.filter(email=email).first()
        if not admin_rec:
            return Response({"error": "User is not an Admin"}, status=status.HTTP_400_BAD_REQUEST)
        if admin_rec.role == "SUPER_ADMIN":
            return Response({"error": "Super Admin cannot be demoted"}, status=status.HTTP_409_CONFLICT)
        admin_rec.delete()
        return Response(status=status.HTTP_200_OK)


class AccountSessionsListView(BaseAdminView):
    """
    GET /admin/account/<str:email>/sessions
    Lists all active client sessions (devices) for a user.
    """
    def get(self, request, email):
        user = get_object_or_404(User, email=email)
        sessions = Session.objects.filter(user=user).order_by("-updated_at")
        return Response({
            "email": user.email,
            "userId": user.id,
            "sessions": UserSessionSerializer(sessions, many=True).data,
        }, status=status.HTTP_200_OK)


class AccountSessionRevokeView(BaseAdminView):
    """
    DELETE /admin/account/<str:email>/sessions/<str:session_id>
    Revokes a specific client device session.
    """
    def delete(self, request, email, session_id):
        user = get_object_or_404(User, email=email)
        deleted_count, _ = Session.objects.filter(user=user, id=session_id).delete()
        if deleted_count == 0:
            return Response({"error": "Session not found"}, status=status.HTTP_404_NOT_FOUND)
        return Response({"message": f"Session {session_id} revoked successfully"}, status=status.HTTP_200_OK)


class AccountSessionRevokeAllView(BaseAdminView):
    """
    POST /admin/account/<str:email>/sessions/revoke-all
    Revokes all client device sessions for the user.
    """
    def post(self, request, email):
        user = get_object_or_404(User, email=email)
        deleted_count, _ = Session.objects.filter(user=user).delete()
        return Response({"message": f"Revoked {deleted_count} session(s) for {user.email}"}, status=status.HTTP_200_OK)
