from datetime import datetime
from rest_framework import serializers
from .models import (
    Admin,
    Artist,
    DeleteJob,
    Job,
    PaginationMetadata,
    Playlist,
    Song,
    User,
)


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


class SongSerializer(serializers.ModelSerializer):
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
            "lrclibId",
            "status",
            "jobId",
            "createdAt",
        ]


class ArtistSerializer(serializers.ModelSerializer):
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


class UserSerializer(serializers.ModelSerializer):
    userName = serializers.CharField(source="user_name", required=False, allow_null=True)
    role = serializers.CharField(read_only=True)
    createdAt = serializers.DateTimeField(source="created_at", format="%Y-%m-%dT%H:%M:%S", required=False)

    class Meta:
        model = User
        fields = [
            "id",
            "userName",
            "email",
            "role",
            "status",
            "createdAt",
        ]


class AdminSerializer(serializers.ModelSerializer):
    userName = serializers.CharField(source="name", required=False, allow_null=True)
    name = serializers.CharField(required=False, allow_null=True)
    createdAt = serializers.DateTimeField(source="created_at", format="%Y-%m-%dT%H:%M:%S", required=False)
    updatedAt = serializers.DateTimeField(source="updated_at", format="%Y-%m-%dT%H:%M:%S", required=False)

    class Meta:
        model = Admin
        fields = [
            "id",
            "userName",
            "name",
            "email",
            "role",
            "status",
            "createdAt",
            "updatedAt",
        ]



class JobSerializer(serializers.ModelSerializer):
    artistName = serializers.CharField(source="artist_name")
    imageKey = serializers.CharField(source="image_key")
    songKey = serializers.CharField(source="song_key", required=False, allow_null=True)
    videoKey = serializers.CharField(source="video_key", required=False, allow_null=True)
    fullVideoKey = serializers.CharField(source="full_video_key", required=False, allow_null=True)
    clipStartSec = serializers.IntegerField(source="clip_start_sec", required=False, allow_null=True)
    clipEndSec = serializers.IntegerField(source="clip_end_sec", required=False, allow_null=True)
    previewStartTime = serializers.IntegerField(source="preview_start_time", required=False, allow_null=True)
    previewEndTime = serializers.IntegerField(source="preview_end_time", required=False, allow_null=True)
    currentStage = serializers.CharField(source="current_stage", required=False)
    transcodingAttempt = serializers.IntegerField(source="transcoding_attempt", required=False)
    isVideoReprocess = serializers.BooleanField(source="is_video_reprocess", required=False)
    isAudioReprocess = serializers.BooleanField(source="is_audio_reprocess", required=False)
    createdAt = serializers.DateTimeField(source="created_at", format="%Y-%m-%dT%H:%M:%S", required=False)

    class Meta:
        model = Job
        fields = [
            "id",
            "title",
            "artistName",
            "duration",
            "imageKey",
            "songKey",
            "videoKey",
            "fullVideoKey",
            "clipStartSec",
            "clipEndSec",
            "previewStartTime",
            "previewEndTime",
            "language",
            "album",
            "status",
            "currentStage",
            "transcodingAttempt",
            "isVideoReprocess",
            "isAudioReprocess",
            "createdAt",
        ]
