"""webhooks ke tests: upload URLs (sirf admin ko), aur audio features ka job se song pe copy hona."""
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
        """Admin session ke bina upload ki permission kabhi nahi milni chahiye."""
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


class SongAudioFeatureSyncTests(SimpleTestCase):
    """Audio features job se song pe copy hote hain (Flyway V15)."""

    def setUp(self):
        self.factory = RequestFactory()
        self.admin = AdminUser(user_id="admin-1", email="admin@example.com", role="ADMIN")

    @staticmethod
    def _job(**overrides):
        from types import SimpleNamespace
        base = dict(
            id="job-1", song_id="song-1", status="PROCESSING", current_stage="FINALIZING",
            title="T", artist_name="A", duration=200, song_key="s.m3u8", image_key="i.jpg",
            video_key=None, full_video_key=None, preview_start_time=None, preview_end_time=None,
            language="hindi", lrclib_id="1", genre="pop", album=None, country="India",
            clip_start_sec=None, clip_end_sec=None, temp_song_key=None, temp_video_key=None,
            is_video_reprocess=False, is_audio_reprocess=False,
            created_at=None, search_saved_at=None, transcoded_at=None,
            tempo=None, danceability=None, energy=None, valence=None, acousticness=None,
            instrumentalness=None, liveness=None, speechiness=None, loudness=None, key=None, mode=None,
            audio_features=None,
        )
        base.update(overrides)
        job = SimpleNamespace(**base)
        job.save = lambda *a, **k: None
        return job

    def test_copy_helper_copies_known_values_and_keeps_existing_on_null(self):
        from types import SimpleNamespace
        from webhooks.views import copy_audio_features_to_song
        job = SimpleNamespace(tempo=120.0, energy=0.8, valence=None, danceability=0.6)
        song = SimpleNamespace(tempo=None, energy=0.8, valence=0.4, danceability=0.1)
        changed = copy_audio_features_to_song(job, song)
        self.assertEqual(changed, ["tempo", "danceability"])
        self.assertEqual((song.tempo, song.energy, song.valence, song.danceability), (120.0, 0.8, 0.4, 0.6))

    @patch("webhooks.views.Song")
    @patch("webhooks.views.get_object_or_404")
    def test_late_features_after_finalize_update_song(self, mock_get, mock_song_cls):
        from types import SimpleNamespace
        from webhooks.views import WebhookJobAudioFeaturesView
        mock_get.return_value = self._job(status="COMPLETED")
        song = SimpleNamespace(tempo=None, energy=None, valence=None, danceability=None)
        saved = {}
        song.save = lambda update_fields=None: saved.setdefault("fields", update_fields)
        mock_song_cls.objects.filter.return_value.first.return_value = song

        request = self.factory.post(
            "/webhook/job/job-1/audio-features",
            {"audioFeatures": {"tempo": 98.5, "energy": 0.3, "valence": 0.2, "danceability": 0.4}},
            content_type="application/json",
        )
        force_authenticate(request, user=self.admin)
        response: Any = WebhookJobAudioFeaturesView.as_view()(request, job_id="job-1")

        self.assertEqual(response.status_code, 200)
        self.assertEqual((song.tempo, song.energy, song.valence, song.danceability), (98.5, 0.3, 0.2, 0.4))
        self.assertEqual(saved["fields"], ["tempo", "energy", "valence", "danceability"])

    @patch("webhooks.views.Song")
    @patch("webhooks.views.get_object_or_404")
    def test_features_before_finalize_leave_song_alone(self, mock_get, mock_song_cls):
        from webhooks.views import WebhookJobAudioFeaturesView
        mock_get.return_value = self._job(status="PROCESSING")
        request = self.factory.post(
            "/webhook/job/job-1/audio-features",
            {"audioFeatures": {"tempo": 98.5, "energy": 0.3}},
            content_type="application/json",
        )
        force_authenticate(request, user=self.admin)
        response: Any = WebhookJobAudioFeaturesView.as_view()(request, job_id="job-1")
        self.assertEqual(response.status_code, 200)
        mock_song_cls.objects.filter.assert_not_called()

    @patch("webhooks.views.PaginationMetadataService")
    @patch("webhooks.views.Artist")
    @patch("webhooks.views.SongMetadata")
    @patch("webhooks.views.RecombeeService")
    @patch("webhooks.views.AlgoliaService")
    @patch("webhooks.views.Song")
    @patch("webhooks.views.get_object_or_404")
    def test_finalize_creates_song_with_audio_features(
        self, mock_get, mock_song_cls, mock_algolia, mock_recombee, mock_meta, mock_artist, mock_pagination
    ):
        from webhooks.views import WebhookJobFinalizeView
        mock_get.return_value = self._job(tempo=128.0, energy=0.9, valence=0.7, danceability=0.8)
        mock_song_cls.objects.filter.return_value.first.return_value = None
        mock_artist.objects.filter.return_value.first.return_value = None

        request = self.factory.post("/webhook/job/job-1/finalize", {}, content_type="application/json")
        force_authenticate(request, user=self.admin)
        response: Any = WebhookJobFinalizeView.as_view()(request, job_id="job-1")

        self.assertEqual(response.status_code, 200)
        kwargs = mock_song_cls.objects.create.call_args.kwargs
        self.assertEqual(
            (kwargs["tempo"], kwargs["energy"], kwargs["valence"], kwargs["danceability"]),
            (128.0, 0.9, 0.7, 0.8),
        )
        # Recombee ko features pehle jaise hi milte hain
        self.assertEqual(mock_recombee.save_song.call_args.kwargs["tempo"], 128.0)
