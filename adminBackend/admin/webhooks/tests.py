from typing import Any
from unittest.mock import patch
from django.test import RequestFactory, SimpleTestCase
from rest_framework.test import force_authenticate
# pyrefly: ignore[missing-import]
from core.authentication import AdminUser
# pyrefly: ignore[missing-import]
from webhooks.views import (
    SongUploadUrlWebhookView,
    VideoUploadUrlWebhookView,
    ImageUploadParamWebhookView,
    VideoUploadParamWebhookView,
)


class WebhooksAppTests(SimpleTestCase):
    def setUp(self):
        self.factory = RequestFactory()
        self.admin = AdminUser(user_id="admin-1", email="admin@example.com", role="ADMIN")

    @patch("webhooks.views.S3Service.generate_presigned_upload_url")
    def test_song_upload_url_webhook(self, mock_s3_url):
        mock_s3_url.return_value = "https://s3.amazonaws.com/temp/presigned-song-url"
        request = self.factory.get("/webhook/internal/song/upload-url")
        force_authenticate(request, user=self.admin)
        view = SongUploadUrlWebhookView.as_view()
        response: Any = view(request)
        self.assertEqual(response.status_code, 200)
        self.assertIn("key", response.data)
        self.assertEqual(response.data["preSignedUrl"], "https://s3.amazonaws.com/temp/presigned-song-url")

    @patch("webhooks.views.S3Service.generate_presigned_upload_url")
    def test_video_upload_url_webhook(self, mock_s3_url):
        mock_s3_url.return_value = "https://s3.amazonaws.com/temp/presigned-vid-url"
        request = self.factory.get("/webhook/internal/video/upload-url")
        force_authenticate(request, user=self.admin)
        view = VideoUploadUrlWebhookView.as_view()
        response: Any = view(request)
        self.assertEqual(response.status_code, 200)
        self.assertIn("key", response.data)
        self.assertEqual(response.data["preSignedUrl"], "https://s3.amazonaws.com/temp/presigned-vid-url")

    @patch("webhooks.views.ImageKitService.generate_upload_params")
    def test_image_upload_param_webhook(self, mock_ik_params):
        mock_ik_params.return_value = {
            "token": "tok_123",
            "expire": 1700000000,
            "signature": "sig_abc",
        }
        request = self.factory.get("/webhook/internal/image/upload-param")
        force_authenticate(request, user=self.admin)
        view = ImageUploadParamWebhookView.as_view()
        response: Any = view(request)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["token"], "tok_123")
        self.assertEqual(response.data["signature"], "sig_abc")

    @patch("webhooks.views.ImageKitService.generate_upload_params")
    def test_video_upload_param_webhook(self, mock_ik_params):
        mock_ik_params.return_value = {
            "token": "vid_tok_456",
            "expire": 1700000000,
            "signature": "vid_sig_def",
        }
        request = self.factory.get("/webhook/internal/video/upload-param")
        force_authenticate(request, user=self.admin)
        view = VideoUploadParamWebhookView.as_view()
        response: Any = view(request)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["token"], "vid_tok_456")
        self.assertEqual(response.data["signature"], "vid_sig_def")

    def test_upload_endpoints_reject_anonymous_requests(self):
        """Upload credentials must never be issued without an admin session."""
        views = [
            SongUploadUrlWebhookView,
            VideoUploadUrlWebhookView,
            ImageUploadParamWebhookView,
            VideoUploadParamWebhookView,
        ]
        for view_cls in views:
            with self.subTest(view=view_cls.__name__):
                request = self.factory.get("/webhook/internal/anything")
                response: Any = view_cls.as_view()(request)
                self.assertIn(response.status_code, (401, 403))

    def test_upload_endpoints_reject_non_admin_role(self):
        request = self.factory.get("/webhook/internal/song-upload-url")
        force_authenticate(request, user=AdminUser(user_id="u1", email="u@example.com", role="USER"))
        response: Any = SongUploadUrlWebhookView.as_view()(request)
        self.assertEqual(response.status_code, 403)
