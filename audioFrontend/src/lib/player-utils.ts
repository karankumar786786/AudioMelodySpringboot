import { type Song } from "./api/types";
import { getImageUrl } from "./image-utils";

const CLOUD_NAME =
  process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "one-melody";
const CLOUDINARY_VIDEO_BASE = `https://res.cloudinary.com/${CLOUD_NAME}/video/upload`;
const S3_BASE_URL =
  process.env.NEXT_PUBLIC_S3_BASE_URL ||
  "https://audiomelodyspringboot.s3.ap-south-1.amazonaws.com";

export interface QualityTrack {
  index: number;
  bandwidth: number;
  label: string;
}

export interface PlayerSong extends Song {
  queueId: string; // Unique ID for this specific queue entry
  streamUrl: string;
  coverUrl: string;
  captionUrl?: string;
  posterUrl: string;
}

/**
 * Resolves an Adaptive Bitrate Streaming HLS URL for audio or video.
 * Automatically leverages Cloudinary out-of-the-box ABR (sp_auto) with fallback for legacy S3 keys.
 */
export function resolveHlsUrl(key?: string | null): string {
  if (!key) return "";
  if (key.startsWith("http://") || key.startsWith("https://")) {
    return key;
  }
  if (
    key.startsWith("s3/") ||
    key.includes("amazonaws.com") ||
    key.includes("cloudfront.net")
  ) {
    return `${S3_BASE_URL}/${key}/master.m3u8`;
  }
  // Cloudinary out-of-the-box adaptive HLS streaming
  return `${CLOUDINARY_VIDEO_BASE}/sp_auto/${key}.m3u8`;
}

/**
 * Resolves an Adaptive Bitrate Streaming MPEG-DASH URL.
 */
export function resolveDashUrl(key?: string | null): string {
  if (!key) return "";
  if (key.startsWith("http://") || key.startsWith("https://")) {
    return key;
  }
  if (
    key.startsWith("s3/") ||
    key.includes("amazonaws.com") ||
    key.includes("cloudfront.net")
  ) {
    return `${S3_BASE_URL}/${key}/master.mpd`;
  }
  // Cloudinary out-of-the-box adaptive MPEG-DASH streaming
  return `${CLOUDINARY_VIDEO_BASE}/sp_auto/${key}.mpd`;
}

/**
 * Returns dynamic vertical 9:16 muted canvas looping video.
 * Uses Cloudinary URL transformations to crop, mute, and trim on-the-fly without offline FFmpeg.
 */
export function getCanvasVideoUrl(song: any): string | undefined {
  const fullVideoKey = song?.fullVideoKey || song?.full_video_key;
  const videoKey = song?.videoKey || song?.video_key;
  const key = fullVideoKey || videoKey;
  if (!key) return undefined;

  if (key.startsWith("http://") || key.startsWith("https://")) {
    return key;
  }

  const start = song.previewStartTime ?? 0;
  const end = song.previewEndTime ?? (start + 30);
  return `${CLOUDINARY_VIDEO_BASE}/so_${start},eo_${end},ar_9:16,c_fill,g_auto,vc_h264,ac_none/${key}.mp4`;
}

/**
 * Formats a duration in seconds or milliseconds into standard mm:ss or hh:mm:ss format.
 */
export function formatDuration(val?: number | string | null): string {
  if (val === undefined || val === null || val === "") return "0:00";
  const num = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(num) || !isFinite(num) || num <= 0) return "0:00";

  // If value is > 10,000, it's very likely in milliseconds rather than seconds
  const totalSeconds = num > 10000 ? Math.floor(num / 1000) : Math.floor(num);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function mapToPlayerSong(song: any): PlayerSong {
  const songKey = song.songKey || song.song_key;
  const streamUrl = resolveHlsUrl(songKey);
  const fullVideoKey = song.fullVideoKey || song.full_video_key || undefined;
  const videoKey = song.videoKey || song.video_key || undefined;
  const imageKey = song.imageKey || song.image_key || "";

  return {
    ...song,
    fullVideoKey,
    videoKey,
    imageKey,
    queueId:
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : Math.random().toString(36).substring(7),
    streamUrl,
    captionUrl: songKey ? `${S3_BASE_URL}/${songKey}/caption.vtt` : undefined,
    coverUrl:
      getImageUrl(imageKey, {
        width: 400,
        height: 400,
        focus: "auto",
        aspectRatio: "1-1",
      }) || "",
    posterUrl:
      getImageUrl(imageKey, {
        width: 720,
        height: 720,
        focus: "auto",
        aspectRatio: "1-1",
        quality: 90,
      }) || "",
  };
}

