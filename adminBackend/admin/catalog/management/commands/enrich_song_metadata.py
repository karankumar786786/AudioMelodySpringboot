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
from jobs.models import Job
from core.services import CatalogSyncService

logger = logging.getLogger(__name__)


def clean_album_name(album: str) -> str:
    if not album:
        return ""
    cleaned = album
    # Remove common soundtrack identifiers and suffixes
    cleaned = re.sub(r"\s*[\(\[]Original Motion Picture Soundtrack[\)\]]", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*[\(\[]Soundtrack[\)\]]", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*[\(\[]Original Soundtrack[\)\]]", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*[\(\[]Deluxe Edition[\)\]]", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*[\(\[]Deluxe[\)\]]", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*[\(\[]Special Edition[\)\]]", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*[\(\[]Remastered[\)\]]", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*-\s*EP\b", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*-\s*Single\b", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*[\(\[]From \"[^\"]+\"[\)\]]", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*[\(\[]From \'[^\']+\'[\)\]]", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*[\(\[]From [^\)\]]+[\)\]]", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*[\(\[]From the Movie [^\)\]]+[\)\]]", "", cleaned, flags=re.IGNORECASE)
    return cleaned.strip(" -–—\t\r\n")


def extract_movie_hint(title: str) -> Optional[str]:
    m = re.search(r"[\(\[]From\s*[\"']?([^\"'\]\)]+)[\"']?[\)\]]", title, flags=re.IGNORECASE)
    if m:
        return m.group(1).strip()
    m2 = re.search(r"\|\s*([A-Za-z0-9\s]+)$", title)
    if m2:
        return m2.group(1).strip()
    return None


def clean_title_for_query(title: str) -> str:
    cleaned = title
    # Remove version/rendering suffixes (e.g. - Female, - Male, - Audio, - Video, - Lyrical)
    cleaned = re.sub(r"\s*-\s*(?:Female|Male|Reprise|Duet|Slowed|Lofi|Version|Lyrical|Audio|Video|4K|Remix|Hook|Title Track).*", "", cleaned, flags=re.IGNORECASE)
    # Remove parentheticals and square brackets
    cleaned = re.sub(r"\s*[\(\[].*?[\)\]]", "", cleaned)
    # Remove trailing punctuation or whitespace
    cleaned = cleaned.strip(" -–—\t\r\n")
    return cleaned.strip() or title.strip()


def normalize_genre(raw_genre: str, title: str = "", existing_genre: str = "") -> str:
    if not raw_genre:
        raw_genre = "Bollywood"

    rg = raw_genre.strip()
    lower_rg = rg.lower()

    if lower_rg in ("indian", "hindi", "filmi", "bollywood", "soundtrack"):
        canonical = "Bollywood"
    elif "pop" in lower_rg and ("indian" in lower_rg or "indi" in lower_rg or "desi" in lower_rg):
        canonical = "Indian Pop"
    elif lower_rg == "pop":
        canonical = "Pop"
    elif "rock" in lower_rg:
        canonical = "Rock"
    elif "sufi" in lower_rg:
        canonical = "Sufi, Bollywood"
    elif "ghazal" in lower_rg:
        canonical = "Ghazal"
    elif "classical" in lower_rg:
        canonical = "Indian Classical"
    elif "devotional" in lower_rg or "bhakti" in lower_rg:
        canonical = "Devotional"
    elif "folk" in lower_rg:
        canonical = "Folk"
    elif "dance" in lower_rg or "club" in lower_rg or "electronic" in lower_rg:
        canonical = "Bollywood, Dance"
    else:
        canonical = rg.title()

    # Check if romantic keywords exist in title or existing genre
    romantic_keywords = [
        "pyar", "ishq", "dil", "mohabbat", "mehbooba", "sanware", "deewana", "tum",
        "hum", "romantic", "saathiya", "janam", "samjhawan", "kasam", "tere bina",
        "khuda", "tera", "meri", "aashiqui", "muskurane", "chahun", "hawayein", "raabta"
    ]
    is_romantic = any(k in title.lower() for k in romantic_keywords) or (existing_genre and "romantic" in existing_genre.lower())

    if is_romantic and "Romantic" not in canonical:
        if canonical in ("Bollywood", "Indian Pop", "Pop"):
            canonical = f"{canonical}, Romantic"

    return canonical


class Command(BaseCommand):
    help = "Enrich song catalog from the web (iTunes India / Deezer / MusicBrainz) for accurate Album, Genre, and Country"

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Simulate resolution and print proposed updates without writing to database",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="Force search web and re-enrich all songs even if album and genre exist",
        )
        parser.add_argument(
            "--missing-only",
            action="store_true",
            help="Only enrich songs with missing/empty album or genre",
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
        force = options["force"]
        missing_only = options["missing_only"]
        min_score = options["min_score"]
        default_country = options["default_country"]
        sync_search = options["sync_search"]
        limit = options["limit"]

        self.stdout.write(self.style.MIGRATE_HEADING("=== Song Metadata Web Enrichment Engine ==="))
        self.stdout.write(f"Mode: {'DRY RUN' if dry_run else 'LIVE DATABASE UPDATE'}")
        self.stdout.write(f"Strategy: {'Force Search All Songs on Web' if force else ('Missing Only' if missing_only else 'Full Catalog Audit')}")
        self.stdout.write(f"Min Match Score: {min_score} | Default Country: {default_country}")

        qs = Song.objects.all().order_by("created_at")
        if missing_only and not force:
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

                has_change = (
                    new_album != old_album
                    or new_genre != old_genre
                    or new_country != old_country
                    or force
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
                # If not found on web, ensure country is set to default and clean up existing album/genre
                fallback_album = clean_album_name(old_album) or old_album or "One Melody Edition"
                fallback_genre = normalize_genre(old_genre, title, old_genre) or "Bollywood"
                has_fallback_change = (
                    fallback_album != old_album
                    or fallback_genre != old_genre
                    or old_country != default_country
                )
                if has_fallback_change or force:
                    updates_batch.append((song, fallback_album, fallback_genre, default_country))
                    updated_count += 1
                    self.stdout.write(
                        self.style.WARNING(
                            f"[{idx}/{total_songs}] ⚠️ \"{title}\" ({artist}) - No web match; sanitized existing\n"
                            f"      Album: \"{old_album}\" -> \"{fallback_album}\"\n"
                            f"      Genre: \"{old_genre}\" -> \"{fallback_genre}\"\n"
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
                    Job.objects.filter(song_id=song_obj.id).update(album=alb, genre=gen, country=ctry)

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

        # 3. Try MusicBrainz API
        mb_res = self._search_musicbrainz(title, artist, min_score=min_score)
        if mb_res:
            return mb_res

        return None

    def _search_itunes(self, title: str, artist: str, min_score: float) -> Optional[Dict[str, Any]]:
        clean_title = clean_title_for_query(title)
        movie_hint = extract_movie_hint(title)
        primary_artist = artist.split(",")[0].split("&")[0].strip() if artist else ""

        queries = [
            f"{clean_title} {primary_artist}",
        ]
        if movie_hint:
            queries.append(f"{clean_title} {movie_hint}")
        queries.append(clean_title)

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

    def _search_musicbrainz(self, title: str, artist: str, min_score: float) -> Optional[Dict[str, Any]]:
        clean_title = clean_title_for_query(title)
        primary_artist = artist.split(",")[0].split("&")[0].strip() if artist else ""
        query = f'recording:"{clean_title}"'
        if primary_artist:
            query += f' AND artist:"{primary_artist}"'

        url = f"https://musicbrainz.org/ws/2/recording/?query={urllib.parse.quote(query)}&fmt=json&limit=3"
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "AudioMelodyEnricher/1.0 (onestream6969@gmail.com)"}
        )
        try:
            with urllib.request.urlopen(req, timeout=4) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                recordings = data.get("recordings", [])
                if not recordings:
                    return None

                best = None
                best_score = 0.0

                for rec in recordings:
                    track_title = rec.get("title", "")
                    title_sim = SequenceMatcher(None, clean_title.lower(), track_title.lower()).ratio()
                    artist_sim = 0.5
                    artist_credit = rec.get("artist-credit", [])
                    if artist_credit and isinstance(artist_credit, list):
                        art_name = artist_credit[0].get("name", "") if isinstance(artist_credit[0], dict) else ""
                        if primary_artist and primary_artist.lower() in art_name.lower():
                            artist_sim = 1.0
                        elif primary_artist:
                            artist_sim = SequenceMatcher(None, primary_artist.lower(), art_name.lower()).ratio()

                    score = title_sim * 0.7 + artist_sim * 0.3
                    if score > best_score:
                        best_score = score
                        best = rec

                if best and best_score >= min_score:
                    releases = best.get("releases", [])
                    if releases and isinstance(releases, list):
                        release_title = releases[0].get("title", "")
                        return {
                            "album": clean_album_name(release_title) or release_title,
                            "genre": "Bollywood",
                            "score": round(best_score, 2),
                            "source": "MusicBrainz",
                        }
        except Exception as e:
            logger.debug("MusicBrainz search failed for '%s': %s", query, e)
        return None
