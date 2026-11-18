import json
from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase

from core.services.algolia_service import AlgoliaService
from core.services.lyrics_service import (
    LyricsService,
    strip_lrc_timestamps,
    to_searchable_lyrics,
    truncate_utf8,
)


class LyricsNormalisationTests(SimpleTestCase):
    def test_strips_line_and_word_timestamps_and_metadata(self):
        synced = (
            "[ar:Arijit Singh]\n[ti:Tum Hi Ho]\n[offset:+200]\n"
            "[00:12.34]Hum tere bin ab\n"
            "[00:15.00][01:30.50]  Reh nahi sakte  \n"
            "[00:18:20]<00:18.20>Tere <00:18.90>bina\n"
            "[00:21.00]\n"
        )
        self.assertEqual(
            strip_lrc_timestamps(synced),
            "Hum tere bin ab\nReh nahi sakte\nTere bina",
        )

    def test_plain_text_kept_and_blank_lines_collapsed(self):
        self.assertEqual(strip_lrc_timestamps("a\r\n\r\n\nb [chorus]\n"), "a\nb [chorus]")
        self.assertEqual(strip_lrc_timestamps(None), "")

    def test_truncate_respects_byte_budget_and_multibyte_chars(self):
        text = "तुम ही हो " * 500  # Devanagari: 3 bytes per char
        out = truncate_utf8(text, 1000)
        self.assertLessEqual(len(out.encode("utf-8")), 1000)
        self.assertTrue(text.startswith(out))
        # never splits a code point
        out.encode("utf-8").decode("utf-8")

    def test_truncate_prefers_word_boundary(self):
        self.assertEqual(truncate_utf8("hello wonderful world", 17), "hello wonderful")
        self.assertEqual(truncate_utf8("short", 100), "short")

    def test_to_searchable_prefers_plain_then_synced(self):
        self.assertEqual(to_searchable_lyrics("Line one", "[00:01.00]Other"), "Line one")
        self.assertEqual(to_searchable_lyrics(None, "[00:01.00]Other"), "Other")
        self.assertIsNone(to_searchable_lyrics("", "  "))
        self.assertEqual(len(to_searchable_lyrics("x " * 10000, max_bytes=6000).encode()), 5999)


class LyricsServiceLookupTests(SimpleTestCase):
    def test_redis_cache_hit_skips_lrclib(self):
        redis = MagicMock()
        redis.mget.return_value = [json.dumps({"plainLyrics": "Cached words", "syncedLyrics": None})]
        with patch("core.services.redis_service.RedisService.get_client", return_value=redis), \
             patch("core.services.lyrics_service.requests.get") as http:
            self.assertEqual(LyricsService.get_lyrics("s1", "123"), "Cached words")
            http.assert_not_called()

    def test_cold_cache_falls_back_to_lrclib_only_with_valid_id(self):
        redis = MagicMock()
        redis.mget.return_value = [None, json.dumps({"plainLyrics": None, "syncedLyrics": None}), None]
        resp = MagicMock(status_code=200)
        resp.json.return_value = {"syncedLyrics": "[00:01.00]From lrclib", "instrumental": False}
        with patch("core.services.redis_service.RedisService.get_client", return_value=redis), \
             patch("core.services.lyrics_service.requests.get", return_value=resp) as http:
            out = LyricsService.get_many({"s1": "42", "s2": "43", "s3": "0"})
        self.assertEqual(out, {"s1": "From lrclib", "s2": "From lrclib", "s3": None})
        self.assertEqual(http.call_count, 2)

    def test_instrumental_and_failures_return_none(self):
        with patch("core.services.redis_service.RedisService.get_client", side_effect=Exception("down")), \
             patch("core.services.lyrics_service.requests.get", side_effect=Exception("timeout")):
            self.assertIsNone(LyricsService.get_lyrics("s1", "42"))


class AlgoliaLyricsRecordTests(SimpleTestCase):
    def test_build_song_record_includes_lyrics(self):
        rec = AlgoliaService.build_song_record({"id": "s1", "title": "T"}, lyrics="la la")
        self.assertEqual(rec["lyrics"], "la la")
        self.assertIsNone(AlgoliaService.build_song_record({"id": "s2"})["lyrics"])

    def test_reindex_fetches_lyrics_in_bulk(self):
        client = MagicMock()
        song = MagicMock(id="s1", job_id=None, lrclib_id="42", title="T", artist_name="A",
                         album=None, genre=None, country="India", image_key="", duration=1,
                         language="", preview_start_time=None, preview_end_time=None,
                         clip_start_sec=None, clip_end_sec=None, total_streams=0, search_count=0,
                         song_key="", video_key=None, full_video_key=None, is_featured=False,
                         status="ACTIVE", created_at=None)
        with patch.object(AlgoliaService, "get_client", return_value=client), \
             patch.object(LyricsService, "get_many", return_value={"s1": "words"}) as get_many:
            AlgoliaService.reindex_all_active_songs([song], jobs_by_song_id={})
        get_many.assert_called_once_with({"s1": "42"})
        saved = client.save_objects.call_args.kwargs["objects"][0]
        self.assertEqual(saved["lyrics"], "words")

    def test_configure_index_makes_lyrics_low_priority_and_unretrieved(self):
        client = MagicMock()
        with patch.object(AlgoliaService, "get_client", return_value=client):
            AlgoliaService.configure_index()
        cfg = client.set_settings.call_args.kwargs["index_settings"]
        self.assertEqual(cfg["searchableAttributes"][-1], "unordered(lyrics)")
        self.assertIn("-lyrics", cfg["attributesToRetrieve"])
        self.assertNotIn("lyrics", cfg["attributesToHighlight"])
        self.assertEqual(cfg["attributesToSnippet"], ["lyrics:12"])
