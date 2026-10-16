from django.db import models
# pyrefly: ignore[missing-import]
from core.models import generate_uuid


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
        if not self.email:
            return "USER"
        admin = Admin.objects.filter(email=self.email).first()
        return admin.role if admin else "USER"

    def __str__(self):
        return f"{self.email} ({self.role})"


class Session(models.Model):
    id = models.CharField(primary_key=True, max_length=255, default=generate_uuid)
    user = models.ForeignKey(User, on_delete=models.CASCADE, db_column="user_id", related_name="sessions")
    device_id = models.CharField(max_length=255, db_column="device_id")
    refresh_token = models.CharField(max_length=1000, db_column="refresh_token")
    expires_at = models.DateTimeField(db_column="expires_at")
    created_at = models.DateTimeField(auto_now_add=True, db_column="created_at")
    updated_at = models.DateTimeField(auto_now=True, db_column="updated_at")

    class Meta:
        managed = False
        db_table = "sessions"

    def __str__(self):
        return f"Session {self.id} (User: {self.user_id}, Device: {self.device_id})"
