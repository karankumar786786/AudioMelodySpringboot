import time
import logging
from typing import Dict, Any, Optional
from django.core.management.base import BaseCommand
from django.db.models import Q

# pyrefly: ignore[missing-import]
from catalog.models import Song, Artist, Playlist, UserPlaylist
# pyrefly: ignore[missing-import]
from jobs.models import Job
from core.services import AlgoliaService, RecombeeService, CatalogSyncService

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
        parser.add_argument(
            "--purge-inactive",
            action="store_true",
            help="Purge INACTIVE and deleted items from Algolia and Recombee",
        )
        parser.add_argument(
            "--sync-streams",
            action="store_true",
            help="Perform incremental stream count synchronization only",
        )

    def handle(self, *args, **options):
        target = options["target"]
        batch_size = options["batch_size"]
        dry_run = options["dry_run"]
        configure_algolia = options["configure_algolia"]
        purge_inactive = options["purge_inactive"]
        sync_streams = options["sync_streams"]

        self.stdout.write(self.style.MIGRATE_HEADING("=================================================="))
        self.stdout.write(self.style.MIGRATE_HEADING("  Catalog to Algolia & Recombee Synchronization   "))
        self.stdout.write(self.style.MIGRATE_HEADING("=================================================="))
        self.stdout.write(f"Target: {target} | Batch Size: {batch_size} | Dry Run: {dry_run}\n")

        start_time = time.time()

        # Incremental streams shortcut
        if sync_streams:
            self.stdout.write(self.style.NOTICE("Running incremental stream count sync..."))
            if dry_run:
                self.stdout.write("   [Dry Run] Would synchronize stream counts to Algolia and Recombee")
            else:
                report = CatalogSyncService.sync_stream_counts()
                self.stdout.write(self.style.SUCCESS(f"     ✓ Updated streams for {report.get('songsUpdated', 0)} songs"))
            elapsed = time.time() - start_time
            self.stdout.write(self.style.SUCCESS(f"✨ Stream sync finished in {elapsed:.2f} seconds."))
            return

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

        public_user_playlists = list(UserPlaylist.objects.filter(privacy="PUBLIC").select_related("user"))
        self.stdout.write(f"   - Public User Playlists: {len(public_user_playlists)}")

        # 2. Fetch Jobs to get audio features & canvas clip timestamps
        jobs_map = CatalogSyncService.build_jobs_map(songs)
        self.stdout.write(f"   - Transcoding & Audio Feature Jobs mapped: {len(jobs_map)}\n")

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
                self.stdout.write(f"   [Dry Run] Would index {len(playlists)} curated playlists into Algolia")
                self.stdout.write(f"   [Dry Run] Would index {len(public_user_playlists)} public user playlists into Algolia")
            else:
                self.stdout.write(f"   - Indexing {len(songs)} songs into Algolia...")
                songs_synced = AlgoliaService.reindex_all_active_songs(songs, batch_size=batch_size, jobs_by_song_id=jobs_map)
                self.stdout.write(self.style.SUCCESS(f"     ✓ Indexed {songs_synced} songs"))

                self.stdout.write(f"   - Indexing {len(artists)} artists into Algolia...")
                artists_synced = AlgoliaService.reindex_all_artists(artists, batch_size=batch_size)
                self.stdout.write(self.style.SUCCESS(f"     ✓ Indexed {artists_synced} artists"))

                self.stdout.write(f"   - Indexing {len(playlists)} curated playlists into Algolia...")
                playlists_synced = AlgoliaService.reindex_all_playlists(playlists, batch_size=batch_size)
                self.stdout.write(self.style.SUCCESS(f"     ✓ Indexed {playlists_synced} curated playlists"))

                self.stdout.write(f"   - Indexing {len(public_user_playlists)} public user playlists into Algolia...")
                user_playlists_synced = AlgoliaService.reindex_all_user_playlists(public_user_playlists, batch_size=batch_size)
                self.stdout.write(self.style.SUCCESS(f"     ✓ Indexed {user_playlists_synced} public user playlists"))
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

        # 5. Purge Inactive Items
        if purge_inactive:
            self.stdout.write(self.style.NOTICE("4. Purging Inactive / Deleted Items from Engines..."))
            if dry_run:
                self.stdout.write("   [Dry Run] Would purge INACTIVE songs, artists, playlists, and non-public user playlists")
            else:
                inactive_songs = list(Song.objects.filter(status="INACTIVE").values_list("id", flat=True))
                for s_id in inactive_songs:
                    try:
                        AlgoliaService.delete_object(s_id)
                        RecombeeService.delete_song(s_id)
                    except Exception:
                        pass
                self.stdout.write(self.style.SUCCESS(f"     ✓ Purged {len(inactive_songs)} inactive songs"))

                inactive_artists = list(Artist.objects.filter(status="INACTIVE").values_list("id", flat=True))
                for a_id in inactive_artists:
                    try:
                        AlgoliaService.delete_object(a_id)
                    except Exception:
                        pass
                self.stdout.write(self.style.SUCCESS(f"     ✓ Purged {len(inactive_artists)} inactive artists"))

                inactive_playlists = list(Playlist.objects.filter(status="INACTIVE").values_list("id", flat=True))
                for p_id in inactive_playlists:
                    try:
                        AlgoliaService.delete_object(p_id)
                    except Exception:
                        pass
                self.stdout.write(self.style.SUCCESS(f"     ✓ Purged {len(inactive_playlists)} inactive playlists"))

                private_user_playlists = list(UserPlaylist.objects.exclude(privacy="PUBLIC").values_list("id", flat=True))
                for up_id in private_user_playlists:
                    try:
                        AlgoliaService.delete_object(up_id)
                    except Exception:
                        pass
                self.stdout.write(self.style.SUCCESS(f"     ✓ Purged {len(private_user_playlists)} non-public user playlists"))
            self.stdout.write("")

        elapsed = time.time() - start_time
        self.stdout.write(self.style.SUCCESS(f"✨ Synchronization finished successfully in {elapsed:.2f} seconds."))
