from datetime import datetime
from unittest.mock import patch
from django.test import SimpleTestCase
# pyrefly: ignore[missing-import]
from accounts.models import Admin, Session, User
# pyrefly: ignore[missing-import]
from accounts.serializers import AdminSerializer, UserSerializer, UserSessionSerializer


class AccountsAppTests(SimpleTestCase):
    def test_admin_serializer(self):
        admin = Admin(
            id="admin-uuid",
            email="super@example.com",
            name="Super Admin",
            role="SUPER_ADMIN",
            status="ACTIVE",
            created_at=datetime.now(),
            updated_at=datetime.now(),
        )
        serializer = AdminSerializer(admin)
        data = serializer.data
        self.assertEqual(data["email"], "super@example.com")
        self.assertEqual(data["role"], "SUPER_ADMIN")
        self.assertEqual(data["userName"], "Super Admin")

    @patch("accounts.models.Admin.objects.filter")
    def test_user_serializer(self, mock_filter):
        mock_filter.return_value.first.return_value = None
        user = User(
            id="user-uuid",
            email="listener@example.com",
            user_name="Listener",
            status="ACTIVE",
            created_at=datetime.now(),
        )
        serializer = UserSerializer(user)
        data = serializer.data
        self.assertEqual(data["email"], "listener@example.com")
        self.assertEqual(data["userName"], "Listener")
        self.assertEqual(data["status"], "ACTIVE")
        self.assertEqual(data["role"], "USER")

    def test_session_serializer(self):
        user = User(id="user-1", email="test@example.com")
        session = Session(
            id="sess-1",
            user=user,
            device_id="iphone-15-pro",
            refresh_token="ref-tok",
            expires_at=datetime.now(),
            created_at=datetime.now(),
            updated_at=datetime.now(),
        )
        serializer = UserSessionSerializer(session)
        data = serializer.data
        self.assertEqual(data["deviceId"], "iphone-15-pro")
        self.assertEqual(data["id"], "sess-1")
