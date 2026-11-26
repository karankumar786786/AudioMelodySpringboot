"""core app ke models. Saare models managed=False hain: tables Flyway (migration/) banata hai, Django sirf padhta/likhta hai."""
import uuid
from django.db import models


def generate_uuid() -> str:
    """Nayi UUID string (primary key ke liye)."""
    return str(uuid.uuid4())


class PaginationMetadata(models.Model):
    """Table pagination_metadata: har entity ke pehle se gine hue counts (total / active / blocked / deleted)."""
    id = models.CharField(primary_key=True, max_length=255)
    entity_name = models.CharField(unique=True, max_length=255, db_column="entity_name")
    total_count = models.BigIntegerField(default=0, db_column="total_count")
    active_count = models.BigIntegerField(default=0, db_column="active_count")
    blocked_count = models.BigIntegerField(default=0, db_column="blocked_count")
    deleted_count = models.BigIntegerField(default=0, db_column="deleted_count")
    updated_at = models.DateTimeField(auto_now=True, db_column="updated_at")

    class Meta:
        managed = False
        db_table = "pagination_metadata"

    def __str__(self):
        return f"{self.entity_name} (Total: {self.total_count})"
