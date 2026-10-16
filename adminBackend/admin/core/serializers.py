from rest_framework import serializers
from .models import PaginationMetadata


class PaginationMetadataSerializer(serializers.ModelSerializer):
    entityName = serializers.CharField(source="entity_name")
    totalCount = serializers.IntegerField(source="total_count")
    activeCount = serializers.IntegerField(source="active_count")
    blockedCount = serializers.IntegerField(source="blocked_count")
    deletedCount = serializers.IntegerField(source="deleted_count")

    class Meta:
        model = PaginationMetadata
        fields = [
            "id",
            "entityName",
            "totalCount",
            "activeCount",
            "blockedCount",
            "deletedCount",
        ]
