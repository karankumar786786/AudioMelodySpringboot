import time
import logging
from typing import Dict, Any, Optional
from django.core.management.base import BaseCommand
from django.db.models import Q

# pyrefly: ignore[missing-import]
from catalog.models import Song, Artist, Playlist
# pyrefly: ignore[missing-import]
from jobs.models import Job
from core.services import AlgoliaService, RecombeeService

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Fetch all catalog data from database and synchronize into Algolia and Recombee"

    def add_arguments(self, parser):
        parser.add_argument(
            "--target",
            type=str,
            choices=["all", "algolia", "recombee"],
            default="all",
            help="Target engine(s) to synchronize (default: all)",
        )
        parser.add_argument(
            "--batch-size",
            type=int,
            default=100,
            help="Batch chunk size for indexing (default: 100)",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Simulate the sync and validate mappings without sending to external APIs",
        )
        parser.add_argument(
            "--configure-algolia",
            action="store_true",
            help="Reconfigure Algolia index settings, facets, and custom ranking",
        )

    def handle(self, *args, **options):
        target = options["target"]
        batch_size = options["batch_size"]
        dry_run = options["dry_run"]
        configure_algolia = options["configure_algolia"]

        self.stdout.write(self.style.MIGRATE_HEADING("=================================================="))
        self.stdout.write(self.style.MIGRATE_HEADING("  Catalog to Algolia & Recombee Synchronization   "))
        self.stdout.write(self.style.MIGRATE_HEADING("=================================================="))
        self.stdout.write(f"Target: {target} | Batch Size: {batch_size} | Dry Run: {dry_run}\n")

        start_time = time.time()

        # 1. Fetch data from DB
        self.stdout.write("1. Fetching active records from database...")
        songs = list(Song.objects.filter(status="ACTIVE").select_related("metadata"))
        self.stdout.write(f"   - Active Songs: {len(songs)}")

        artists = list(Artist.objects.filter(status="ACTIVE"))
        try:
            from catalog.models import ArtistMetadata
            meta_map = {m.artist_id: m.followers_count for m in ArtistMetadata.objects.all()}
            for a in artists:
                a.followers_count = meta_map.get(a.id, 0)
        except Exception as e:
            logger.warning("Could not load artist metadata: %s", e)
        self.stdout.write(f"   - Active Artists: {len(artists)}")

        playlists = list(Playlist.objects.filter(status="ACTIVE"))
        self.stdout.write(f"   - Active Playlists: {len(playlists)}")

        # 2. Fetch Jobs to get audio features & canvas clip timestamps
        song_ids = [s.id for s in songs if s.id]
        job_ids = [s.job_id for s in songs if getattr(s, "job_id", None)]
        jobs = list(Job.objects.filter(Q(song_id__in=song_ids) | Q(id__in=job_ids)).order_by("-created_at"))

        # Group jobs by song id / job id
        jobs_grouped: Dict[str, list] = {}
        for j in jobs:
            if j.song_id:
                jobs_grouped.setdefault(j.song_id, []).append(j)
            if j.id:
                jobs_grouped.setdefault(j.id, []).append(j)

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

        jobs_map: Dict[str, Any] = {}
        jobs_with_audio_features = 0
        jobs_with_clips = 0
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
                if merged.danceability is not None:
                    jobs_with_audio_features += 1
                if merged.clip_start_sec is not None:
                    jobs_with_clips += 1

        self.stdout.write(f"   - Matching Jobs found: {len(jobs)} ({jobs_with_clips} with canvas clips, {jobs_with_audio_features} with audio features)\n")

        # 3. Synchronize Algolia
        if target in ["all", "algolia"]:
            self.stdout.write(self.style.NOTICE("2. Synchronizing Algolia Search Index..."))
            if configure_algolia or target == "all":
                if dry_run:
                    self.stdout.write("   [Dry Run] Would configure Algolia index settings and ranking")
                else:
                    self.stdout.write("   - Configuring Algolia index attributes & ranking...")
                    AlgoliaService.configure_index()

            if dry_run:
                self.stdout.write(f"   [Dry Run] Would index {len(songs)} songs into Algolia")
                self.stdout.write(f"   [Dry Run] Would index {len(artists)} artists into Algolia")
                self.stdout.write(f"   [Dry Run] Would index {len(playlists)} playlists into Algolia")
            else:
                self.stdout.write(f"   - Indexing {len(songs)} songs into Algolia...")
                songs_synced = AlgoliaService.reindex_all_active_songs(songs, batch_size=batch_size, jobs_by_song_id=jobs_map)
                self.stdout.write(self.style.SUCCESS(f"     ✓ Indexed {songs_synced} songs"))

                self.stdout.write(f"   - Indexing {len(artists)} artists into Algolia...")
                artists_synced = AlgoliaService.reindex_all_artists(artists, batch_size=batch_size)
                self.stdout.write(self.style.SUCCESS(f"     ✓ Indexed {artists_synced} artists"))

                self.stdout.write(f"   - Indexing {len(playlists)} playlists into Algolia...")
                playlists_synced = AlgoliaService.reindex_all_playlists(playlists, batch_size=batch_size)
                self.stdout.write(self.style.SUCCESS(f"     ✓ Indexed {playlists_synced} playlists"))
            self.stdout.write("")

        # 4. Synchronize Recombee
        if target in ["all", "recombee"]:
            self.stdout.write(self.style.NOTICE("3. Synchronizing Recombee Recommendations Catalog..."))
            if dry_run:
                self.stdout.write(f"   [Dry Run] Would ingest {len(songs)} songs (with audio features) into Recombee")
            else:
                self.stdout.write(f"   - Ingesting {len(songs)} songs with 11 audio features into Recombee...")
                recombee_synced = RecombeeService.reindex_all_active_songs(songs, jobs_by_song_id=jobs_map)
                self.stdout.write(self.style.SUCCESS(f"     ✓ Ingested {recombee_synced} songs into Recombee"))
            self.stdout.write("")

        elapsed = time.time() - start_time
        self.stdout.write(self.style.SUCCESS(f"✨ Synchronization finished successfully in {elapsed:.2f} seconds."))
