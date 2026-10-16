from django.contrib import admin
from .models import Admin, Session, User


@admin.register(Admin)
class AdminUserAdmin(admin.ModelAdmin):
    list_display = ("email", "name", "role", "status", "created_at", "updated_at")
    search_fields = ("email", "name")
    list_filter = ("role", "status")


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ("email", "user_name", "status", "created_at")
    search_fields = ("email", "user_name")
    list_filter = ("status",)


@admin.register(Session)
class SessionAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "device_id", "expires_at", "created_at")
    search_fields = ("user__email", "device_id")
