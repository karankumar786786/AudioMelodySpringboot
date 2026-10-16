from django.urls import path
from .views import (
    AccountBlockView,
    AccountDeleteView,
    AccountDemoteView,
    AccountListView,
    AccountSessionRevokeAllView,
    AccountSessionRevokeView,
    AccountSessionsListView,
    AccountUnblockView,
    AccountUpgradeView,
    AdminLoginView,
    AdminLogoutView,
    AdminProfileView,
    AdminRefreshTokenView,
    AdminRegisterView,
    AdminResendOtpView,
    AdminSessionRevokeView,
    AdminSessionsListView,
    AdminVerifyOtpView,
)

app_name = "accounts"

urlpatterns = [
    # Authentication & User Profile for adminFrontend
    path("auth/login", AdminLoginView.as_view(), name="auth-login"),
    path("auth/register", AdminRegisterView.as_view(), name="auth-register"),
    path("auth/verify-otp", AdminVerifyOtpView.as_view(), name="auth-verify-otp"),
    path("auth/resend-otp", AdminResendOtpView.as_view(), name="auth-resend-otp"),
    path("auth/refresh-token", AdminRefreshTokenView.as_view(), name="auth-refresh-token"),
    path("auth/logout", AdminLogoutView.as_view(), name="auth-logout"),
    path("api/user/profile", AdminProfileView.as_view(), name="api-user-profile"),

    # Admin prefixed aliases
    path("admin/auth/login", AdminLoginView.as_view(), name="admin-auth-login"),
    path("admin/auth/register", AdminRegisterView.as_view(), name="admin-auth-register"),
    path("admin/auth/verify-otp", AdminVerifyOtpView.as_view(), name="admin-auth-verify-otp"),
    path("admin/auth/resend-otp", AdminResendOtpView.as_view(), name="admin-auth-resend-otp"),
    path("admin/auth/refresh-token", AdminRefreshTokenView.as_view(), name="admin-auth-refresh-token"),
    path("admin/auth/profile", AdminProfileView.as_view(), name="admin-auth-profile"),
    path("admin/auth/me", AdminProfileView.as_view(), name="admin-auth-me"),

    # Admin Sessions & Security Management
    path("admin/auth/sessions/revoke-all", AdminSessionRevokeView.as_view(), name="admin-auth-sessions-revoke-all"),
    path("admin/auth/sessions/<str:session_id>", AdminSessionRevokeView.as_view(), name="admin-auth-session-revoke"),
    path("admin/auth/sessions", AdminSessionsListView.as_view(), name="admin-auth-sessions"),

    # Account Management
    path("admin/account/<str:email>/sessions/revoke-all", AccountSessionRevokeAllView.as_view(), name="admin-account-sessions-revoke-all"),
    path("admin/account/<str:email>/sessions/<str:session_id>", AccountSessionRevokeView.as_view(), name="admin-account-session-revoke"),
    path("admin/account/<str:email>/sessions", AccountSessionsListView.as_view(), name="admin-account-sessions"),
    path("admin/account/<str:email>/block", AccountBlockView.as_view(), name="admin-account-block"),
    path("admin/account/<str:email>/unblock", AccountUnblockView.as_view(), name="admin-account-unblock"),
    path("admin/account/<str:email>/demote", AccountDemoteView.as_view(), name="admin-account-demote"),
    path("admin/account/<str:email>/delete", AccountDeleteView.as_view(), name="admin-account-delete"),
    path("admin/account/<str:email>", AccountUpgradeView.as_view(), name="admin-account-action"),
    path("admin/account", AccountListView.as_view(), name="admin-account-list"),
]
