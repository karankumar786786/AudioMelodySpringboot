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

    @patch("webhooks.views.CloudinaryService.is_configured", return_value=True)
    @patch("webhooks.views.CloudinaryService.generate_upload_signature")
    def test_song_upload_url_webhook_cloudinary(self, mock_cloud_sig, mock_configured):
        mock_cloud_sig.return_value = {
            "publicId": "songs/song_abc123",
            "signature": "sig_mock",
            "timestamp": 1700000000,
            "apiKey": "key_mock",
            "cloudName": "one-melody",
            "uploadUrl": "https://api.cloudinary.com/v1_1/one-melody/video/upload",
            "resourceType": "video",
        }
        request = self.factory.get("/webhook/internal/song/upload-url")
        view = SongUploadUrlWebhookView.as_view()
        response = view(request)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["provider"], "cloudinary")
        self.assertEqual(response.data["key"], "songs/song_abc123")
        self.assertEqual(response.data["signature"], "sig_mock")

    @patch("webhooks.views.CloudinaryService.is_configured", return_value=False)
    @patch("webhooks.views.S3Service.generate_presigned_upload_url")
    def test_song_upload_url_webhook_s3_fallback(self, mock_s3_url, mock_configured):
        mock_s3_url.return_value = "https://s3.amazonaws.com/temp/presigned-song-url"
        request = self.factory.get("/webhook/internal/song/upload-url")
        view = SongUploadUrlWebhookView.as_view()
        response = view(request)
        self.assertEqual(response.status_code, 200)
        self.assertIn("key", response.data)
        self.assertEqual(response.data["preSignedUrl"], "https://s3.amazonaws.com/temp/presigned-song-url")

    @patch("webhooks.views.CloudinaryService.is_configured", return_value=True)
    @patch("webhooks.views.CloudinaryService.generate_upload_signature")
    def test_video_upload_url_webhook_cloudinary(self, mock_cloud_sig, mock_configured):
        mock_cloud_sig.return_value = {
            "publicId": "videos/vid_xyz456",
            "signature": "sig_mock_vid",
            "timestamp": 1700000000,
            "apiKey": "key_mock",
            "cloudName": "one-melody",
            "uploadUrl": "https://api.cloudinary.com/v1_1/one-melody/video/upload",
            "resourceType": "video",
        }
        request = self.factory.get("/webhook/internal/video/upload-url")
        view = VideoUploadUrlWebhookView.as_view()
        response = view(request)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["provider"], "cloudinary")
        self.assertEqual(response.data["key"], "videos/vid_xyz456")
        self.assertEqual(response.data["signature"], "sig_mock_vid")

    @patch("webhooks.views.CloudinaryService.is_configured", return_value=False)
    @patch("webhooks.views.S3Service.generate_presigned_upload_url")
    def test_video_upload_url_webhook_s3_fallback(self, mock_s3_url, mock_configured):
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
