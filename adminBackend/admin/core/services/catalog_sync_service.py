import time
import logging
from typing import Dict, Any, Optional, List
from django.db.models import Q
from django.conf import settings

# pyrefly: ignore[missing-import]
from catalog.models import Song, Artist, ArtistMetadata, Playlist, UserPlaylist, SongMetadata
# pyrefly: ignore[missing-import]
from jobs.models import Job
from core.services.algolia_service import AlgoliaService
from core.services.recombee_service import RecombeeService

logger = logging.getLogger(__name__)


class MergedJob:
    id: Optional[str] = None
    song_id: Optional[str] = None
    clip_start_sec: Optional[int] = None
    clip_end_sec: Optional[int] = None
    video_key: Optional[str] = None
    full_video_key: Optional[str] = None
    preview_start_time: Optional[int] = None
    preview_end_time: Optional[int] = None
    song_key: Optional[str] = None
    tempo: Optional[float] = None
    danceability: Optional[float] = None
    energy: Optional[float] = None
    valence: Optional[float] = None
    acousticness: Optional[float] = None
    instrumentalness: Optional[float] = None
    liveness: Optional[float] = None
    speechiness: Optional[float] = None
    loudness: Optional[float] = None
    key: Optional[int] = None
    mode: Optional[int] = None

    def __init__(self, j_list):
        fields = [
            "id", "song_id", "clip_start_sec", "clip_end_sec", "video_key", "full_video_key",
            "preview_start_time", "preview_end_time", "song_key",
            "tempo", "danceability", "energy", "valence", "acousticness",
            "instrumentalness", "liveness", "speechiness", "loudness", "key", "mode"
        ]
        for f in fields:
            val = None
            for j in j_list:
                v = getattr(j, f, None)
                if v is not None:
                    val = v
                    break
            setattr(self, f, val)


