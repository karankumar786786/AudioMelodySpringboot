from django.db import models
from core.models import generate_uuid


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

    @property
    def total_streams(self) -> int:
        try:
            return self.metadata.total_streams if hasattr(self, "metadata") and self.metadata else 0
        except Exception:
            return 0

    def __str__(self):
        return f"{self.title} - {self.artist_name}"


class SongMetadata(models.Model):
    id = models.CharField(primary_key=True, max_length=255, default=generate_uuid)
    song = models.OneToOneField(Song, on_delete=models.CASCADE, db_column="song_id", related_name="metadata")
    total_streams = models.BigIntegerField(default=0, db_column="total_streams")
    updated_at = models.DateTimeField(auto_now=True, db_column="updated_at")

    class Meta:
        managed = False
        db_table = "song_metadata"

    def __str__(self):
        return f"SongMetadata {self.id} (Song: {self.song_id}, Streams: {self.total_streams})"


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
    playlist = models.ForeignKey(Playlist, on_delete=models.CASCADE, db_column="playlist_id", primary_key=True)
    song = models.ForeignKey(Song, on_delete=models.CASCADE, db_column="song_id")

    class Meta:
        managed = False
        db_table = "playlist_songs"
        unique_together = (("playlist", "song"),)
