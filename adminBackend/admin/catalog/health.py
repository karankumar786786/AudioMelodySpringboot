"""
Catalog health: finds songs with missing metadata or missing downstream state.

Issues
  missingGenre          songs.genre empty
  missingCover          songs.image_key empty
  missingLyrics         songs.lrclib_id empty or "0" (the upload form's "no lyrics" value)
  missingAudioFeatures  no linked job has tempo/energy/valence/danceability
  notIndexed            no linked job recorded both saved_in_search and saved_in_recommendation

"Linked job" = any jobs row with jobs.song_id = songs.id or jobs.id = songs.job_id
(the same join CatalogSyncService.build_jobs_map uses).
"""
from typing import Dict, List, Optional

from django.db.models import Count, Exists, OuterRef, Q, QuerySet

# pyrefly: ignore[missing-import]
from jobs.models import Job
from .models import Song

ISSUES: List[str] = [
    "missingGenre",
    "missingCover",
    "missingAudioFeatures",
    "missingLyrics",
    "notIndexed",
]

AUDIO_FEATURE_FIELDS = ("tempo", "energy", "valence", "danceability")


def _linked_jobs() -> QuerySet:
    return Job.objects.filter(Q(song_id=OuterRef("id")) | Q(id=OuterRef("job_id")))


def annotate_health(qs: QuerySet) -> QuerySet:
    # TODO(audio-features): once Flyway V15 (songs.tempo/energy/valence/danceability) lands,
    # check those columns on `songs` directly instead of going through the jobs table.
    features = _linked_jobs().filter(**{f"{f}__isnull": False for f in AUDIO_FEATURE_FIELDS})
    indexed = _linked_jobs().filter(saved_in_search=True, saved_in_recommendation=True)
    return qs.annotate(_has_features=Exists(features), _is_indexed=Exists(indexed))


ISSUE_FILTERS: Dict[str, Q] = {
    "missingGenre": Q(genre__isnull=True) | Q(genre=""),
    "missingCover": Q(image_key__isnull=True) | Q(image_key=""),
    "missingLyrics": Q(lrclib_id__isnull=True) | Q(lrclib_id__in=["", "0"]),
    "missingAudioFeatures": Q(_has_features=False),
    "notIndexed": Q(_is_indexed=False),
}


def parse_issues(raw: Optional[str]) -> List[str]:
    """Comma-separated issue keys -> validated list. Raises ValueError for unknown keys."""
    if not raw:
        return []
    keys = [k.strip() for k in raw.split(",") if k.strip()]
    unknown = [k for k in keys if k not in ISSUE_FILTERS]
    if unknown:
        raise ValueError(f"Unknown issue(s): {', '.join(unknown)}. Valid: {', '.join(ISSUES)}")
    return keys


def filter_by_issues(qs: QuerySet, issues: List[str], match: str = "any") -> QuerySet:
    """Songs with any (default) / all of the given issues; with no issues, songs with at least one."""
    selected = issues or ISSUES
    combined = Q()
    for key in selected:
        if match == "all" and issues:
            combined &= ISSUE_FILTERS[key]
        else:
            combined |= ISSUE_FILTERS[key]
    return qs.filter(combined)


def summarize(qs: QuerySet) -> Dict[str, int]:
    any_issue = Q()
    for q in ISSUE_FILTERS.values():
        any_issue |= q
    aggregates = {key: Count("id", filter=q) for key, q in ISSUE_FILTERS.items()}
    aggregates["songsWithIssues"] = Count("id", filter=any_issue)
    aggregates["totalSongs"] = Count("id")
    return qs.aggregate(**aggregates)


def issues_for(song: Song) -> List[str]:
    out = []
    if not (song.genre or "").strip():
        out.append("missingGenre")
    if not (song.image_key or "").strip():
        out.append("missingCover")
    if not getattr(song, "_has_features", True):
        out.append("missingAudioFeatures")
    if (song.lrclib_id or "").strip() in ("", "0"):
        out.append("missingLyrics")
    if not getattr(song, "_is_indexed", True):
        out.append("notIndexed")
    return out
