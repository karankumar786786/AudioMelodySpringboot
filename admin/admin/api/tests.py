import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "admin.settings")
django.setup()

import jwt
import time
from unittest.mock import patch, MagicMock
from django.conf import settings
from django.test import SimpleTestCase
from rest_framework.test import APIClient
from .models import Admin, User, Artist, Song, Playlist, Job, DeleteJob
from .helpers import format_ms, format_paginated_response, to_job_progress_dto
from .services import (
    AlgoliaService,
    ImageKitService,
    PaginationMetadataService,
    RecombeeService,
    RedisService,
    S3Service,
)
from .serializers import SongSerializer, JobSerializer


class AdminHelperAndAuthTests(SimpleTestCase):
    def test_format_ms(self):
        self.assertEqual(format_ms(None), "-")
        self.assertEqual(format_ms(500), "500ms")
        self.assertEqual(format_ms(1500), "1.5s")

    def test_format_paginated_response(self):
        metadata = MagicMock()
        metadata.id = "meta-123"
        metadata.entity_name = "SONG"
        metadata.total_count = 42
        metadata.active_count = 30
        metadata.blocked_count = 0
        metadata.deleted_count = 12

        res = format_paginated_response(
            content=[{"id": "1", "title": "Test"}],
            page=0,
            size=10,
            metadata=metadata
        )
        self.assertEqual(res["page"], 0)
        self.assertEqual(res["size"], 10)
        self.assertEqual(len(res["content"]), 1)
        self.assertEqual(res["paginationMetaData"]["entityName"], "SONG")
        self.assertEqual(res["paginationMetaData"]["totalCount"], 42)
        self.assertEqual(res["paginationMetaData"]["activeCount"], 30)

    def test_admin_jwt_authentication_unauthorized(self):
        anon_client = APIClient()
        resp = anon_client.get("/admin/dashboard/stats")
        self.assertIn(resp.status_code, [401, 403])


