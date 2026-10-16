"""
Backwards compatibility facade for serializers.
Distributed to:
- core.serializers (PaginationMetadataSerializer)
- accounts.serializers (AdminSerializer, UserSerializer, UserSessionSerializer)
- catalog.serializers (SongSerializer, ArtistSerializer, PlaylistSerializer)
- jobs.serializers (JobSerializer, DeleteJobSerializer)
"""
from accounts.serializers import AdminSerializer, UserSerializer, UserSessionSerializer
from catalog.serializers import ArtistSerializer, PlaylistSerializer, SongSerializer
from core.serializers import PaginationMetadataSerializer
from jobs.serializers import DeleteJobSerializer, JobSerializer

__all__ = [
    "PaginationMetadataSerializer",
    "SongSerializer",
    "UserSessionSerializer",
    "ArtistSerializer",
    "PlaylistSerializer",
    "UserSerializer",
    "AdminSerializer",
    "JobSerializer",
    "DeleteJobSerializer",
]
