"""Shorts ke tests: raw keys, caption, ban, processed / failed callbacks, hide / unhide, delete aur upload URL."""
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from typing import Any
from unittest import mock

from django.test import RequestFactory, SimpleTestCase
from rest_framework.test import force_authenticate

from catalog.shorts_views import ShortHideView, ShortListView, ShortUploadUrlView
from core.authentication import AdminUser
from core.services import short_service
from core.services.short_service import ShortError, ShortService, clean_caption, new_raw_key
from webhooks.views import WebhookShortFailedView, WebhookShortProcessedView


def fake_short(**over):
    base = dict(
        id="s1", owner_type="ADMIN", user_id=None, admin_id="a1", song_id=None, song=None, caption="hi",
        status="PROCESSING", raw_key="shorts-raw/x.mp4", hls_key=None, thumbnail_key=None, duration_ms=None,
        width=None, height=None, likes_count=0, views_count=0, reports_count=0, failure_reason=None,
        hidden_reason=None, created_at=datetime.now(timezone.utc), published_at=None,
    )
    base.update(over)
    short = SimpleNamespace(**base)
    short.save = mock.Mock()
    short.reports = mock.Mock()
    return short


class ShortHelpersTests(SimpleTestCase):
    def test_raw_keys_live_under_the_shorts_prefix(self):
        self.assertTrue(new_raw_key().startswith("shorts-raw/"))
        self.assertTrue(new_raw_key("video/quicktime").endswith(".mov"))

    def test_caption_is_trimmed_and_limited(self):
        self.assertEqual(clean_caption("  hello   world "), "hello world")
        self.assertIsNone(clean_caption("   "))
        with self.assertRaises(ShortError):
            clean_caption("x" * 301)

    def test_ban_lengths(self):
        self.assertIsNone(ShortService.ban_until(None))
        week = ShortService.ban_until(7)
        self.assertTrue(timedelta(days=6) < week - datetime.now(timezone.utc) <= timedelta(days=7))
        self.assertGreater(ShortService.ban_until(0).year, datetime.now(timezone.utc).year + 50)

    def test_admin_upload_rejects_keys_from_elsewhere(self):
        with self.assertRaises(ShortError):
            ShortService.create_admin_short("a1", "songs/raw.mp4", None, None)


class ShortStateTests(SimpleTestCase):
    def _patch_lookup(self, short):
        qs = mock.MagicMock()
        qs.filter.return_value.first.return_value = short
        qs.select_for_update.return_value.filter.return_value.first.return_value = short
        return mock.patch("catalog.models.Short.objects", qs)

    def test_processed_publishes_the_short(self):
        short = fake_short()
        with self._patch_lookup(short), mock.patch.object(short_service.transaction, "atomic"):
            ShortService.mark_processed("s1", {"hlsKey": "shorts/s1/master.m3u8", "thumbnailKey": "t", "durationMs": 9000})
        self.assertEqual(short.status, "READY")
        self.assertEqual(short.hls_key, "shorts/s1/master.m3u8")
        self.assertIsNotNone(short.published_at)

    def test_processed_after_delete_cleans_up_instead_of_publishing(self):
        short = fake_short(status="DELETED")
        events = mock.Mock()
        with self._patch_lookup(short), mock.patch.object(short_service.transaction, "atomic"), \
                mock.patch.object(ShortService, "_events", return_value=events):
            ShortService.mark_processed("s1", {"hlsKey": "k"})
        self.assertEqual(short.status, "DELETED")
        events.send_event.assert_called_once()
        self.assertEqual(events.send_event.call_args[0][0], "shorts/delete")

    def test_failed_records_the_reason(self):
        short = fake_short()
        with self._patch_lookup(short):
            ShortService.mark_failed("s1", "Shorts can be at most 60 seconds")
        self.assertEqual(short.status, "FAILED")
        self.assertIn("60 seconds", short.failure_reason)

    def test_only_published_shorts_can_be_hidden(self):
        with self._patch_lookup(fake_short(status="PROCESSING")):
            with self.assertRaises(ShortError) as ctx:
                ShortService.hide("s1", None)
            self.assertEqual(ctx.exception.status_code, 409)
        short = fake_short(status="READY")
        with self._patch_lookup(short):
            ShortService.hide("s1", "spam")
        self.assertEqual(short.status, "HIDDEN")

    def test_unhide_restores_and_resolves_reports(self):
        short = fake_short(status="HIDDEN", hls_key="k", hidden_reason="Reported")
        with self._patch_lookup(short):
            ShortService.unhide("s1")
        self.assertEqual(short.status, "READY")
        short.reports.filter.return_value.update.assert_called_once_with(resolved=True)

    def test_deleting_while_processing_cancels_the_pipeline(self):
        short = fake_short(status="PROCESSING")
        events = mock.Mock()
        with self._patch_lookup(short), mock.patch.object(ShortService, "_events", return_value=events):
            ShortService.delete("s1")
        names = [c[0][0] for c in events.send_event.call_args_list]
        self.assertEqual(names, ["shorts/cancel", "shorts/delete"])
        self.assertEqual(short.status, "DELETED")


