import { type Song } from "./api";
import { getImageUrl } from "./image-utils";

const S3_BASE_URL =
  process.env.NEXT_PUBLIC_S3_BASE_URL ||
  "https://audiomelodyspringboot.s3.ap-south-1.amazonaws.com";

export interface PlayerSong extends Song {
  queueId: string; // Unique ID for this specific queue entry
  streamUrl: string;
  coverUrl: string;
  captionUrl?: string;
  posterUrl: string;
}

export function mapToPlayerSong(song: any): PlayerSong {
  const streamBase = `${S3_BASE_URL}/${song.songKey || song.song_key}`;
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
    streamUrl: `${streamBase}/master.m3u8`,
    captionUrl: `${streamBase}/caption.vtt`,
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
  const streamBase = `${S3_BASE_URL}/${song.songKey || song.song_key}`;
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
    streamUrl: `${streamBase}/master.m3u8`,
    captionUrl: `${streamBase}/caption.vtt`,
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
    fullVideoUrl: fullVideoKey ? `${S3_BASE_URL}/${fullVideoKey}/master.m3u8` : undefined,
  };
}

export function mapListToPlayerSongs(songs: Song[]): PlayerSong[] {
  return songs.map(mapToPlayerSong);
}

/** Returns the HLS streaming URL for a song's full video (Shaka-packaged on S3) */
export function getFullVideoHlsUrl(song: any): string | undefined {
  const fullVideoKey = song?.fullVideoKey || song?.full_video_key;
  if (!fullVideoKey) return undefined;
  return `${S3_BASE_URL}/${fullVideoKey}/master.m3u8`;
}

/** Returns the DASH streaming URL for a song's full video */
export function getFullVideoDashUrl(song: any): string | undefined {
  const fullVideoKey = song?.fullVideoKey || song?.full_video_key;
  if (!fullVideoKey) return undefined;
  return `${S3_BASE_URL}/${fullVideoKey}/master.mpd`;
}
