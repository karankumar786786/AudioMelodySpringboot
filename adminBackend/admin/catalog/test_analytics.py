import shutil
import tempfile
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest import mock

from django.db import connection
from django.test import RequestFactory, SimpleTestCase, TestCase, override_settings
from rest_framework.test import force_authenticate

from catalog import analytics_views
from catalog.analytics_views import AnalyticsOverviewView, SongAnalyticsView, build_timeline, parse_range
from core.authentication import AdminUser
from core.services import lake_service

TABLES = [
    """CREATE TABLE song_listen_daily (song_id TEXT, day DATE, plays INT, qualified_streams INT,
         completions INT, skips INT, listened_ms INT, PRIMARY KEY (song_id, day))""",
    """CREATE TABLE song_quality_daily (song_id TEXT, day DATE, quality TEXT, platform TEXT, plays INT,
         listened_ms INT, startup_ms_sum INT, startup_samples INT, rebuffer_count INT, rebuffer_ms INT)""",
    """CREATE TABLE song_timeline (song_id TEXT, sec INT, listens INT, exits INT, skips INT,
         seeks_away INT, seeks_into INT, PRIMARY KEY (song_id, sec))""",
    "CREATE TABLE user_history (id TEXT PRIMARY KEY, user_id TEXT, song_id TEXT, part INT, listened_at TIMESTAMP)",
    "CREATE TABLE user_favourite_songs (user_id TEXT, song_id TEXT)",
    "CREATE TABLE user_playlist_songs (user_playlist_id TEXT, song_id TEXT)",
    "CREATE TABLE shorts (id TEXT, song_id TEXT, status TEXT)",
]


def fake_song(**over):
    base = dict(
        id="song1", title="Song", artist_name="Artist", duration=40, song_key="songs/k", image_key="img",
        status="ACTIVE", created_at=None, metadata=SimpleNamespace(total_streams=12),
    )
    base.update(over)
    return SimpleNamespace(**base)


def admin_get(view, path, **kwargs):
    request = RequestFactory().get(path)
    force_authenticate(request, user=AdminUser(user_id="a1", email="a@example.com", role="ADMIN"))
    return view.as_view()(request, **kwargs)


class TimelineTests(SimpleTestCase):
    def test_retention_is_relative_to_the_first_second(self):
        rows = [(0, 10, 0, 0, 0, 0), (1, 8, 2, 0, 0, 0), (2, 5, 3, 1, 0, 0)]
        t = build_timeline(rows, 3)
        self.assertEqual([s["retention"] for s in t["seconds"]], [1.0, 0.8, 0.5])
        self.assertEqual(t["summary"]["trackedPlays"], 10)
        self.assertEqual(t["summary"]["totalSkips"], 1)
        self.assertEqual(t["summary"]["earlyExitRate"], 1.0)

    def test_seconds_without_rows_are_zero(self):
        t = build_timeline([(0, 4, 0, 0, 0, 0), (3, 2, 0, 0, 0, 0)], 5)
        self.assertEqual([s["listens"] for s in t["seconds"]], [4, 0, 0, 2, 0])

    def test_hooks_are_where_listeners_come_back(self):
        # 60 s song: steady decay, then a replayed chorus at 30-39 s.
        rows = []
        for s in range(60):
            listens = 100 - s
            seeks_into = 0
            if 30 <= s < 40:
                listens += 40
                seeks_into = 5 if s == 30 else 0
            rows.append((s, listens, 1, 0, 0, seeks_into))
        hooks = build_timeline(rows, 60)["hooks"]
        self.assertTrue(hooks)
        self.assertTrue(any(h["startSec"] <= 30 < h["endSec"] for h in hooks))
        self.assertLessEqual(len(hooks), 3)

    def test_no_replays_means_no_hooks(self):
        rows = [(s, 50 - s, 1, 0, 0, 0) for s in range(30)]
        self.assertEqual(build_timeline(rows, 30)["hooks"], [])


class RangeTests(SimpleTestCase):
    def test_ranges(self):
        label, start, end, ps, pe = parse_range("7d")
        self.assertEqual(label, "7d")
        self.assertEqual((end - start).days, 6)
        self.assertEqual((pe - ps).days, 6)
        self.assertEqual(pe, start - timedelta(days=1))
        self.assertEqual(parse_range("bogus")[0], "30d")
        self.assertIsNone(parse_range("all")[1])


