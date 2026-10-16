from unittest.mock import patch
from django.test import RequestFactory, SimpleTestCase
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

    @patch("webhooks.views.S3Service.generate_presigned_upload_url")
    def test_song_upload_url_webhook(self, mock_s3_url):
        mock_s3_url.return_value = "https://s3.amazonaws.com/temp/presigned-song-url"
        request = self.factory.get("/webhook/internal/song/upload-url")
        view = SongUploadUrlWebhookView.as_view()
        response = view(request)
        self.assertEqual(response.status_code, 200)
        self.assertIn("key", response.data)
        self.assertEqual(response.data["preSignedUrl"], "https://s3.amazonaws.com/temp/presigned-song-url")

    @patch("webhooks.views.S3Service.generate_presigned_upload_url")
    def test_video_upload_url_webhook(self, mock_s3_url):
        mock_s3_url.return_value = "https://s3.amazonaws.com/temp/presigned-vid-url"
        request = self.factory.get("/webhook/internal/video/upload-url")
        view = VideoUploadUrlWebhookView.as_view()
        response = view(request)
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
        view = ImageUploadParamWebhookView.as_view()
        response = view(request)
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
        view = VideoUploadParamWebhookView.as_view()
        response = view(request)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["token"], "vid_tok_456")
        self.assertEqual(response.data["signature"], "vid_sig_def")
