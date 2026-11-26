"""Purane imports ke liye "facade" (sirf aage bhejta hai).
Models ab apne apne apps me hain:
- accounts.models (Admin, User, Session)
- catalog.models (Artist, ArtistMetadata, ArtistFollowEvent, Song, SongMetadata, Playlist, PlaylistSong)
- jobs.models (Job, DeleteJob)
- core.models (PaginationMetadata, generate_uuid)
"""
from accounts.models import Admin, Session, User
from catalog.models import (
    Artist,
    ArtistFollowEvent,
    ArtistMetadata,
    Playlist,
    PlaylistSong,
    Song,
    SongMetadata,
)
from core.models import PaginationMetadata, generate_uuid
from jobs.models import DeleteJob, Job

__all__ = [
    "generate_uuid",
    "Admin",
    "User",
    "Session",
    "Artist",
    "ArtistMetadata",
    "ArtistFollowEvent",
    "Song",
    "SongMetadata",
    "Playlist",
    "PlaylistSong",
    "Job",
    "DeleteJob",
    "PaginationMetadata",
]
