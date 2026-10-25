/**
 * Formatting utility helpers for streams, durations, and song metadata.
 */

export function formatStreams(streams?: number | null): string {
  if (streams === undefined || streams === null || streams <= 0) {
    return "0 plays";
  }
  if (streams >= 1_000_000) {
    return `${(streams / 1_000_000).toFixed(1)}M plays`;
  }
  if (streams >= 1_000) {
    return `${(streams / 1_000).toFixed(1)}k plays`;
  }
  return `${streams} plays`;
}

export function formatDuration(sec?: number | null): string {
  if (!sec || sec <= 0) return "--:--";
  const mins = Math.floor(sec / 60);
  const secs = Math.floor(sec % 60);
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
}

export function formatSongSubtitle(
  artistName?: string | null,
  album?: string | null,
  genre?: string | null
): string {
  const parts = [artistName, album, genre].filter(Boolean) as string[];
  return parts.length > 0 ? parts.join(" • ") : "Unknown Artist";
}
