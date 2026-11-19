from django.test import SimpleTestCase
# pyrefly: ignore[missing-import]
from core.helpers import format_ms, format_paginated_response, safe_diff_ms
# pyrefly: ignore[missing-import]
from core.models import PaginationMetadata
# pyrefly: ignore[missing-import]
from core.serializers import PaginationMetadataSerializer


class CoreAppTests(SimpleTestCase):
    def test_format_ms(self):
        self.assertEqual(format_ms(None), "-")
        self.assertEqual(format_ms(450), "450ms")
        self.assertEqual(format_ms(1500), "1.5s")
        self.assertEqual(format_ms(60000), "60.0s")

    def test_safe_diff_ms(self):
        from datetime import datetime, timezone, timedelta
        t1 = datetime(2026, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
        t2 = t1 + timedelta(seconds=2.5)
        self.assertEqual(safe_diff_ms(t2, t1), 2500)
        self.assertIsNone(safe_diff_ms(None, t1))
        self.assertIsNone(safe_diff_ms(t2, None))

    def test_format_paginated_response(self):
        meta = PaginationMetadata(
            id="test-meta",
            entity_name="TEST_ENTITY",
            total_count=100,
            active_count=80,
            blocked_count=5,
            deleted_count=15,
        )
        data = format_paginated_response(
            content=[{"id": "1", "name": "Item 1"}],
            page=0,
            size=10,
            metadata=meta,
        )
        self.assertEqual(data["page"], 0)
        self.assertEqual(data["size"], 10)
        self.assertEqual(len(data["content"]), 1)
        self.assertEqual(data["paginationMetaData"]["entityName"], "TEST_ENTITY")
        self.assertEqual(data["paginationMetaData"]["totalCount"], 100)
        self.assertEqual(data["paginationMetaData"]["activeCount"], 80)

    def test_pagination_serializer(self):
        meta = PaginationMetadata(
            id="meta-1",
            entity_name="SONG",
            total_count=50,
            active_count=45,
            blocked_count=2,
            deleted_count=3,
        )
        serializer = PaginationMetadataSerializer(meta)
        data = serializer.data
        self.assertEqual(data["entityName"], "SONG")
        self.assertEqual(data["totalCount"], 50)
        self.assertEqual(data["activeCount"], 45)


class SecuritySettingsTests(SimpleTestCase):
    """Production-safety checks for settings and admin OTP handling."""

    def _import_settings(self, env):
        import os
        import subprocess
        import sys
        from pathlib import Path

        base_env = {k: v for k, v in os.environ.items()
                    if k not in ("DJANGO_DEBUG", "DJANGO_SECRET_KEY")}
        base_env.update(env)
        # Run outside "manage.py test" so the test-mode key fallback doesn't apply.
        code = ("import sys; sys.argv=['gunicorn'];"
                "import admin.settings as s; print('DEBUG=' + str(s.DEBUG))")
        return subprocess.run(
            [sys.executable, "-c", code],
            cwd=str(Path(__file__).resolve().parent.parent),
            env=base_env, capture_output=True, text=True, timeout=60,
        )

    def test_refuses_to_start_without_secret_key_when_not_debug(self):
        # Empty values override anything load_dotenv would pick up from local .env files.
        result = self._import_settings({"DJANGO_DEBUG": "false", "DJANGO_SECRET_KEY": ""})
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("DJANGO_SECRET_KEY is not set", result.stderr)

    def test_debug_defaults_to_off(self):
        result = self._import_settings({"DJANGO_DEBUG": "", "DJANGO_SECRET_KEY": "x" * 64})
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("DEBUG=False", result.stdout)

    def test_otp_is_never_logged_or_printed_outside_debug(self):
        import io
        from contextlib import redirect_stdout
        from unittest.mock import patch
        from django.test import override_settings
        # pyrefly: ignore[missing-import]
        from core.services.admin_auth_service import AdminAuthService

        otp = "917364"
        out = io.StringIO()
        with override_settings(DEBUG=False), \
                patch("core.services.admin_auth_service.RedisService.get_client"), \
                self.assertLogs("core.services.admin_auth_service", level="DEBUG") as logs, \
                redirect_stdout(out):
            AdminAuthService.notify_otp("admin@example.com", "LOGIN", otp)
        self.assertNotIn(otp, out.getvalue())
        self.assertFalse(any(otp in line for line in logs.output))


class AdminSessionTouchTests(SimpleTestCase):
    """The session is renewed at most every SESSION_TOUCH_INTERVAL_SECONDS (each renewal costs Redis commands)."""

    TTL = 7 * 86400

    def setUp(self):
        # pyrefly: ignore[missing-import]
        from core.services.redis_service import RedisService

        self.RedisService = RedisService
        RedisService._MEMORY_SESSIONS.pop("sess-1", None)

    def tearDown(self):
        self.RedisService._MEMORY_SESSIONS.pop("sess-1", None)

    def test_recently_renewed_session_is_not_written(self):
        import time
        from unittest.mock import patch

        session = {"sessionId": "sess-1", "expiresAt": time.time() + self.TTL - 60}
        with patch.object(self.RedisService, "get_client") as get_client:
            self.RedisService.touch_admin_session("sess-1", session=session)
        get_client.assert_not_called()

    def test_due_session_is_written_once_without_a_second_get(self):
        import json
        import time
        from unittest.mock import MagicMock, patch

        session = {"sessionId": "sess-1", "email": "a@example.com", "expiresAt": time.time() + 3600}
        self.RedisService._MEMORY_SESSIONS["sess-1"] = dict(session)
        client = MagicMock()
        with patch.object(self.RedisService, "get_client", return_value=client):
            self.RedisService.touch_admin_session("sess-1", session=session)

        client.get.assert_not_called()
        client.setex.assert_called_once()
        key, ttl, payload = client.setex.call_args.args
        self.assertEqual(key, "admin:session:sess-1")
        self.assertEqual(ttl, self.TTL)
        written = json.loads(payload)
        self.assertGreater(written["expiresAt"], time.time() + self.TTL - 5)
        self.assertEqual(written["email"], "a@example.com")
        # The worker's in-memory copy moves with it, so the next request skips the write.
        self.assertEqual(self.RedisService._MEMORY_SESSIONS["sess-1"]["expiresAt"], written["expiresAt"])

    def test_without_session_data_it_reads_then_writes(self):
        import json
        import time
        from unittest.mock import MagicMock, patch

        client = MagicMock()
        client.get.return_value = json.dumps({"sessionId": "sess-1", "expiresAt": time.time() + 3600})
        with patch.object(self.RedisService, "get_client", return_value=client):
            self.RedisService.touch_admin_session("sess-1")

        client.get.assert_called_once_with("admin:session:sess-1")
        client.setex.assert_called_once()


class AdminSessionStoreTests(SimpleTestCase):
    """
    With several gunicorn workers, Redis is the source of truth for sessions, refresh
    sessions, blocks, OTPs and temp tokens. A worker's in-memory copy may only be used
    while Redis is unreachable, never to revive something Redis says is gone.
    """

    def setUp(self):
        import time

        # pyrefly: ignore[missing-import]
        from core.services.admin_auth_service import AdminAuthService
        # pyrefly: ignore[missing-import]
        from core.services.redis_service import RedisService

        self.RedisService = RedisService
        self.AdminAuthService = AdminAuthService
        self.session = {"sessionId": "sess-x", "email": "a@example.com", "expiresAt": time.time() + 3600}
        RedisService._MEMORY_SESSIONS["sess-x"] = dict(self.session)
        RedisService._MEMORY_USER_SESSIONS.setdefault("a@example.com", set()).add("sess-x")
        RedisService._MEMORY_REFRESH_SESSIONS["ref-x"] = {"refreshSessionId": "ref-x", "expiresAt": time.time() + 3600}
        AdminAuthService._MEMORY_OTP_CACHE["a@example.com"] = {"otp_hash": "h", "expires_at": time.time() + 600}
        AdminAuthService._MEMORY_TEMP_TOKENS["tmp-x"] = {"email": "a@example.com", "expiresAt": time.time() + 600}

    def tearDown(self):
        self.RedisService._MEMORY_SESSIONS.pop("sess-x", None)
        self.RedisService._MEMORY_USER_SESSIONS.get("a@example.com", set()).discard("sess-x")
        self.RedisService._MEMORY_REFRESH_SESSIONS.pop("ref-x", None)
        self.AdminAuthService._MEMORY_OTP_CACHE.pop("a@example.com", None)
        self.AdminAuthService._MEMORY_TEMP_TOKENS.pop("tmp-x", None)

    def _redis(self, **kwargs):
        from unittest.mock import MagicMock, patch

        client = MagicMock(**kwargs)
        return patch.object(self.RedisService, "get_client", return_value=client), client

    def test_session_revoked_on_another_worker_is_rejected(self):
        from django.test import override_settings

        patcher, client = self._redis()
        client.get.return_value = None
        with override_settings(ADMIN_SESSION_STORE="redis"), patcher:
            self.assertIsNone(self.RedisService.get_admin_session("sess-x"))
        self.assertNotIn("sess-x", self.RedisService._MEMORY_SESSIONS)
        self.assertNotIn("sess-x", self.RedisService._MEMORY_USER_SESSIONS["a@example.com"])

    def test_session_read_from_redis_when_present(self):
        import json
        from django.test import override_settings

        patcher, client = self._redis()
        client.get.return_value = json.dumps({**self.session, "userName": "From Redis"})
        with override_settings(ADMIN_SESSION_STORE="redis"), patcher:
            session = self.RedisService.get_admin_session("sess-x")
        self.assertEqual(session["userName"], "From Redis")

    def test_memory_copy_used_only_while_redis_is_down(self):
        from django.test import override_settings

        patcher, client = self._redis()
        client.get.side_effect = ConnectionError("redis down")
        with override_settings(ADMIN_SESSION_STORE="redis"), patcher:
            session = self.RedisService.get_admin_session("sess-x")
        self.assertEqual(session["sessionId"], "sess-x")

    def test_refresh_session_revoked_on_another_worker_is_rejected(self):
        from django.test import override_settings

        patcher, client = self._redis()
        client.get.return_value = None
        with override_settings(ADMIN_SESSION_STORE="redis"), patcher:
            self.assertIsNone(self.RedisService.get_refresh_session("ref-x"))
        self.assertNotIn("ref-x", self.RedisService._MEMORY_REFRESH_SESSIONS)

    def test_block_set_by_another_worker_counts_even_with_local_sessions(self):
        from django.test import override_settings

        patcher, client = self._redis()
        client.exists.return_value = 1
        with override_settings(ADMIN_SESSION_STORE="redis"), patcher:
            self.assertTrue(self.RedisService.is_user_blocked("user-x"))
        client.exists.assert_called_once_with("blocked_user:user-x")

    def test_used_otp_and_temp_token_are_not_revived_from_memory(self):
        from django.test import override_settings

        patcher, client = self._redis()
        client.get.return_value = None
        with override_settings(ADMIN_SESSION_STORE="redis"), patcher:
            self.assertIsNone(self.AdminAuthService.get_otp("a@example.com"))
            self.assertIsNone(self.AdminAuthService.decode_temp_token("tmp-x"))
        self.assertNotIn("a@example.com", self.AdminAuthService._MEMORY_OTP_CACHE)
        self.assertNotIn("tmp-x", self.AdminAuthService._MEMORY_TEMP_TOKENS)

    def test_memory_store_never_calls_redis(self):
        from django.test import override_settings

        patcher, client = self._redis()
        with override_settings(ADMIN_SESSION_STORE="memory"), patcher as get_client:
            self.assertEqual(self.RedisService.get_admin_session("sess-x")["sessionId"], "sess-x")
            self.assertFalse(self.RedisService.is_user_blocked("user-x"))
        get_client.assert_not_called()
