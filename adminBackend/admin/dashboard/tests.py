from django.test import RequestFactory, SimpleTestCase
# pyrefly: ignore[missing-import]
from dashboard.views import HealthCheckView, GlobalSearchView


class DashboardAppTests(SimpleTestCase):
    def setUp(self):
        self.factory = RequestFactory()

    def test_health_check_view(self):
        request = self.factory.get("/health")
        view = HealthCheckView.as_view()
        response = view(request)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, {"status": "UP", "service": "admin"})

    def test_global_search_empty_query(self):
        request = self.factory.get("/api/search?q=")
        view = GlobalSearchView.as_view()
        response = view(request)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, {"songs": [], "artists": [], "playlists": []})

    def test_global_search_short_query(self):
        request = self.factory.get("/api/search?q=a")
        view = GlobalSearchView.as_view()
        response = view(request)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, {"songs": [], "artists": [], "playlists": []})
