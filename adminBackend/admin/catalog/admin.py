"""Django admin panel me artists, songs aur playlists kaise dikhein."""
from django.contrib import admin
from .models import Artist, Playlist, Song


@admin.register(Artist)
class ArtistAdmin(admin.ModelAdmin):
    """Django admin panel me artists ki list kaise dikhe."""
    list_display = ("name", "status", "dob", "created_at")
    search_fields = ("name",)
    list_filter = ("status",)


@admin.register(Song)
class SongAdmin(admin.ModelAdmin):
    """Django admin panel me songs ki list kaise dikhe."""
    list_display = ("title", "artist_name", "language", "genre", "is_featured", "status", "created_at")
    search_fields = ("title", "artist_name", "album")
    list_filter = ("status", "is_featured", "language", "genre")


@admin.register(Playlist)
class PlaylistAdmin(admin.ModelAdmin):
    """Django admin panel me playlists ki list kaise dikhe."""
    list_display = ("name", "total_songs", "status", "created_at")
    search_fields = ("name",)
    list_filter = ("status",)
