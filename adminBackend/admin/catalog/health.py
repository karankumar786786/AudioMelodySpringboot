"""Catalog health: wo songs dhoondta hai jinka metadata adhoora hai ya jo baaki systems me nahi pahunche.

Issues
  missingGenre          songs.genre khaali
  missingCover          songs.image_key khaali
  missingLyrics         songs.lrclib_id khaali ya "0" (upload form me "no lyrics" ki value)
  missingAudioFeatures  kisi linked job me tempo/energy/valence/danceability nahi
  notIndexed            kisi linked job ne saved_in_search aur saved_in_recommendation dono record nahi kiye

"Linked job" = jobs ki koi bhi row jisme jobs.song_id = songs.id ya jobs.id = songs.job_id
(wahi join jo CatalogSyncService.build_jobs_map use karta hai).
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
    """Subquery: is song se jude jobs (jobs.song_id = song.id ya jobs.id = song.job_id).
    OuterRef = bahar wali query ka current song.
    """
    return Job.objects.filter(Q(song_id=OuterRef("id")) | Q(id=OuterRef("job_id")))


def annotate_health(qs: QuerySet) -> QuerySet:
    # TODO(audio-features): Flyway V15 (songs.tempo/energy/valence/danceability) aa jaaye to
    # jobs table ke bajaye seedha `songs` ke columns check karo.
    """Har song pe do True/False columns jodo: _has_features (kisi job me saare features hain)
    aur _is_indexed (kisi job ne search + recommendation dono save kiye). Exists = SQL EXISTS, tez hai.
    """
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
    """Comma wali issue keys -> check ki hui list. Anjaani key ho to ValueError."""
    if not raw:
        return []
    keys = [k.strip() for k in raw.split(",") if k.strip()]
    unknown = [k for k in keys if k not in ISSUE_FILTERS]
    if unknown:
        raise ValueError(f"Unknown issue(s): {', '.join(unknown)}. Valid: {', '.join(ISSUES)}")
    return keys


def filter_by_issues(qs: QuerySet, issues: List[str], match: str = "any") -> QuerySet:
    """Diye issues me se koi bhi (default) / saare wale songs; koi issue na diya to kam se kam ek issue wale songs."""
    selected = issues or ISSUES
    combined = Q()
    for key in selected:
        if match == "all" and issues:
            combined &= ISSUE_FILTERS[key]
        else:
            combined |= ISSUE_FILTERS[key]
    return qs.filter(combined)


def summarize(qs: QuerySet) -> Dict[str, int]:
    """Ek hi aggregate query me har issue ki ginti, kitne songs me koi issue hai, aur total songs."""
    any_issue = Q()
    for q in ISSUE_FILTERS.values():
        any_issue |= q
    aggregates = {key: Count("id", filter=q) for key, q in ISSUE_FILTERS.items()}
    aggregates["songsWithIssues"] = Count("id", filter=any_issue)
    aggregates["totalSongs"] = Count("id")
    return qs.aggregate(**aggregates)


def issues_for(song: Song) -> List[str]:
    """Ek song ke issues ki list (Python me check). annotate_health na laga ho to features / index ko theek maan lete hain."""
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