class AdminEndpointRoutingTests(SimpleTestCase):
    def setUp(self):
        self.client = APIClient()
        payload = {
            "sub": "user_admin_123",
            "email": "admin@example.com",
            "role": "ADMIN",
            "exp": time.time() + 3600
        }
        self.token = jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token}")

    def test_dashboard_stats(self):
        with patch.object(PaginationMetadataService, "get_metadata", return_value=None), \
             patch.object(Song, "objects") as mock_song, \
             patch.object(Artist, "objects") as mock_artist, \
             patch.object(Playlist, "objects") as mock_playlist, \
             patch.object(User, "objects") as mock_user, \
             patch.object(Job, "objects") as mock_job, \
             patch.object(SongSerializer, "data", []), \
             patch.object(JobSerializer, "data", []), \
             patch.object(RedisService, "get_queue_backpressure_summary") as mock_redis:
            
            mock_song.count.return_value = 50
            mock_song.filter.return_value.count.return_value = 40
            mock_song.filter.return_value.order_by.return_value = []
            mock_artist.count.return_value = 10
            mock_artist.filter.return_value.count.return_value = 10
            mock_playlist.count.return_value = 5
            mock_playlist.filter.return_value.count.return_value = 5
            mock_user.count.return_value = 100
            mock_user.filter.return_value.count.return_value = 90
            mock_job.count.return_value = 15
            mock_job.filter.return_value.count.return_value = 2
            mock_job.all.return_value.order_by.return_value = []
            mock_redis.return_value = {"totalQueued": 0, "overallStatus": "HEALTHY", "queues": []}

            response = self.client.get("/admin/dashboard/stats")
            self.assertEqual(response.status_code, 200)
            data = response.json()
            self.assertIn("totalArtists", data)
            self.assertIn("totalSongs", data)
            self.assertIn("totalPlaylists", data)
            self.assertIn("totalUsers", data)
            self.assertIn("totalJobs", data)
            self.assertIn("queueStats", data)

    def test_queue_metrics(self):
        with patch.object(RedisService, "get_queue_backpressure_summary") as mock_queue:
            mock_queue.return_value = {
                "totalQueued": 5,
                "overallStatus": "HEALTHY",
                "queues": []
            }
            response = self.client.get("/admin/jobs/queues")
            self.assertEqual(response.status_code, 200)
            data = response.json()
            self.assertEqual(data["overallStatus"], "HEALTHY")

    def test_account_block_unauthorized(self):
        client = APIClient()
        resp = client.post("/admin/account/test@example.com/block")
        self.assertIn(resp.status_code, [401, 403])

    def test_internal_webhook_upload_url(self):
        with patch.object(S3Service, "generate_presigned_upload_url", return_value="https://s3.example.com/upload"):
            client = APIClient()
            resp = client.get("/webhook/internal/song-upload-url")
            self.assertEqual(resp.status_code, 200)
            data = resp.json()
            self.assertIn("key", data)
            self.assertIn("preSignedUrl", data)

    def test_webhook_job_lifecycle(self):
        fake_job = MagicMock()
        fake_job.id = "job-123"
        fake_job.title = "Test Song"
        fake_job.artist_name = "Test Artist"
        fake_job.duration = 180
        fake_job.temp_song_key = "temp/song.mp3"
        fake_job.temp_video_key = None
        fake_job.song_key = "audios/song.mp3"
        fake_job.full_video_key = None
        fake_job.image_key = "images/art.jpg"
        fake_job.video_key = None
        fake_job.clip_start_sec = 0
        fake_job.clip_end_sec = 30
        fake_job.preview_start_time = 0
        fake_job.preview_end_time = 30
        fake_job.language = "en"
        fake_job.genre = "Pop"
        fake_job.lrclib_id = None
        fake_job.song_id = "song-123"
        fake_job.transcoding_id = "p-1"
        fake_job.transcoding_attempt = 1
        fake_job.transcoded = True
        fake_job.saved_in_search = True
        fake_job.saved_in_recommendation = True
        fake_job.is_video_reprocess = False
        fake_job.is_audio_reprocess = False
        fake_job.status = "PENDING"
        fake_job.current_stage = "QUEUED"
        fake_job.created_at = None
        fake_job.transcoding_started_at = None
        fake_job.transcoded_at = None
        fake_job.recommendation_saved_at = None
        fake_job.search_saved_at = None

        with patch("api.views.get_object_or_404", return_value=fake_job), \
             patch.object(PaginationMetadataService, "transition_job"), \
             patch.object(PaginationMetadataService, "increment_status"), \
             patch.object(RecombeeService, "save_song"), \
             patch.object(AlgoliaService, "save_song"), \
             patch.object(S3Service, "delete_object"), \
             patch.object(Song.objects, "create"):

            # 1. GET /webhook/job/{jobId}
            res_get = self.client.get("/webhook/job/job-123")
            self.assertEqual(res_get.status_code, 200)
            self.assertEqual(res_get.json()["id"], "job-123")

            # 2. POST /webhook/job/{jobId}/transcoding-started
            res_start = self.client.post("/webhook/job/job-123/transcoding-started", {"processingId": "proc-99"}, format="json")
            self.assertEqual(res_start.status_code, 200)

            # 3. POST /webhook/job/{jobId}/transcoded
            res_trans = self.client.post("/webhook/job/job-123/transcoded", {"songKey": "audios/song.mp3", "duration": 200}, format="json")
            self.assertEqual(res_trans.status_code, 200)

            # 4. POST /webhook/job/{jobId}/save-recommendation
            res_rec = self.client.post("/webhook/job/job-123/save-recommendation")
            self.assertEqual(res_rec.status_code, 200)

            # 5. POST /webhook/job/{jobId}/save-search
            res_search = self.client.post("/webhook/job/job-123/save-search")
            self.assertEqual(res_search.status_code, 200)

            # 6. POST /webhook/job/{jobId}/finalize
            res_fin = self.client.post("/webhook/job/job-123/finalize")
            self.assertEqual(res_fin.status_code, 200)

            # 7. POST /webhook/job/{jobId}/failed
            res_fail = self.client.post("/webhook/job/job-123/failed", {"reason": "Worker error"}, format="json")
            self.assertEqual(res_fail.status_code, 200)

    def test_webhook_delete_lifecycle(self):
        fake_delete_job = MagicMock()
        fake_delete_job.id = "del-job-1"
        fake_delete_job.status = "PENDING"
        fake_delete_job.started_at = None
        fake_delete_job.search_deleted_at = None
        fake_delete_job.recommendation_deleted_at = None
        fake_delete_job.imagekit_deleted_at = None
        fake_delete_job.s3_deleted_at = None
        fake_delete_job.created_at = None

        with patch("api.views.find_delete_job", return_value=fake_delete_job), \
             patch.object(PaginationMetadataService, "transition_delete_job"), \
             patch.object(PaginationMetadataService, "decrement_status"), \
             patch.object(AlgoliaService, "delete_record"), \
             patch.object(RecombeeService, "delete_song"), \
             patch.object(ImageKitService, "delete_by_key"), \
             patch.object(Song.objects, "filter") as mock_song_filter:

            mock_song_filter.return_value.first.return_value = None
            mock_song_filter.return_value.__iter__.return_value = []

            # 1. delete-search
            res_search = self.client.post("/webhook/delete/SONG/song-123/delete-search")
            self.assertEqual(res_search.status_code, 200)

            # 2. delete-recommendation
            res_rec = self.client.post("/webhook/delete/SONG/song-123/delete-recommendation")
            self.assertEqual(res_rec.status_code, 200)

            # 3. delete-imagekit
            res_img = self.client.post("/webhook/delete/SONG/song-123/delete-imagekit")
            self.assertEqual(res_img.status_code, 200)

            # 4. delete-s3
            res_s3 = self.client.post("/webhook/delete/SONG/song-123/delete-s3")
            self.assertEqual(res_s3.status_code, 200)

            # 5. hard-delete
            res_hard = self.client.post("/webhook/delete/SONG/song-123/hard-delete")
            self.assertEqual(res_hard.status_code, 200)

            # 6. failed
            res_fail = self.client.post("/webhook/delete/SONG/song-123/failed", {"reason": "Delete timeout"}, format="json")
            self.assertEqual(res_fail.status_code, 200)

    def test_superadmin_role_enforcement(self):
        # 1. Normal ADMIN cannot promote users (requires SUPER_ADMIN)
        fake_target = MagicMock()
        fake_target.role = "USER"
        with patch("api.views.get_object_or_404", return_value=fake_target):
            # self.client is configured with role="ADMIN"
            res_upgrade_denied = self.client.post("/admin/account/target@example.com")
            self.assertEqual(res_upgrade_denied.status_code, 403)

        # 2. Authenticate as SUPER_ADMIN
        super_payload = {
            "sub": "user_super_1",
            "email": "super@example.com",
            "role": "SUPER_ADMIN",
            "exp": time.time() + 3600
        }
        super_token = jwt.encode(super_payload, settings.JWT_SECRET, algorithm="HS256")
        super_client = APIClient()
        super_client.credentials(HTTP_AUTHORIZATION=f"Bearer {super_token}")

        with patch("api.views.get_object_or_404", return_value=fake_target), \
             patch.object(Admin.objects, "get_or_create", return_value=(MagicMock(), True)):
            res_upgrade_ok = super_client.post("/admin/account/target@example.com")
            self.assertEqual(res_upgrade_ok.status_code, 202)


    def test_redis_blocked_user_rejection(self):
        with patch.object(RedisService, "is_user_blocked", return_value=True):
            res = self.client.get("/admin/jobs/queues")
            self.assertIn(res.status_code, [401, 403])
            self.assertIn("blocked", str(res.data).lower())

    def test_createsuperadmin_command_execution(self):
        from io import StringIO
        from django.core.management import call_command

        out = StringIO()
        with patch.object(Admin.objects, "filter") as mock_filter, \
             patch.object(Admin.objects, "create") as mock_create:

            mock_filter.return_value.first.return_value = None
            mock_new_admin = MagicMock()
            mock_new_admin.id = "new-uuid"
            mock_new_admin.email = "testsuper@one-org.me"
            mock_new_admin.name = "SuperTest"
            mock_new_admin.role = "SUPER_ADMIN"
            mock_new_admin.status = "ACTIVE"
            mock_create.return_value = mock_new_admin

            call_command(
                "createsuperadmin",
                email="testsuper@one-org.me",
                username="SuperTest",
                stdout=out
            )
            output = out.getvalue()
            self.assertIn("Successfully created new SUPER_ADMIN user in admin_users table", output)
            self.assertIn("You can now log in directly via the Admin Frontend", output)
            self.assertNotIn("JWT", output)


