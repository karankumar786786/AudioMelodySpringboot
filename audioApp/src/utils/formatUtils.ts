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

/**
 * Formats follower counts into a clean, professional string matching audioFrontend.
 * Example:
 *   formatFollowerCount(0) => "0 followers"
 *   formatFollowerCount(1) => "1 follower"
 *   formatFollowerCount(1420, true) => "1.4K followers"
 *   formatFollowerCount(15200) => "15.2K followers"
 *   formatFollowerCount(1200000) => "1.2M followers"
 */
export function formatFollowerCount(
  val?: number | string | null,
  compact: boolean = false,
  includeLabel: boolean = true
): string {
  if (val === undefined || val === null || val === "") {
    return includeLabel ? "0 followers" : "0";
  }
  const num =
    typeof val === "string" ? parseInt(val, 10) : Math.floor(Number(val));
  if (isNaN(num) || !isFinite(num) || num <= 0) {
    return includeLabel ? "0 followers" : "0";
  }

  let formatted: string;
  if (num >= 1_000_000) {
    formatted = `${(num / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  } else if (num >= 10_000 || (compact && num >= 1_000)) {
    formatted = `${(num / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  } else {
    formatted = num.toLocaleString();
  }

  if (!includeLabel) return formatted;
  return num === 1 ? "1 follower" : `${formatted} followers`;
}
