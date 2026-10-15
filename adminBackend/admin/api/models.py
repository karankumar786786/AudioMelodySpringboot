import uuid
from django.db import models


def generate_uuid() -> str:
    return str(uuid.uuid4())


class Admin(models.Model):
    id = models.CharField(primary_key=True, max_length=255, default=generate_uuid)
    email = models.CharField(unique=True, max_length=255)
    name = models.CharField(max_length=255, blank=True, null=True, db_column="name")
    role = models.CharField(max_length=255, default="ADMIN")
    status = models.CharField(max_length=255, default="ACTIVE")
    created_at = models.DateTimeField(auto_now_add=True, db_column="created_at")
    updated_at = models.DateTimeField(auto_now=True, db_column="updated_at")

    class Meta:
        managed = True
        db_table = "admin_users"

    @property
    def user_name(self):
        return self.name

    @user_name.setter
    def user_name(self, value):
        self.name = value

    def __str__(self):
        return f"{self.email} ({self.role})"


class User(models.Model):
    id = models.CharField(primary_key=True, max_length=255, default=generate_uuid)
    user_name = models.CharField(max_length=255, blank=True, null=True, db_column="user_name")
    email = models.CharField(unique=True, max_length=255)
    status = models.CharField(max_length=255, default="ACTIVE")
    created_at = models.DateTimeField(auto_now_add=True, db_column="created_at")

    class Meta:
        managed = False
        db_table = "users"

    @property
    def role(self):
        admin = Admin.objects.filter(email=self.email).first()
        return admin.role if admin else "USER"

    def __str__(self):
        return f"{self.email} ({self.role})"



class Artist(models.Model):
    id = models.CharField(primary_key=True, max_length=255, default=generate_uuid)
    name = models.CharField(max_length=255)
    about = models.CharField(max_length=255, blank=True, null=True)
    cover_image_key = models.CharField(max_length=255, blank=True, null=True, db_column="cover_image_key")
    dob = models.DateTimeField(blank=True, null=True)
    status = models.CharField(max_length=255, default="ACTIVE")
    created_at = models.DateTimeField(auto_now_add=True, db_column="created_at")

    class Meta:
        managed = False
        db_table = "artists"

    def __str__(self):
        return self.name


class ArtistMetadata(models.Model):
    artist_id = models.CharField(primary_key=True, max_length=255, db_column="artist_id")
    artist_name = models.CharField(max_length=255, db_column="artist_name")
    followers_count = models.BigIntegerField(default=0, db_column="followers_count")
    created_at = models.DateTimeField(auto_now_add=True, db_column="created_at")
    updated_at = models.DateTimeField(auto_now=True, db_column="updated_at")

    class Meta:
        managed = False
        db_table = "artist_metadata"

    def __str__(self):
        return f"{self.artist_name} ({self.followers_count} followers)"


class ArtistFollowEvent(models.Model):
    id = models.CharField(primary_key=True, max_length=255, default=generate_uuid)
    user_id = models.CharField(max_length=255, db_column="user_id")
    artist_id = models.CharField(max_length=255, db_column="artist_id")
    event_type = models.CharField(max_length=50, db_column="event_type")
    created_at = models.DateTimeField(auto_now_add=True, db_column="created_at")

    class Meta:
        managed = False
        db_table = "artist_follow_events"

    def __str__(self):
        return f"{self.user_id} -> {self.artist_id} ({self.event_type})"


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


