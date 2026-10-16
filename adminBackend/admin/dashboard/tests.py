import time
from django.test import SimpleTestCase
from rest_framework.test import APIClient
# pyrefly: ignore[missing-import]
from core.services import RedisService


class DashboardAppTests(SimpleTestCase):
    def setUp(self):
        self.client = APIClient()
        self.session_id = "test_dash_session_admin"
        RedisService._MEMORY_SESSIONS[self.session_id] = {
            "sessionId": self.session_id,
            "userId": "user_dash_1",
            "email": "dash_admin@example.com",
            "userName": "Dashboard Admin",
            "role": "ADMIN",
            "status": "ACTIVE",
            "expiresAt": time.time() + 7200,
        }

    def test_health_check_view_unauthenticated(self):
        # Health check must be publicly accessible without session token
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "UP", "service": "admin"})

    def test_global_search_empty_query(self):
        self.client.credentials(HTTP_X_SESSION_ID=self.session_id)
        response = self.client.get("/api/search?q=")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"songs": [], "artists": [], "playlists": []})

    def test_global_search_short_query(self):
        self.client.credentials(HTTP_X_SESSION_ID=self.session_id)
        response = self.client.get("/api/search?q=a")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"songs": [], "artists": [], "playlists": []})
