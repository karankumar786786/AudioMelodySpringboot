import { Song } from "@/types";

/**
 * Data source hint for normalizeSong.
 * - 'api':      Backend REST API — returns Song directly, fields are already camelCase.
 * - 'algolia':  Algolia search hit — uses `objectID`, may use `coverImageKey` or `artist`.
 * - 'recombee': Recombee recommendation — values are nested under `hit.values`.
 */
export type SongSource = "api" | "algolia" | "recombee";

/**
 * Single source-of-truth Song normalizer.
 *
 * Handles field name differences across all 3 data sources (Backend API,
 * Algolia index hits, Recombee recommendation items) and always returns a
 * consistent `Song` object.
 *
 * Usage:
 *   normalizeSong(backendSong, 'api')
 *   normalizeSong(algoliaHit, 'algolia')
 *   normalizeSong(recombeeRecomm, 'recombee')
 */
export function normalizeSong(raw: any, source: SongSource = "api"): Song {
  if (!raw) {
    return {
      id: "",
      title: "",
      artistName: "",
    };
  }

  // Recombee nests item properties under `hit.values`
  const data = source === "recombee" ? (raw.values || raw) : raw;

  // --- ID resolution ---
  // Algolia uses `objectID`, Recombee uses `hit.id`, API uses `id`
  const id =
    source === "algolia"
      ? String(raw.objectID || raw.id || "")
      : source === "recombee"
        ? String(raw.id || data.id || "")
        : String(data.id || "");

  // --- Key fields (handle both camelCase and snake_case from different sources) ---
  const songKey = data.songKey || data.audioKey || data.song_key || "";
  const audioKey = data.audioKey || data.songKey || data.audio_key || "";
  const imageKey = data.imageKey || data.coverImageKey || data.image_key || "";
  const videoKey = data.videoKey || data.canvasKey || data.video_key || null;
  const canvasKey = data.canvasKey || data.videoKey || data.canvas_key || null;
  const fullVideoKey = data.fullVideoKey || data.full_video_key || null;

  // --- Clip / Canvas timing ---
  const clipStartSec =
    typeof data.clipStartSec === "number"
      ? data.clipStartSec
      : typeof data.canvasStartTime === "number"
        ? data.canvasStartTime
        : undefined;
  const clipEndSec =
    typeof data.clipEndSec === "number"
      ? data.clipEndSec
      : typeof data.canvasEndTime === "number"
        ? data.canvasEndTime
        : undefined;

  return {
    id,
    title: data.title || "",
    artistName: data.artistName || data.artist || "",
    duration: typeof data.duration === "number" ? data.duration : 0,
    songKey,
    audioKey,
    imageKey,
    videoKey,
    canvasKey,
    fullVideoKey,
    previewStartTime:
      typeof data.previewStartTime === "number"
        ? data.previewStartTime
        : undefined,
    previewEndTime:
      typeof data.previewEndTime === "number"
        ? data.previewEndTime
        : undefined,
    clipStartSec,
    clipEndSec,
    canvasStartTime: clipStartSec,
    canvasEndTime: clipEndSec,
    album: data.album || undefined,
    genre: data.genre || undefined,
    language: data.language || "",
    lrclibId: data.lrclibId || data.lrclib_id || "",
    isFeatured: Boolean(data.isFeatured),
    status: data.status || "ACTIVE",
    jobId: data.jobId || undefined,
    createdAt: data.createdAt || undefined,
    totalStreams:
      typeof data.totalStreams === "number"
        ? data.totalStreams
        : typeof data.listenCount === "number"
          ? data.listenCount
          : 0,
  };
}
