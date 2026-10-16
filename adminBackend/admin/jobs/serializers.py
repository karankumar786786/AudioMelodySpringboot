from rest_framework import serializers
from .models import DeleteJob, Job


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


class DeleteJobSerializer(serializers.ModelSerializer):
    entityType = serializers.CharField(source="entity_type")
    entityId = serializers.CharField(source="entity_id")
    entityTitle = serializers.CharField(source="entity_title", required=False, allow_null=True)
    songKey = serializers.CharField(source="song_key", required=False, allow_null=True)
    imageKey = serializers.CharField(source="image_key", required=False, allow_null=True)
    coverImageKey = serializers.CharField(source="cover_image_key", required=False, allow_null=True)
    videoKey = serializers.CharField(source="video_key", required=False, allow_null=True)
    fullVideoKey = serializers.CharField(source="full_video_key", required=False, allow_null=True)
    currentStage = serializers.CharField(source="current_stage", required=False)
    attemptCount = serializers.IntegerField(source="attempt_count", required=False)
    maxAttempts = serializers.IntegerField(source="max_attempts", required=False)
    failureReason = serializers.CharField(source="failure_reason", required=False, allow_null=True)
    createdAt = serializers.DateTimeField(source="created_at", format="%Y-%m-%dT%H:%M:%S", required=False)
    updatedAt = serializers.DateTimeField(source="updated_at", format="%Y-%m-%dT%H:%M:%S", required=False)

    class Meta:
        model = DeleteJob
        fields = [
            "id",
            "entityType",
            "entityId",
            "entityTitle",
            "songKey",
            "imageKey",
            "coverImageKey",
            "videoKey",
            "fullVideoKey",
            "status",
            "currentStage",
            "attemptCount",
            "maxAttempts",
            "failureReason",
            "createdAt",
            "updatedAt",
        ]
