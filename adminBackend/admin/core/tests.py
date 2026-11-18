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


class HeartbeatMetricTests(SimpleTestCase):
    def test_heartbeat_increments_counter_even_if_redis_is_down(self):
        from unittest import mock
        # pyrefly: ignore[missing-import]
        from core.services import system_health_service as shs

        with mock.patch.object(shs, "HEARTBEAT_COUNTER") as counter, mock.patch(
            "core.services.redis_service.RedisService.get_client", side_effect=RuntimeError("redis down")
        ):
            ack = shs.SystemHealthService.record_audio_processing_heartbeat({"status": "UP", "activeJobs": 1})

        self.assertTrue(ack["ack"])
        counter.add.assert_called_once_with(1, {"status": "UP"})
