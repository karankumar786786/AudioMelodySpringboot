from django.contrib import admin
from .models import DeleteJob, Job


@admin.register(Job)
class JobAdmin(admin.ModelAdmin):
    list_display = ("title", "artist_name", "status", "current_stage", "transcoding_attempt", "created_at")
    search_fields = ("title", "artist_name", "id", "song_id")
    list_filter = ("status", "current_stage")


@admin.register(DeleteJob)
class DeleteJobAdmin(admin.ModelAdmin):
    list_display = ("entity_type", "entity_id", "entity_title", "status", "current_stage", "attempt_count", "created_at")
    search_fields = ("entity_id", "entity_title")
    list_filter = ("status", "current_stage", "entity_type")