class CatalogSyncService:
    """
    Centralized service for synchronizing PostgreSQL catalog data to Algolia and Recombee.
    Handles full catalog reindexing, incremental stream count syncs, and purging inactive items.
    """

    @classmethod
    def build_jobs_map(cls, songs: List[Song]) -> Dict[str, Any]:
        """
        Prefetches transcoding & feature extraction jobs for songs,
        providing audio features (danceability, tempo, etc.) and canvas clip timestamps.
        """
        song_ids = [s.id for s in songs if s.id]
        job_ids = [s.job_id for s in songs if getattr(s, "job_id", None)]
        if not song_ids and not job_ids:
            return {}

        jobs = list(Job.objects.filter(Q(song_id__in=song_ids) | Q(id__in=job_ids)).order_by("-created_at"))

        jobs_grouped: Dict[str, list] = {}
        for j in jobs:
            if j.song_id:
                jobs_grouped.setdefault(j.song_id, []).append(j)
            if j.id:
                jobs_grouped.setdefault(j.id, []).append(j)

        jobs_map: Dict[str, Any] = {}
        for s in songs:
            j_list = []
            if s.id and s.id in jobs_grouped:
                j_list.extend(jobs_grouped[s.id])
            if getattr(s, "job_id", None) and s.job_id in jobs_grouped:
                for j in jobs_grouped[s.job_id]:
                    if j not in j_list:
                        j_list.append(j)
            if j_list:
                merged = MergedJob(j_list)
                if s.id:
                    jobs_map[s.id] = merged
                if getattr(s, "job_id", None):
                    jobs_map[s.job_id] = merged
        return jobs_map

    @classmethod
    def sync_full_catalog(
        cls,
        batch_size: int = 100,
        purge_inactive: bool = True,
        configure_algolia: bool = True,
    ) -> Dict[str, Any]:
        """
        Performs a full catalog synchronization:
        1. Configures Algolia index attributes & rankings
        2. Syncs all ACTIVE songs (with audio features & clips) to Algolia & Recombee
        3. Syncs all ACTIVE artists (with followers count) to Algolia
        4. Syncs all ACTIVE curated playlists to Algolia
        5. Syncs all PUBLIC user playlists to Algolia
        6. Purges INACTIVE items from Algolia & Recombee
        """
        start_time = time.time()
        logger.info("[CatalogSyncService] Starting full catalog synchronization...")

        if configure_algolia:
            AlgoliaService.configure_index()

        # 1. Active songs
        active_songs = list(Song.objects.filter(status="ACTIVE").select_related("metadata"))
        jobs_map = cls.build_jobs_map(active_songs)

        algolia_songs = AlgoliaService.reindex_all_active_songs(
            active_songs, batch_size=batch_size, jobs_by_song_id=jobs_map
        )
        recombee_songs = RecombeeService.reindex_all_active_songs(
            active_songs, jobs_by_song_id=jobs_map
        )

        # 2. Active artists
        active_artists = list(Artist.objects.filter(status="ACTIVE"))
        try:
            meta_map = {m.artist_id: m.followers_count for m in ArtistMetadata.objects.all()}
            for a in active_artists:
                a.followers_count = meta_map.get(a.id, 0)
        except Exception as e:
            logger.warning("[CatalogSyncService] Could not prefetch artist metadata: %s", e)

        algolia_artists = AlgoliaService.reindex_all_artists(active_artists, batch_size=batch_size)

        # 3. Active playlists (curated)
        active_playlists = list(Playlist.objects.filter(status="ACTIVE"))
        algolia_playlists = AlgoliaService.reindex_all_playlists(active_playlists, batch_size=batch_size)

        # 4. Public user playlists
        public_user_playlists = list(
            UserPlaylist.objects.filter(privacy="PUBLIC").select_related("user")
        )
        algolia_user_playlists = AlgoliaService.reindex_all_user_playlists(
            public_user_playlists, batch_size=batch_size
        )

        # 5. Purge inactive items
        purged_counts = {"songs": 0, "artists": 0, "playlists": 0, "user_playlists": 0}
        if purge_inactive:
            # Inactive songs
            inactive_songs = list(Song.objects.filter(status="INACTIVE").values_list("id", flat=True))
            for s_id in inactive_songs:
                try:
                    AlgoliaService.delete_object(s_id)
                    RecombeeService.delete_song(s_id)
                    purged_counts["songs"] += 1
                except Exception:
                    pass

            # Inactive artists
            inactive_artists = list(Artist.objects.filter(status="INACTIVE").values_list("id", flat=True))
            for a_id in inactive_artists:
                try:
                    AlgoliaService.delete_object(a_id)
                    purged_counts["artists"] += 1
                except Exception:
                    pass

            # Inactive playlists
            inactive_playlists = list(Playlist.objects.filter(status="INACTIVE").values_list("id", flat=True))
            for p_id in inactive_playlists:
                try:
                    AlgoliaService.delete_object(p_id)
                    purged_counts["playlists"] += 1
                except Exception:
                    pass

            # Non-public user playlists
            private_user_playlists = list(
                UserPlaylist.objects.exclude(privacy="PUBLIC").values_list("id", flat=True)
            )
            for up_id in private_user_playlists:
                try:
                    AlgoliaService.delete_object(up_id)
                    purged_counts["user_playlists"] += 1
                except Exception:
                    pass

        elapsed = time.time() - start_time
        report = {
            "status": "success",
            "durationSeconds": round(elapsed, 2),
            "algolia": {
                "songs": algolia_songs,
                "artists": algolia_artists,
                "playlists": algolia_playlists,
                "userPlaylists": algolia_user_playlists,
            },
            "recombee": {
                "songs": recombee_songs,
            },
            "purged": purged_counts,
        }
        logger.info("[CatalogSyncService] Full catalog sync finished in %.2fs: %s", elapsed, report)
        return report

    @classmethod
    def sync_stream_counts(cls) -> Dict[str, Any]:
        """
        Incremental sync: updates totalStreams for all active songs in Algolia and Recombee.
        """
        start_time = time.time()
        logger.info("[CatalogSyncService] Starting incremental stream count sync...")

        active_songs = list(Song.objects.filter(status="ACTIVE").select_related("metadata"))
        synced = 0
        for s in active_songs:
            streams = s.total_streams
            if streams is not None:
                try:
                    # Update in Recombee
                    RecombeeService.update_total_streams(s.id, streams)
                    # Update in Algolia (partial update totalStreams)
                    client = AlgoliaService.get_client()
                    if client:
                        index_name = getattr(settings, "ALGOLIA_INDEX_NAME", "one_melody_springboot")
                        client.partial_update_object(
                            index_name=index_name,
                            object_id=s.id,
                            attributes_to_update={"totalStreams":streams},
                            create_if_not_exists=False,
                        )
                    synced += 1
                except Exception as e:
                    logger.debug("Failed stream update for %s: %s", s.id, e)

        elapsed = time.time() - start_time
        return {
            "status": "success",
            "durationSeconds": round(elapsed, 2),
            "songsUpdated": synced,
        }

    @classmethod
    def get_sync_health(cls) -> Dict[str, Any]:
        """
        Returns catalog counts across DB and current engine readiness.
        """
        active_songs = Song.objects.filter(status="ACTIVE").count()
        inactive_songs = Song.objects.filter(status="INACTIVE").count()
        active_artists = Artist.objects.filter(status="ACTIVE").count()
        active_playlists = Playlist.objects.filter(status="ACTIVE").count()
        public_user_playlists = UserPlaylist.objects.filter(privacy="PUBLIC").count()

        algolia_ok = AlgoliaService.get_client() is not None
        recombee_ok = RecombeeService.get_client() is not None

        return {
            "status": "HEALTHY" if (algolia_ok and recombee_ok) else "DEGRADED",
            "engines": {
                "algolia": "CONNECTED" if algolia_ok else "DISCONNECTED",
                "recombee": "CONNECTED" if recombee_ok else "DISCONNECTED",
            },
            "databaseCounts": {
                "activeSongs": active_songs,
                "inactiveSongs": inactive_songs,
                "activeArtists": active_artists,
                "activeCuratedPlaylists": active_playlists,
                "publicUserPlaylists": public_user_playlists,
            },
        }
