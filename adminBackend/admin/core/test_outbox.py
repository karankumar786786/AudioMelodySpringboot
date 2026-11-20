import uuid
from unittest import mock

from django.test import SimpleTestCase, override_settings

from catalog.signals import classify_change
from core.services import outbox_service
from core.services.outbox_service import OutboxService, address_key, events_enabled


class OutboxModeTests(SimpleTestCase):
    @override_settings(EVENTS_MODE="LEGACY")
    def test_legacy_mode_is_off(self):
        self.assertFalse(events_enabled())

    @override_settings(EVENTS_MODE="dual")
    def test_dual_and_kafka_are_on(self):
        self.assertTrue(events_enabled())

    def test_address_key_hides_the_address_and_ignores_case(self):
        self.assertEqual(address_key("A@B.com "), address_key("a@b.com"))
        self.assertNotIn("@", address_key("a@b.com"))

    def test_uuid7_is_version_7(self):
        self.assertEqual(outbox_service._uuid7().version, 7)


class SongChangeTests(SimpleTestCase):
    def test_classify(self):
        self.assertEqual(classify_change(True, None, "ACTIVE"), "PUBLISHED")
        self.assertEqual(classify_change(True, None, "PROCESSING"), "CREATED")
        self.assertEqual(classify_change(False, "ACTIVE", "DELETED"), "DELETED")
        self.assertEqual(classify_change(False, "BLOCKED", "ACTIVE"), "PUBLISHED")
        self.assertEqual(classify_change(False, "ACTIVE", "BLOCKED"), "UNPUBLISHED")
        self.assertEqual(classify_change(False, "ACTIVE", "ACTIVE"), "UPDATED")


class OutboxWriteTests(SimpleTestCase):
    @override_settings(KAFKA_REST_PROXY_URL="http://redpanda:8082")
    def test_wake_posts_to_the_http_proxy(self):
        with mock.patch.object(outbox_service.requests, "post") as post:
            OutboxService.wake()
        url = post.call_args[0][0]
        self.assertEqual(url, "http://redpanda:8082/topics/outbox.wakeup.v1")

    @override_settings(KAFKA_REST_PROXY_URL="")
    def test_wake_is_skipped_without_a_proxy(self):
        with mock.patch.object(outbox_service.requests, "post") as post:
            OutboxService.wake()
        post.assert_not_called()

    def test_write_email_stores_a_hashed_key_and_runs_the_fallback_only_if_unsent(self):
        row_id = uuid.uuid4()
        fallback = mock.Mock()
        with mock.patch.object(OutboxService, "write", return_value=row_id) as write, \
                mock.patch.object(OutboxService, "claim_unsent", return_value=True) as claim, \
                mock.patch.object(outbox_service.connection, "close"):
            OutboxService.write_email("a@b.com", "LOGIN", "LOGIN", "123456", fallback=fallback, fallback_after=0.01)
            import time
            time.sleep(0.3)
        topic, key, payload = write.call_args[0]
        self.assertEqual(topic, "notification.email.v1")
        self.assertEqual(key, address_key("a@b.com"))
        self.assertEqual(payload["body"], "123456")
        claim.assert_called_once_with(row_id)
        fallback.assert_called_once()

    def test_fallback_does_not_run_when_the_relay_already_sent_it(self):
        fallback = mock.Mock()
        with mock.patch.object(OutboxService, "write", return_value=uuid.uuid4()), \
                mock.patch.object(OutboxService, "claim_unsent", return_value=False), \
                mock.patch.object(outbox_service.connection, "close"):
            OutboxService.write_email("a@b.com", "LOGIN", "LOGIN", "1", fallback=fallback, fallback_after=0.01)
            import time
            time.sleep(0.3)
        fallback.assert_not_called()


class AdminOtpRoutingTests(SimpleTestCase):
    @override_settings(EVENTS_MODE="KAFKA", DEBUG=False)
    def test_kafka_mode_uses_the_outbox(self):
        from core.services.admin_auth_service import AdminAuthService

        with mock.patch.object(OutboxService, "write_email") as write_email, \
                mock.patch("core.services.admin_auth_service.RedisService") as redis_service:
            AdminAuthService.notify_otp("a@b.com", "LOGIN", "654321")
        args = write_email.call_args[0]
        self.assertEqual(args[:4], ("a@b.com", "LOGIN", "LOGIN", "654321"))
        redis_service.get_client.return_value.rpush.assert_not_called()

    @override_settings(EVENTS_MODE="LEGACY", DEBUG=False)
    def test_legacy_mode_keeps_the_redis_queue(self):
        from core.services.admin_auth_service import AdminAuthService

        with mock.patch.object(OutboxService, "write_email") as write_email, \
                mock.patch("core.services.admin_auth_service.RedisService") as redis_service:
            AdminAuthService.notify_otp("a@b.com", "LOGIN", "654321")
        write_email.assert_not_called()
        redis_service.get_client.return_value.rpush.assert_called_once()