class AdminAuthenticationFlowTests(SimpleTestCase):
    def setUp(self):
        self.client = APIClient()

    def test_admin_login_not_found(self):
        with patch.object(Admin.objects, "filter") as mock_filter:
            mock_filter.return_value.first.return_value = None
            res = self.client.post("/auth/login", {"email": "unknown@example.com"}, format="json")
            self.assertEqual(res.status_code, 404)
            self.assertIn("No admin account found", res.json()["message"])

    def test_admin_login_blocked(self):
        fake_admin = MagicMock()
        fake_admin.status = "BLOCKED"
        with patch.object(Admin.objects, "filter") as mock_filter:
            mock_filter.return_value.first.return_value = fake_admin
            res = self.client.post("/auth/login", {"email": "blocked@example.com"}, format="json")
            self.assertEqual(res.status_code, 403)
            self.assertIn("blocked", res.json()["message"].lower())

    def test_admin_login_success_and_verify_otp(self):
        fake_admin = MagicMock()
        fake_admin.id = "admin-123"
        fake_admin.email = "admin@example.com"
        fake_admin.name = "Test Admin"
        fake_admin.role = "ADMIN"
        fake_admin.status = "ACTIVE"

        with patch.object(Admin.objects, "filter") as mock_filter, \
             patch.object(RedisService, "is_user_blocked", return_value=False), \
             patch("api.services.RedisService.get_client"):


            mock_filter.return_value.first.return_value = fake_admin

            # 1. POST /auth/login
            res_login = self.client.post("/auth/login", {"email": "admin@example.com"}, format="json")
            self.assertEqual(res_login.status_code, 200)
            data_login = res_login.json()
            self.assertIn("tempToken", data_login)
            temp_token = data_login["tempToken"]

            # Read generated OTP from cache
            from .services import AdminAuthService
            otp_data = AdminAuthService.get_otp("admin@example.com")
            self.assertIsNotNone(otp_data)
            otp_code = otp_data["otp"]

            # 2. POST /auth/verify-otp with incorrect OTP
            res_bad_otp = self.client.post(
                "/auth/verify-otp",
                {"otp": "000000"},
                HTTP_X_TEMP_TOKEN=temp_token,
                format="json"
            )
            self.assertEqual(res_bad_otp.status_code, 400)

            # 3. POST /auth/verify-otp with correct OTP
            res_verify = self.client.post(
                "/auth/verify-otp",
                {"otp": otp_code},
                HTTP_X_TEMP_TOKEN=temp_token,
                format="json"
            )
            self.assertEqual(res_verify.status_code, 200)
            tokens = res_verify.json()
            self.assertIn("accessToken", tokens)
            self.assertIn("refreshToken", tokens)

            # 4. GET /api/user/profile with issued access token
            authed_client = APIClient()
            authed_client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['accessToken']}")
            res_profile = authed_client.get("/api/user/profile")
            self.assertEqual(res_profile.status_code, 200)
            profile = res_profile.json()
            self.assertEqual(profile["email"], "admin@example.com")
            self.assertEqual(profile["role"], "ADMIN")

            # 5. POST /auth/refresh-token
            res_refresh = self.client.post(
                "/auth/refresh-token",
                {"refreshToken": tokens["refreshToken"]},
                format="json"
            )
            self.assertEqual(res_refresh.status_code, 200)
            new_tokens = res_refresh.json()
            self.assertIn("accessToken", new_tokens)
            self.assertIn("refreshToken", new_tokens)


