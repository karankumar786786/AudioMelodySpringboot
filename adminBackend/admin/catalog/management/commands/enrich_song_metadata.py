import re
import time
import json
import logging
import urllib.request
import urllib.parse
from difflib import SequenceMatcher
from typing import Dict, Any, Optional, List, Tuple

from django.core.management.base import BaseCommand
from django.db import transaction

# pyrefly: ignore[missing-import]
from catalog.models import Song
from core.services import CatalogSyncService

logger = logging.getLogger(__name__)


def clean_album_name(album: str) -> str:
    if not album:
        return ""
    cleaned = album
    # Remove common soundtrack identifiers
    cleaned = re.sub(r"\s*[\(\[]Original Motion Picture Soundtrack[\)\]]", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*[\(\[]Soundtrack[\)\]]", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*[\(\[]Original Soundtrack[\)\]]", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*-\s*Single", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*[\(\[]From \"[^\"]+\"[\)\]]", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*[\(\[]From \'[^\']+\'[\)\]]", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*[\(\[]From [^\)\]]+[\)\]]", "", cleaned, flags=re.IGNORECASE)
    return cleaned.strip()


def clean_title_for_query(title: str) -> str:
    cleaned = re.sub(r"\s*[\(\[].*?[\)\]]", "", title)
    return cleaned.strip() or title.strip()


def normalize_genre(raw_genre: str, title: str = "", existing_genre: str = "") -> str:
    if not raw_genre:
        raw_genre = "Bollywood"

    rg = raw_genre.strip().title()
    if rg.lower() in ("indian", "hindi", "filmi", "bollywood"):
        rg = "Bollywood"
    elif rg.lower() in ("indian pop", "indipop"):
        rg = "Indian Pop"

    # Check if romantic indicators exist in title or existing genre
    romantic_keywords = ["pyar", "ishq", "dil", "mohabbat", "mehbooba", "sanware", "deewana", "tum", "hum", "romantic"]
    is_romantic = any(k in title.lower() for k in romantic_keywords) or (existing_genre and "romantic" in existing_genre.lower())

    if is_romantic and rg == "Bollywood":
        return "Bollywood, Romantic"
    elif is_romantic and rg == "Indian Pop":
        return "Indian Pop, Romantic"

    return rg


class Command(BaseCommand):
    help = "Enrich song catalog from the web (iTunes India / Deezer / MusicBrainz) for accurate Album, Genre, and Country"

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Simulate resolution and print proposed updates without writing to database",
        )
        parser.add_argument(
            "--missing-only",
            action="store_true",
            help="Only enrich songs with missing/empty album or genre (default updates all)",
        )
        parser.add_argument(
            "--min-score",
            type=float,
            default=0.65,
            help="Minimum confidence score threshold (0.0 to 1.0, default 0.65)",
        )
        parser.add_argument(
            "--default-country",
            type=str,
            default="India",
            help="Default country for songs (default: India)",
        )
        parser.add_argument(
            "--sync-search",
            action="store_true",
            help="Trigger Algolia and Recombee reindexing upon completion",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=None,
            help="Limit the number of songs processed",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        missing_only = options["missing_only"]
        min_score = options["min_score"]
        default_country = options["default_country"]
        sync_search = options["sync_search"]
        limit = options["limit"]

        self.stdout.write(self.style.MIGRATE_HEADING("=== Song Metadata Web Enrichment Engine ==="))
        self.stdout.write(f"Mode: {'DRY RUN' if dry_run else 'LIVE DATABASE UPDATE'}")
        self.stdout.write(f"Target: {'Missing Album/Genre Only' if missing_only else 'All Songs in Catalog'}")
        self.stdout.write(f"Min Match Score: {min_score} | Default Country: {default_country}")

        qs = Song.objects.all().order_by("created_at")
        if missing_only:
            from django.db.models import Q
            qs = qs.filter(
                Q(album__isnull=True) | Q(album="") | Q(genre__isnull=True) | Q(genre="")
            )

        if limit:
            qs = qs[:limit]

        songs = list(qs)
        total_songs = len(songs)
        self.stdout.write(f"Total songs to process: {total_songs}\n")

        updated_count = 0
        skipped_count = 0
        not_found_count = 0

        updates_batch: List[Tuple[Song, str, str, str]] = []

        for idx, song in enumerate(songs, 1):
            title = song.title.strip()
            artist = (song.artist_name or "").strip()
            old_album = song.album or ""
            old_genre = song.genre or ""
            old_country = getattr(song, "country", "") or ""

            match_res = self.resolve_metadata_from_web(title, artist, min_score=min_score)

            if match_res:
                new_album = match_res["album"]
                new_genre = normalize_genre(match_res["genre"], title, old_genre)
                new_country = default_country

                # Check if change is needed
                has_change = (
                    new_album != old_album
                    or new_genre != old_genre
                    or new_country != old_country
                )

                if has_change:
                    updated_count += 1
                    updates_batch.append((song, new_album, new_genre, new_country))
                    self.stdout.write(
                        self.style.SUCCESS(
                            f"[{idx}/{total_songs}] ✓ \"{title}\" ({artist})\n"
                            f"      Album: \"{old_album}\" -> \"{new_album}\"\n"
                            f"      Genre: \"{old_genre}\" -> \"{new_genre}\"\n"
                            f"      Country: \"{old_country}\" -> \"{new_country}\"\n"
                            f"      Score: {match_res['score']} (Source: {match_res['source']})"
                        )
                    )
                else:
                    skipped_count += 1
                    self.stdout.write(
                        f"[{idx}/{total_songs}] = \"{title}\" already matches web ({new_album} | {new_genre})"
                    )
            else:
                not_found_count += 1
                # If not found on web, ensure country is set to default
                if not old_country or old_country != default_country:
                    updates_batch.append((song, old_album or "One Melody Edition", old_genre or "Bollywood", default_country))
                    updated_count += 1
                    self.stdout.write(
                        self.style.WARNING(
                            f"[{idx}/{total_songs}] ⚠️ \"{title}\" ({artist}) - Not on web; assigned defaults\n"
                            f"      Country: \"{default_country}\""
                        )
                    )
                else:
                    self.stdout.write(
                        self.style.NOTICE(f"[{idx}/{total_songs}] ✗ \"{title}\" ({artist}) - No web match (retaining existing)")
                    )

            # Politeness delay to prevent rate limiting
            time.sleep(0.08)

        self.stdout.write("\n" + self.style.MIGRATE_HEADING("=== Execution Summary ==="))
        self.stdout.write(f"Total Evaluated: {total_songs}")
        self.stdout.write(f"Updated / Proposed: {updated_count}")
        self.stdout.write(f"Skipped (Unchanged): {skipped_count}")
        self.stdout.write(f"Not Found on Web: {not_found_count}")

        if not dry_run and updates_batch:
            self.stdout.write(self.style.MIGRATE_LABEL("\nPersisting updates to PostgreSQL database..."))
            with transaction.atomic():
                for song_obj, alb, gen, ctry in updates_batch:
                    song_obj.album = alb
                    song_obj.genre = gen
                    song_obj.country = ctry
                    song_obj.save(update_fields=["album", "genre", "country"])

            self.stdout.write(self.style.SUCCESS(f"Successfully updated {len(updates_batch)} songs in database!"))

            if sync_search:
                self.stdout.write(self.style.MIGRATE_LABEL("\nTriggering Algolia & Recombee full catalog synchronization..."))
                report = CatalogSyncService.sync_full_catalog(purge_inactive=False)
                self.stdout.write(self.style.SUCCESS(f"Catalog Sync Completed: {report}"))
        elif dry_run:
            self.stdout.write(self.style.NOTICE("\n[DRY RUN] No database rows were modified. Run without --dry-run to commit changes."))

    def resolve_metadata_from_web(self, title: str, artist: str, min_score: float = 0.65) -> Optional[Dict[str, Any]]:
        # 1. Try Apple Music / iTunes India
        itunes_res = self._search_itunes(title, artist, min_score=min_score)
        if itunes_res:
            return itunes_res

        # 2. Try Deezer API
        deezer_res = self._search_deezer(title, artist, min_score=min_score)
        if deezer_res:
            return deezer_res

        return None

    def _search_itunes(self, title: str, artist: str, min_score: float) -> Optional[Dict[str, Any]]:
        clean_title = clean_title_for_query(title)
        primary_artist = artist.split(",")[0].split("&")[0].strip() if artist else ""

        queries = [
            f"{clean_title} {primary_artist}",
            clean_title,
        ]

        for q in queries:
            url = f"https://itunes.apple.com/search?term={urllib.parse.quote(q)}&entity=song&limit=5&country=IN"
            req = urllib.request.Request(url, headers={"User-Agent": "AudioMelody-Enricher/1.0"})
            try:
                with urllib.request.urlopen(req, timeout=4) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                    results = data.get("results", [])
                    if not results:
                        continue

                    best = None
                    best_score = 0.0

                    for r in results:
                        track_name = r.get("trackName", "")
                        artist_name = r.get("artistName", "")

                        # Title similarity
                        title_sim = SequenceMatcher(None, clean_title.lower(), track_name.lower()).ratio()

                        # Artist similarity
                        artist_sim = 0.5
                        if primary_artist:
                            if primary_artist.lower() in artist_name.lower():
                                artist_sim = 1.0
                            else:
                                artist_sim = SequenceMatcher(None, primary_artist.lower(), artist_name.lower()).ratio()

                        score = title_sim * 0.7 + artist_sim * 0.3
                        if score > best_score:
                            best_score = score
                            best = r

                    if best and best_score >= min_score:
                        raw_album = best.get("collectionName", "")
                        cleaned_album = clean_album_name(raw_album)
                        genre = best.get("primaryGenreName", "Bollywood")
                        return {
                            "album": cleaned_album or raw_album,
                            "genre": genre,
                            "score": round(best_score, 2),
                            "source": "iTunes Store (IN)",
                        }
            except Exception as e:
                logger.debug("iTunes search failed for '%s': %s", q, e)
                continue

        return None

    def _search_deezer(self, title: str, artist: str, min_score: float) -> Optional[Dict[str, Any]]:
        clean_title = clean_title_for_query(title)
        primary_artist = artist.split(",")[0].split("&")[0].strip() if artist else ""

        query = f'track:"{clean_title}"'
        if primary_artist:
            query += f' artist:"{primary_artist}"'

        url = f"https://api.deezer.com/search?q={urllib.parse.quote(query)}&limit=5"
        req = urllib.request.Request(url, headers={"User-Agent": "AudioMelody-Enricher/1.0"})
        try:
            with urllib.request.urlopen(req, timeout=4) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                results = data.get("data", [])
                if not results:
                    return None

                best = None
                best_score = 0.0

                for r in results:
                    track_name = r.get("title", "")
                    artist_data = r.get("artist", {})
                    artist_name = artist_data.get("name", "") if isinstance(artist_data, dict) else ""

                    title_sim = SequenceMatcher(None, clean_title.lower(), track_name.lower()).ratio()
                    artist_sim = 0.5
                    if primary_artist and primary_artist.lower() in artist_name.lower():
                        artist_sim = 1.0

                    score = title_sim * 0.7 + artist_sim * 0.3
                    if score > best_score:
                        best_score = score
                        best = r

                if best and best_score >= min_score:
                    album_obj = best.get("album", {})
                    album_title = album_obj.get("title", "") if isinstance(album_obj, dict) else ""
                    return {
                        "album": clean_album_name(album_title) or album_title,
                        "genre": "Bollywood",
                        "score": round(best_score, 2),
                        "source": "Deezer",
                    }
        except Exception as e:
            logger.debug("Deezer search failed for '%s': %s", query, e)

        return None