class LakeServiceTests(SimpleTestCase):
    """DuckDB over local Parquet files laid out the way the lake writer does."""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        import duckdb

        cls.tmp = tempfile.mkdtemp()
        today = date.today()
        old = today - timedelta(days=40)
        base = Path(cls.tmp) / "events" / "topic=listening.play.v1"

        def ms(d: date, hour: int) -> int:
            return int(datetime(d.year, d.month, d.day, hour, tzinfo=timezone.utc).timestamp() * 1000)

        days = {
            today: [
                ("e1", "u1", "song1", ms(today, 9), 0.95, 200000, 190000, "ios"),
                ("e1", "u1", "song1", ms(today, 9), 0.95, 200000, 190000, "ios"),  # duplicate delivery
                ("e2", "u2", "song1", ms(today, 21), 0.05, 200000, 10000, "web"),
                ("e3", "u3", "song2", ms(today, 21), 0.5, 200000, 100000, "android"),
            ],
            old: [("e0", "u1", "song1", ms(old, 8), 1.0, 200000, 200000, "ios")],
        }
        conn = duckdb.connect()
        for d, rows in days.items():
            folder = base / f"dt={d.isoformat()}"
            folder.mkdir(parents=True)
            conn.execute(
                "CREATE OR REPLACE TABLE t (event_id VARCHAR, user_id VARCHAR, song_id VARCHAR, occurred_at BIGINT,"
                " received_at BIGINT, listened_ratio DOUBLE, duration_ms BIGINT, exit_ms BIGINT, platform VARCHAR)"
            )
            for r in rows:
                conn.execute("INSERT INTO t VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", [r[0], r[1], r[2], r[3], r[3], *r[4:]])
            conn.execute(f"COPY t TO '{folder}/part.parquet' (FORMAT parquet)")
        conn.close()
        cls.settings_override = override_settings(LAKE_URI=cls.tmp, DUCKDB_EXTENSION_DIRECTORY="")
        cls.settings_override.enable()
        cls.redis = mock.patch("core.services.redis_service.RedisService.get_client", side_effect=RuntimeError("no redis"))
        cls.redis.start()
        lake_service.reset_connection()

    @classmethod
    def tearDownClass(cls):
        cls.redis.stop()
        cls.settings_override.disable()
        lake_service.reset_connection()
        shutil.rmtree(cls.tmp, ignore_errors=True)
        super().tearDownClass()

    def test_audience_drops_duplicates_and_finds_returning_listeners(self):
        today = date.today()
        a = lake_service.song_audience("song1", today - timedelta(days=6), today)
        self.assertEqual(a["plays"], 2)
        self.assertEqual(a["listeners"], 2)
        self.assertEqual(a["returningListeners"], 1)  # u1 also listened 40 days ago

    def test_missing_days_are_empty_not_errors(self):
        today = date.today()
        a = lake_service.song_audience("song1", today - timedelta(days=20), today - timedelta(days=10))
        self.assertEqual(a["plays"], 0)

    def test_when_and_platforms(self):
        today = date.today()
        when = lake_service.song_when_listened("song1", today, today)
        self.assertEqual(sorted(w["hour"] for w in when), [9, 21])
        platforms = {p["platform"]: p["plays"] for p in lake_service.song_platforms("song1", today, today)}
        self.assertEqual(platforms, {"ios": 1, "web": 1})

    def test_skipped_intros(self):
        today = date.today()
        rows = lake_service.skipped_intros(today, today, min_plays=1)
        by_song = {r["songId"]: r for r in rows}
        self.assertEqual(by_song["song1"]["earlyExits"], 1)
        self.assertEqual(by_song["song2"]["earlyExits"], 0)

    def test_daily_audience_and_retention(self):
        today = date.today()
        daily = lake_service.daily_audience(today - timedelta(days=1), today)
        self.assertEqual(daily[-1]["plays"], 3)
        self.assertEqual(daily[-1]["listeners"], 3)
        self.assertTrue(lake_service.weekly_retention(8))

    def test_unset_lake_is_unavailable(self):
        with override_settings(LAKE_URI=""):
            with self.assertRaises(lake_service.LakeUnavailable):
                lake_service.song_audience("x", None, date.today())


