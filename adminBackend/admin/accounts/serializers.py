from rest_framework import serializers
from .models import Admin, Session, User


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


class UserSessionSerializer(serializers.ModelSerializer):
    deviceId = serializers.CharField(source="device_id")
    deviceName = serializers.CharField(source="device_name", required=False, allow_null=True)
    ipAddress = serializers.CharField(source="ip_address", required=False, allow_null=True)
    location = serializers.CharField(required=False, allow_null=True)
    lastActiveAt = serializers.DateTimeField(source="last_active_at", format="%Y-%m-%dT%H:%M:%S", required=False, allow_null=True)
    expiresAt = serializers.DateTimeField(source="expires_at", format="%Y-%m-%dT%H:%M:%S")
    createdAt = serializers.DateTimeField(source="created_at", format="%Y-%m-%dT%H:%M:%S")
    updatedAt = serializers.DateTimeField(source="updated_at", format="%Y-%m-%dT%H:%M:%S")

    class Meta:
        model = Session
        fields = [
            "id",
            "deviceId",
            "deviceName",
            "ipAddress",
            "location",
            "lastActiveAt",
            "expiresAt",
            "createdAt",
            "updatedAt",
        ]
