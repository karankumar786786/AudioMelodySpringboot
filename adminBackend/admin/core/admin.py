from django.contrib import admin
from .models import PaginationMetadata

@admin.register(PaginationMetadata)
class PaginationMetadataAdmin(admin.ModelAdmin):
    list_display = ("entity_name", "total_count", "active_count", "blocked_count", "deleted_count")
    search_fields = ("entity_name",)