@override_settings(LAKE_URI="")
class AnalyticsViewTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        today = date.today()
        with connection.cursor() as cur:
            for ddl in TABLES:
                cur.execute(ddl)
            for i in range(3):
                d = (today - timedelta(days=i)).isoformat()
                cur.execute("INSERT INTO song_listen_daily VALUES ('song1', %s, 10, 8, 6, 2, 3600000)", [d])
            cur.execute(
                "INSERT INTO song_listen_daily VALUES ('song1', %s, 5, 4, 3, 1, 0)",
                [(today - timedelta(days=10)).isoformat()],
            )
            cur.execute(
                "INSERT INTO song_quality_daily VALUES ('song1', %s, '320kbps', 'ios', 10, 3600000, 4000, 10, 2, 500)",
                [today.isoformat()],
            )
            for s in range(5):
                cur.execute("INSERT INTO song_timeline VALUES ('song1', %s, %s, 1, 0, 0, 0)", [s, 10 - s])
            now = datetime.now().replace(microsecond=0).isoformat(sep=" ")
            cur.execute("INSERT INTO user_history VALUES ('h1', 'u1', 'song1', 100, %s)", [now])
            cur.execute("INSERT INTO user_history VALUES ('h2', 'u2', 'song1', 40, %s)", [now])
            cur.execute("INSERT INTO user_history VALUES ('h3', 'u2', 'song2', 95, %s)", [now])
            cur.execute("INSERT INTO user_favourite_songs VALUES ('u1', 'song1')")
            cur.execute("INSERT INTO user_playlist_songs VALUES ('p1', 'song1')")
            cur.execute("INSERT INTO shorts VALUES ('s1', 'song1', 'READY')")
            cur.execute("INSERT INTO shorts VALUES ('s2', 'song1', 'HIDDEN')")

    def _song(self, song):
        return mock.patch.object(analytics_views, "get_object_or_404", return_value=song)

    def test_song_analytics_from_aggregates(self):
        with self._song(fake_song()):
            res = admin_get(SongAnalyticsView, "/admin/song/song1/analytics?range=7d", pk="song1")
        self.assertEqual(res.status_code, 200)
        data = res.data
        cur = data["kpis"]["current"]
        self.assertEqual(cur["source"], "events")
        self.assertEqual(cur["plays"], 30)
        self.assertEqual(cur["completions"], 18)
        self.assertEqual(cur["completionRate"], 0.6)
        self.assertEqual(cur["skipRate"], round(6 / 30, 4))
        self.assertEqual(cur["listenedHours"], 3.0)
        self.assertEqual(cur["listeners"], 2)
        self.assertEqual(cur["avgListened"], 0.7)
        self.assertEqual(data["kpis"]["previous"]["plays"], 5)
        self.assertEqual(data["kpis"]["change"]["plays"], 5.0)
        self.assertEqual(len(data["daily"]), 3)
        self.assertEqual(data["engagement"], {"favourites": 1, "playlistAdds": 1, "shorts": 1})
        self.assertEqual(len(data["timeline"]["seconds"]), 40)  # padded to the song length
        q = data["quality"][0]
        self.assertEqual((q["quality"], q["avgStartupMs"], q["rebuffersPerPlay"]), ("320kbps", 400, 0.2))
        self.assertFalse(data["lake"]["available"])

    def test_song_without_events_falls_back_to_history(self):
        with self._song(fake_song(id="song2")):
            res = admin_get(SongAnalyticsView, "/admin/song/song2/analytics?range=30d", pk="song2")
        cur = res.data["kpis"]["current"]
        self.assertEqual(cur["source"], "history")
        self.assertEqual(cur["plays"], 1)
        self.assertEqual(cur["completions"], 1)
        self.assertIsNone(cur["skipRate"])
        self.assertEqual(res.data["daily"][0]["plays"], 1)
        self.assertEqual(res.data["timeline"]["seconds"], [])

    def test_overview(self):
        res = admin_get(AnalyticsOverviewView, "/admin/analytics/overview?range=7d")
        self.assertEqual(res.status_code, 200)
        top = res.data["topSongs"]
        self.assertEqual(top[0]["songId"], "song1")
        self.assertEqual(top[0]["plays"], 30)
        self.assertEqual(res.data["qualityMix"][0]["quality"], "320kbps")
        self.assertEqual(res.data["kpis"]["current"]["plays"], 30)
        self.assertFalse(res.data["lake"]["available"])