export function normalizePlayerSong(song: any): PlayerSong {
  const songKey = song.songKey || song.song_key;
  const streamUrl = resolveHlsUrl(songKey);
  const fullVideoKey = song.fullVideoKey || song.full_video_key || undefined;
  const videoKey = song.videoKey || song.video_key || undefined;
  const imageKey = song.imageKey || song.image_key || "";

  return {
    ...song,
    fullVideoKey,
    videoKey,
    imageKey,
    queueId:
      song.queueId ||
      (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : Math.random().toString(36).substring(7)),
    streamUrl,
    captionUrl: songKey ? `${S3_BASE_URL}/${songKey}/caption.vtt` : undefined,
    coverUrl:
      getImageUrl(imageKey, {
        width: 400,
        height: 400,
        focus: "auto",
        aspectRatio: "1-1",
      }) || "",
    posterUrl:
      getImageUrl(imageKey, {
        width: 720,
        height: 720,
        focus: "auto",
        aspectRatio: "1-1",
        quality: 90,
      }) || "",
    fullVideoUrl: fullVideoKey ? resolveHlsUrl(fullVideoKey) : undefined,
  };
}

export function mapListToPlayerSongs(songs: Song[]): PlayerSong[] {
  return songs.map(mapToPlayerSong);
}

/** Returns the HLS streaming URL for a song's full video */
export function getFullVideoHlsUrl(song: any): string | undefined {
  const fullVideoKey = song?.fullVideoKey || song?.full_video_key;
  if (!fullVideoKey) return undefined;
  return resolveHlsUrl(fullVideoKey);
}

/** Returns the DASH streaming URL for a song's full video */
export function getFullVideoDashUrl(song: any): string | undefined {
  const fullVideoKey = song?.fullVideoKey || song?.full_video_key;
  if (!fullVideoKey) return undefined;
  return resolveDashUrl(fullVideoKey);
}

/**
 * Formats stream/play counts into a clean, professional string.
 * Example:
 *   formatStreamCount(0) => "0 plays"
 *   formatStreamCount(1) => "1 play"
 *   formatStreamCount(1420) => "1,420 plays"
 *   formatStreamCount(15200) => "15.2K plays"
 *   formatStreamCount(1200000) => "1.2M plays"
 */
export function formatStreamCount(
  val?: number | string | null,
  compact: boolean = false,
  includeLabel: boolean = true
): string {
  if (val === undefined || val === null || val === "") {
    return includeLabel ? "0 plays" : "0";
  }
  const num = typeof val === "string" ? parseInt(val, 10) : Math.floor(Number(val));
  if (isNaN(num) || !isFinite(num) || num <= 0) {
    return includeLabel ? "0 plays" : "0";
  }

  let formatted: string;
  if (num >= 1_000_000) {
    formatted = `${(num / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  } else if (compact || num >= 10_000) {
    formatted = `${(num / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  } else {
    formatted = num.toLocaleString();
  }

  if (!includeLabel) return formatted;
  return num === 1 ? "1 play" : `${formatted} plays`;
}

/**
 * Formats follower counts into a clean, professional string.
 * Example:
 *   formatFollowerCount(0) => "0 followers"
 *   formatFollowerCount(1) => "1 follower"
 *   formatFollowerCount(1420) => "1,420 followers"
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
  const num = typeof val === "string" ? parseInt(val, 10) : Math.floor(Number(val));
  if (isNaN(num) || !isFinite(num) || num <= 0) {
    return includeLabel ? "0 followers" : "0";
  }

  let formatted: string;
  if (num >= 1_000_000) {
    formatted = `${(num / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  } else if (compact || num >= 10_000) {
    formatted = `${(num / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  } else {
    formatted = num.toLocaleString();
  }

  if (!includeLabel) return formatted;
  return num === 1 ? "1 follower" : `${formatted} followers`;
}

