import time
from datetime import datetime, timedelta, timezone
from typing import Any
from unittest.mock import patch

from django.db import connection
from django.test import TestCase
from rest_framework.test import APIClient

# pyrefly: ignore[missing-import]
from core.services import AlgoliaService, RecombeeService, RedisService
# pyrefly: ignore[missing-import]
from jobs.models import Job
from .models import Song, SongMetadata

URL = "/admin/catalog/health"


def make_session(role: str) -> str:
    sid = f"test_health_sess_{role}"
    RedisService._MEMORY_SESSIONS[sid] = {
        "sessionId": sid,
        "userId": f"user-{role}",
        "email": f"{role.lower()}@example.com",
        "userName": "Test",
        "role": role,
        "status": "ACTIVE",
        "expiresAt": time.time() + 7200,
    }
    return sid


def song(id: str, minutes_ago: int, **overrides: Any) -> Song:
    fields = dict(
        id=id, title=f"Song {id}", artist_name="Artist", duration=200, song_key=f"audio/{id}",
        image_key=f"img/{id}.jpg", language="Hindi", genre="Pop", lrclib_id="123",
        status="ACTIVE", job_id=f"job-{id}",
    )
    fields.update(overrides)
    s = Song.objects.create(**fields)
    Song.objects.filter(pk=s.pk).update(created_at=datetime.now(timezone.utc) - timedelta(minutes=minutes_ago))
    return s


def job(id: str, song_id: str, features: bool = True, indexed: bool = True, status: str = "COMPLETED") -> Job:
    feats = dict(tempo=120.0, energy=0.5, valence=0.4, danceability=0.6) if features else {}
    return Job.objects.create(
        id=id, title="t", artist_name="a", image_key="i", song_id=song_id, status=status,
        saved_in_search=indexed, saved_in_recommendation=indexed, **feats,
    )


