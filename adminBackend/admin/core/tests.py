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