class ShortViewsTests(SimpleTestCase):
    def setUp(self):
        self.factory = RequestFactory()
        self.admin = AdminUser(user_id="admin-1", email="admin@example.com", role="ADMIN")

    def _call(self, view, method, path, data=None, **kwargs) -> Any:
        request = getattr(self.factory, method)(path, data=data or {}, content_type="application/json")
        force_authenticate(request, user=self.admin)
        return view.as_view()(request, **kwargs)

    @mock.patch("catalog.shorts_views.S3Service.generate_presigned_upload_url", return_value="https://s3/put")
    def test_upload_url_only_for_videos(self, _):
        ok = self._call(ShortUploadUrlView, "post", "/admin/shorts/upload-url", {"contentType": "video/mp4"})
        self.assertEqual(ok.status_code, 200)
        self.assertTrue(ok.data["rawKey"].startswith("shorts-raw/"))
        bad = self._call(ShortUploadUrlView, "post", "/admin/shorts/upload-url", {"contentType": "image/png"})
        self.assertEqual(bad.status_code, 400)
        request = self.factory.get("/admin/shorts/upload-url", {"contentType": "video/quicktime"})
        force_authenticate(request, user=self.admin)
        get = ShortUploadUrlView.as_view()(request)
        self.assertEqual(get.status_code, 200)
        self.assertTrue(get.data["key"].endswith(".mov"))
        self.assertEqual(get.data["preSignedUrl"], "https://s3/put")

    def test_create_maps_errors_to_status_codes(self):
        with mock.patch.object(ShortService, "create_admin_short", side_effect=ShortError("Song not found", 404)):
            response = self._call(ShortListView, "post", "/admin/shorts", {"rawKey": "shorts-raw/a.mp4", "songId": "nope"})
        self.assertEqual(response.status_code, 404)

    def test_hide_conflict_is_409(self):
        with mock.patch.object(ShortService, "hide", side_effect=ShortError("not published", 409)):
            response = self._call(ShortHideView, "post", "/admin/shorts/s1/hide", {}, pk="s1")
        self.assertEqual(response.status_code, 409)

    def test_processed_webhook_requires_an_hls_key(self):
        response = self._call(WebhookShortProcessedView, "post", "/webhook/short/s1/processed", {}, short_id="s1")
        self.assertEqual(response.status_code, 400)
        with mock.patch.object(ShortService, "mark_processed", return_value=fake_short(status="READY", hls_key="k")):
            ok = self._call(WebhookShortProcessedView, "post", "/webhook/short/s1/processed", {"hlsKey": "k"}, short_id="s1")
        self.assertEqual(ok.status_code, 200)
        self.assertEqual(ok.data["status"], "READY")

    def test_failed_webhook(self):
        with mock.patch.object(ShortService, "mark_failed") as failed:
            response = self._call(WebhookShortFailedView, "post", "/webhook/short/s1/failed", {"reason": "too long"}, short_id="s1")
        self.assertEqual(response.status_code, 200)
        failed.assert_called_once_with("s1", "too long")
