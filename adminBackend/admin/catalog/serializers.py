"""catalog ke serializers: song, artist, playlist aur catalog health ka JSON."""
from rest_framework import serializers
from .models import Artist, Playlist, Song


class SongSerializer(serializers.ModelSerializer):
    """Song row -> JSON (camelCase fields, admin dashboard ke liye)."""
    artistName = serializers.CharField(source="artist_name")
    songKey = serializers.CharField(source="song_key")
    imageKey = serializers.CharField(source="image_key")
    videoKey = serializers.CharField(source="video_key", required=False, allow_null=True)
    fullVideoKey = serializers.CharField(source="full_video_key", required=False, allow_null=True)
    previewStartTime = serializers.IntegerField(source="preview_start_time", required=False, allow_null=True)
    previewEndTime = serializers.IntegerField(source="preview_end_time", required=False, allow_null=True)
    isFeatured = serializers.BooleanField(source="is_featured")
    lrclibId = serializers.CharField(source="lrclib_id")
    jobId = serializers.CharField(source="job_id")
    totalStreams = serializers.SerializerMethodField()
    createdAt = serializers.DateTimeField(source="created_at", format="%Y-%m-%dT%H:%M:%S")

    class Meta:
        model = Song
        fields = [
            "id",
            "title",
            "artistName",
            "duration",
            "songKey",
            "imageKey",
            "videoKey",
            "fullVideoKey",
            "previewStartTime",
            "previewEndTime",
            "isFeatured",
            "language",
            "genre",
            "album",
            "country",
            "lrclibId",
            "status",
            "totalStreams",
            "jobId",
            "createdAt",
        ]

    def get_totalStreams(self, obj) -> int:
        """song_metadata se total_streams; na ho ya error aaye to 0."""
        try:
            return obj.metadata.total_streams if hasattr(obj, "metadata") and obj.metadata else 0
        except Exception:
            return 0


class ArtistSerializer(serializers.ModelSerializer):
    """Artist row -> JSON."""
    coverImageKey = serializers.CharField(source="cover_image_key", required=False, allow_null=True)
    createdAt = serializers.DateTimeField(source="created_at", format="%Y-%m-%dT%H:%M:%S", required=False)

    class Meta:
        model = Artist
        fields = [
            "id",
            "name",
            "about",
            "coverImageKey",
            "dob",
            "status",
            "createdAt",
        ]


class PlaylistSerializer(serializers.ModelSerializer):
    """Playlist row -> JSON."""
    coverImageKey = serializers.CharField(source="cover_image_key")
    videoKey = serializers.CharField(source="video_key", required=False, allow_null=True)
    totalSongs = serializers.IntegerField(source="total_songs", read_only=True)
    createdAt = serializers.DateTimeField(source="created_at", format="%Y-%m-%dT%H:%M:%S", required=False)
    updatedAt = serializers.DateTimeField(source="updated_at", format="%Y-%m-%dT%H:%M:%S", required=False)

    class Meta:
        model = Playlist
        fields = [
            "id",
            "name",
            "description",
            "coverImageKey",
            "videoKey",
            "totalSongs",
            "status",
            "createdAt",
            "updatedAt",
        ]


class CatalogHealthSongSerializer(serializers.ModelSerializer):
    """Catalog health page ke liye song + uske issues ki list."""
    artistName = serializers.CharField(source="artist_name")
    imageKey = serializers.CharField(source="image_key", allow_null=True)
    lrclibId = serializers.CharField(source="lrclib_id", allow_null=True)
    jobId = serializers.CharField(source="job_id", allow_null=True)
    createdAt = serializers.DateTimeField(source="created_at", format="%Y-%m-%dT%H:%M:%S")
    issues = serializers.SerializerMethodField()

    class Meta:
        model = Song
        fields = [
            "id", "title", "artistName", "album", "genre", "language", "imageKey",
            "lrclibId", "jobId", "status", "createdAt", "issues",
        ]

    def get_issues(self, obj):
        """health.issues_for se song ke issues nikalo."""
        from .health import issues_for
        return issues_for(obj)
