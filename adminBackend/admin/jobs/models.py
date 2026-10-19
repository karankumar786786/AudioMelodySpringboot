from django.db import models
from core.models import generate_uuid


class Job(models.Model):
    id = models.CharField(primary_key=True, max_length=255, default=generate_uuid)
    title = models.CharField(max_length=255)
    artist_name = models.CharField(max_length=255, db_column="artist_name")
    duration = models.IntegerField(blank=True, null=True)
    temp_song_key = models.CharField(max_length=255, blank=True, null=True, db_column="temp_song_key")
    temp_video_key = models.CharField(max_length=255, blank=True, null=True, db_column="temp_video_key")
    song_key = models.CharField(max_length=255, blank=True, null=True, db_column="song_key")
    full_video_key = models.CharField(max_length=255, blank=True, null=True, db_column="full_video_key")
    image_key = models.CharField(max_length=255, db_column="image_key")
    video_key = models.CharField(max_length=255, blank=True, null=True, db_column="video_key")
    clip_start_sec = models.IntegerField(blank=True, null=True, db_column="clip_start_sec")
    clip_end_sec = models.IntegerField(blank=True, null=True, db_column="clip_end_sec")
    preview_start_time = models.IntegerField(blank=True, null=True, db_column="preview_start_time")
    preview_end_time = models.IntegerField(blank=True, null=True, db_column="preview_end_time")
    language = models.CharField(max_length=255, blank=True, null=True)
    genre = models.CharField(max_length=255, blank=True, null=True)
    album = models.CharField(max_length=255, blank=True, null=True)
    lrclib_id = models.CharField(max_length=255, blank=True, null=True, db_column="lrclib_id")
    song_id = models.CharField(max_length=255, db_column="song_id")
    transcoding_id = models.CharField(max_length=255, blank=True, null=True, db_column="transcoding_id")
    transcoding_attempt = models.IntegerField(default=0, db_column="transcoding_attempt")
    transcoded = models.BooleanField(default=False)
    saved_in_search = models.BooleanField(default=False, db_column="saved_in_search")
    saved_in_recommendation = models.BooleanField(default=False, db_column="saved_in_recommendation")
    is_video_reprocess = models.BooleanField(default=False, db_column="is_video_reprocess")
    is_audio_reprocess = models.BooleanField(default=False, db_column="is_audio_reprocess")
    status = models.CharField(max_length=255, default="QUEUED")
    current_stage = models.CharField(max_length=255, default="QUEUED", db_column="current_stage")
    transcoding_started_at = models.DateTimeField(blank=True, null=True, db_column="transcoding_started_at")
    transcoded_at = models.DateTimeField(blank=True, null=True, db_column="transcoded_at")
    recommendation_saved_at = models.DateTimeField(blank=True, null=True, db_column="recommendation_saved_at")
    search_saved_at = models.DateTimeField(blank=True, null=True, db_column="search_saved_at")
    completed_at = models.DateTimeField(blank=True, null=True, db_column="completed_at")
    failed_at = models.DateTimeField(blank=True, null=True, db_column="failed_at")
    failure_reason = models.TextField(blank=True, null=True, db_column="failure_reason")
    transcoding_duration_ms = models.BigIntegerField(blank=True, null=True, db_column="transcoding_duration_ms")
    recommendation_duration_ms = models.BigIntegerField(blank=True, null=True, db_column="recommendation_duration_ms")
    search_duration_ms = models.BigIntegerField(blank=True, null=True, db_column="search_duration_ms")
    finalize_duration_ms = models.BigIntegerField(blank=True, null=True, db_column="finalize_duration_ms")
    total_duration_ms = models.BigIntegerField(blank=True, null=True, db_column="total_duration_ms")
    created_at = models.DateTimeField(auto_now_add=True, db_column="created_at")

    class Meta:
        managed = False
        db_table = "jobs"

    def __str__(self):
        return f"Job {self.id} - {self.title} ({self.status})"


class DeleteJob(models.Model):
    id = models.CharField(primary_key=True, max_length=255, default=generate_uuid)
    entity_type = models.CharField(max_length=255, db_column="entity_type")
    entity_id = models.CharField(max_length=255, db_column="entity_id")
    entity_title = models.CharField(max_length=255, blank=True, null=True, db_column="entity_title")
    song_key = models.CharField(max_length=255, blank=True, null=True, db_column="song_key")
    image_key = models.CharField(max_length=255, blank=True, null=True, db_column="image_key")
    cover_image_key = models.CharField(max_length=255, blank=True, null=True, db_column="cover_image_key")
    video_key = models.CharField(max_length=255, blank=True, null=True, db_column="video_key")
    full_video_key = models.CharField(max_length=255, blank=True, null=True, db_column="full_video_key")
    status = models.CharField(max_length=255, default="PENDING")
    current_stage = models.CharField(max_length=255, default="QUEUED", db_column="current_stage")
    attempt_count = models.IntegerField(default=0, db_column="attempt_count")
    max_attempts = models.IntegerField(default=3, db_column="max_attempts")
    failure_reason = models.TextField(blank=True, null=True, db_column="failure_reason")
    started_at = models.DateTimeField(blank=True, null=True, db_column="started_at")
    search_deleted_at = models.DateTimeField(blank=True, null=True, db_column="search_deleted_at")
    recommendation_deleted_at = models.DateTimeField(blank=True, null=True, db_column="recommendation_deleted_at")
    imagekit_deleted_at = models.DateTimeField(blank=True, null=True, db_column="imagekit_deleted_at")
    s3_deleted_at = models.DateTimeField(blank=True, null=True, db_column="s3_deleted_at")
    cloudinary_deleted_at = models.DateTimeField(blank=True, null=True, db_column="cloudinary_deleted_at")
    completed_at = models.DateTimeField(blank=True, null=True, db_column="completed_at")
    failed_at = models.DateTimeField(blank=True, null=True, db_column="failed_at")
    search_duration_ms = models.BigIntegerField(blank=True, null=True, db_column="search_duration_ms")
    recommendation_duration_ms = models.BigIntegerField(blank=True, null=True, db_column="recommendation_duration_ms")
    imagekit_duration_ms = models.BigIntegerField(blank=True, null=True, db_column="imagekit_duration_ms")
    s3_duration_ms = models.BigIntegerField(blank=True, null=True, db_column="s3_duration_ms")
    cloudinary_duration_ms = models.BigIntegerField(blank=True, null=True, db_column="cloudinary_duration_ms")
    finalize_duration_ms = models.BigIntegerField(blank=True, null=True, db_column="finalize_duration_ms")
    total_duration_ms = models.BigIntegerField(blank=True, null=True, db_column="total_duration_ms")
    created_at = models.DateTimeField(auto_now_add=True, db_column="created_at")
    updated_at = models.DateTimeField(auto_now=True, db_column="updated_at")

    class Meta:
        managed = False
        db_table = "delete_jobs"

    def __str__(self):
        return f"DeleteJob {self.id} - {self.entity_type} {self.entity_id} ({self.status})"