class CatalogHealthTests(TestCase):
    """Song/Job are unmanaged (Flyway owns the schema), so create their tables for the test DB."""

    client: Any

    @classmethod
    def setUpClass(cls):
        with connection.schema_editor() as editor:
            for model in (Song, SongMetadata, Job):
                editor.create_model(model)
        super().setUpClass()

    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        with connection.schema_editor() as editor:
            for model in (Song, SongMetadata, Job):
                editor.delete_model(model)

    def setUp(self):
        self.client = APIClient()
        self.client.credentials(HTTP_X_SESSION_ID=make_session("ADMIN"))
        # healthy
        song("ok", 1)
        job("job-ok", "ok")
        # missing genre + cover
        song("nogenre", 2, genre=None, image_key="")
        job("job-nogenre", "nogenre")
        # missing lyrics ("0" is the upload form default) + no audio features
        song("nolyrics", 3, lrclib_id="0")
        job("job-nolyrics", "nolyrics", features=False)
        # not indexed, linked only via songs.job_id (job.song_id differs)
        song("noindex", 4, job_id="job-x")
        job("job-x", "other-id", indexed=False, status="FAILED")
        # inactive songs are excluded by default
        song("inactive", 5, genre="", status="INACTIVE")

    # --- permissions -----------------------------------------------------

    def test_anonymous_rejected(self):
        resp = APIClient().get(URL)
        self.assertIn(resp.status_code, (401, 403))

    def test_non_admin_role_rejected(self):
        c = APIClient()
        c.credentials(HTTP_X_SESSION_ID=make_session("USER"))
        self.assertIn(c.get(URL).status_code, (401, 403))
        self.assertIn(c.post(f"{URL}/resync", {"songIds": ["ok"]}, format="json").status_code, (401, 403))
        self.assertIn(c.post(f"{URL}/reprocess", {"songIds": ["ok"]}, format="json").status_code, (401, 403))

    # --- summary + filters ----------------------------------------------

    def test_summary_counts(self):
        resp = self.client.get(URL)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["summary"], {
            "totalSongs": 4,
            "songsWithIssues": 3,
            "missingGenre": 1,
            "missingCover": 1,
            "missingAudioFeatures": 1,
            "missingLyrics": 1,
            "notIndexed": 1,
        })

    def test_default_lists_songs_with_any_issue_newest_first(self):
        data = self.client.get(URL).json()
        self.assertEqual([s["id"] for s in data["content"]], ["nogenre", "nolyrics", "noindex"])
        self.assertEqual(data["totalElements"], 3)
        by_id = {s["id"]: s["issues"] for s in data["content"]}
        self.assertEqual(by_id["nogenre"], ["missingGenre", "missingCover"])
        self.assertEqual(by_id["nolyrics"], ["missingAudioFeatures", "missingLyrics"])
        self.assertEqual(by_id["noindex"], ["notIndexed"])

    def test_issue_filter_any_and_all(self):
        ids = lambda q: [s["id"] for s in self.client.get(f"{URL}?{q}").json()["content"]]
        self.assertEqual(ids("issue=missingCover"), ["nogenre"])
        self.assertEqual(ids("issue=missingLyrics,notIndexed"), ["nolyrics", "noindex"])
        self.assertEqual(ids("issue=missingLyrics,missingAudioFeatures&match=all"), ["nolyrics"])
        self.assertEqual(ids("issue=missingLyrics,missingGenre&match=all"), [])

    def test_status_search_and_pagination(self):
        self.assertEqual([s["id"] for s in self.client.get(f"{URL}?status=INACTIVE").json()["content"]], ["inactive"])
        self.assertEqual(self.client.get(f"{URL}?status=ALL").json()["summary"]["missingGenre"], 2)
        self.assertEqual([s["id"] for s in self.client.get(f"{URL}?search=noindex").json()["content"]], ["noindex"])
        page = self.client.get(f"{URL}?size=2&page=1").json()
        self.assertEqual([s["id"] for s in page["content"]], ["noindex"])
        self.assertEqual(page["totalPages"], 2)

    def test_invalid_params(self):
        self.assertEqual(self.client.get(f"{URL}?issue=bogus").status_code, 400)
        self.assertEqual(self.client.get(f"{URL}?match=some").status_code, 400)
        self.assertEqual(self.client.get(f"{URL}?page=x").status_code, 400)

    # --- actions ----------------------------------------------------------

    def test_resync_pushes_active_songs_and_marks_completed_jobs(self):
        Job.objects.filter(id="job-ok").update(saved_in_search=False, saved_in_recommendation=False)
        with patch.object(AlgoliaService, "reindex_all_active_songs", return_value=1) as alg, \
             patch.object(RecombeeService, "reindex_all_active_songs", return_value=1) as rec:
            resp = self.client.post(f"{URL}/resync", {"songIds": ["ok", "inactive", "missing"]}, format="json")
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertEqual(body["algolia"], 1)
        self.assertEqual({s["songId"] for s in body["skipped"]}, {"inactive", "missing"})
        self.assertEqual([s.id for s in alg.call_args.args[0]], ["ok"])
        self.assertEqual([s.id for s in rec.call_args.args[0]], ["ok"])
        j = Job.objects.get(id="job-ok")
        self.assertTrue(j.saved_in_search and j.saved_in_recommendation)

    def test_resync_engine_not_configured_does_not_mark(self):
        Job.objects.filter(id="job-ok").update(saved_in_search=False)
        with patch.object(AlgoliaService, "reindex_all_active_songs", return_value=0), \
             patch.object(RecombeeService, "reindex_all_active_songs", return_value=0):
            self.client.post(f"{URL}/resync", {"songIds": ["ok"], "targets": ["algolia"]}, format="json")
        self.assertFalse(Job.objects.get(id="job-ok").saved_in_search)

    def test_resync_validation(self):
        self.assertEqual(self.client.post(f"{URL}/resync", {"songIds": []}, format="json").status_code, 400)
        self.assertEqual(self.client.post(f"{URL}/resync", {"songIds": ["ok"], "targets": ["x"]}, format="json").status_code, 400)
        too_many = {"songIds": [str(i) for i in range(201)]}
        self.assertEqual(self.client.post(f"{URL}/resync", too_many, format="json").status_code, 400)

    def test_reprocess_only_retries_failed_jobs(self):
        with patch.object(RedisService, "queue_audio_processing", return_value=True) as queue, \
             patch("core.services.PaginationMetadataService.transition_job"):
            resp = self.client.post(f"{URL}/reprocess", {"songIds": ["noindex", "ok", "missing"]}, format="json")
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertEqual(body["queued"], [{"songId": "noindex", "jobId": "job-x"}])
        reasons = {s["songId"]: s["reason"] for s in body["skipped"]}
        self.assertIn("COMPLETED", reasons["ok"])
        self.assertEqual(reasons["missing"], "song not found")
        queue.assert_called_once_with("job-x", attempt=1)
        self.assertEqual(Job.objects.get(id="job-x").status, "PENDING")