class Song(models.Model):
    id = models.CharField(primary_key=True, max_length=255, default=generate_uuid)
    title = models.CharField(max_length=255)
    artist_name = models.CharField(max_length=255, db_column="artist_name")
    duration = models.IntegerField()
    song_key = models.CharField(max_length=255, db_column="song_key")
    image_key = models.CharField(max_length=255, db_column="image_key")
    video_key = models.CharField(max_length=255, blank=True, null=True, db_column="video_key")
    full_video_key = models.CharField(max_length=255, blank=True, null=True, db_column="full_video_key")
    preview_start_time = models.IntegerField(blank=True, null=True, db_column="preview_start_time")
    preview_end_time = models.IntegerField(blank=True, null=True, db_column="preview_end_time")
    is_featured = models.BooleanField(default=False, db_column="is_featured")
    language = models.CharField(max_length=255)
    genre = models.CharField(max_length=255, blank=True, null=True)
    album = models.CharField(max_length=255, blank=True, null=True)
    lrclib_id = models.CharField(max_length=255, db_column="lrclib_id")
    status = models.CharField(max_length=255, default="ACTIVE")
    job_id = models.CharField(max_length=255, db_column="job_id")
    created_at = models.DateTimeField(auto_now_add=True, db_column="created_at")

    class Meta:
        managed = False
        db_table = "songs"

    def __str__(self):
        return f"{self.title} - {self.artist_name}"


class Playlist(models.Model):
    id = models.CharField(primary_key=True, max_length=255, default=generate_uuid)
    name = models.CharField(max_length=255)
    description = models.CharField(max_length=255, blank=True, null=True)
    cover_image_key = models.CharField(max_length=255, db_column="cover_image_key")
    video_key = models.CharField(max_length=255, blank=True, null=True, db_column="video_key")
    total_songs = models.IntegerField(default=0, db_column="total_songs")
    status = models.CharField(max_length=255, default="ACTIVE")
    created_at = models.DateTimeField(auto_now_add=True, db_column="created_at")
    updated_at = models.DateTimeField(auto_now=True, db_column="updated_at")

    class Meta:
        managed = False
        db_table = "playlists"

    def __str__(self):
        return self.name


class PlaylistSong(models.Model):
    playlist = models.ForeignKey(Playlist, on_delete=models.CASCADE, db_column="playlist_id")
    song = models.ForeignKey(Song, on_delete=models.CASCADE, db_column="song_id")

    class Meta:
        managed = False
        db_table = "playlist_songs"
        unique_together = (("playlist", "song"),)


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
    completed_at = models.DateTimeField(blank=True, null=True, db_column="completed_at")
    failed_at = models.DateTimeField(blank=True, null=True, db_column="failed_at")
    search_duration_ms = models.BigIntegerField(blank=True, null=True, db_column="search_duration_ms")
    recommendation_duration_ms = models.BigIntegerField(blank=True, null=True, db_column="recommendation_duration_ms")
    imagekit_duration_ms = models.BigIntegerField(blank=True, null=True, db_column="imagekit_duration_ms")
    s3_duration_ms = models.BigIntegerField(blank=True, null=True, db_column="s3_duration_ms")
    finalize_duration_ms = models.BigIntegerField(blank=True, null=True, db_column="finalize_duration_ms")
    total_duration_ms = models.BigIntegerField(blank=True, null=True, db_column="total_duration_ms")
    created_at = models.DateTimeField(auto_now_add=True, db_column="created_at")
    updated_at = models.DateTimeField(auto_now=True, db_column="updated_at")

    class Meta:
        managed = False
        db_table = "delete_jobs"

    def __str__(self):
        return f"DeleteJob {self.id} - {self.entity_type} {self.entity_id} ({self.status})"


class PaginationMetadata(models.Model):
    id = models.CharField(primary_key=True, max_length=255)
    entity_name = models.CharField(unique=True, max_length=255, db_column="entity_name")
    total_count = models.BigIntegerField(default=0, db_column="total_count")
    active_count = models.BigIntegerField(default=0, db_column="active_count")
    blocked_count = models.BigIntegerField(default=0, db_column="blocked_count")
    deleted_count = models.BigIntegerField(default=0, db_column="deleted_count")

    class Meta:
        managed = False
        db_table = "pagination_metadata"

    def __str__(self):
        return f"{self.entity_name} (Total: {self.total_count})"
