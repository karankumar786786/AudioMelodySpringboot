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

    def test_email_service_send_otp_email_sync(self):
        from unittest.mock import patch
        from core.services.email_service import EmailService

        with patch("django.core.mail.EmailMultiAlternatives.send", return_value=1) as mock_send:
            success = EmailService.send_otp_email(
                to_email="test@example.com",
                purpose="LOGIN",
                otp="123456",
                async_delivery=False,
            )
            self.assertTrue(success)
            self.assertEqual(mock_send.call_count, 1)

    def test_email_service_send_otp_email_async(self):
        from unittest.mock import patch
        from core.services.email_service import EmailService

        with patch("threading.Thread.start") as mock_thread_start:
            success = EmailService.send_otp_email(
                to_email="test@example.com",
                purpose="REGISTER",
                otp="654321",
                async_delivery=True,
            )
            self.assertTrue(success)
            self.assertEqual(mock_thread_start.call_count, 1)

    def test_email_service_handles_exception_gracefully(self):
        from unittest.mock import patch
        from core.services.email_service import EmailService

        with patch("django.core.mail.EmailMultiAlternatives.send", side_effect=Exception("SMTP Connection Error")):
            success = EmailService.send_mail_direct(
                to_email="test@example.com",
                subject="Test",
                text_content="Body",
            )
            self.assertFalse(success)

