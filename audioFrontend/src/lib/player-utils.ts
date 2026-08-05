import { type Song } from "./api";
import { getImageUrl } from "./image-utils";

const S3_BASE_URL =
  process.env.NEXT_PUBLIC_S3_BASE_URL ||
  "https://audioprocessingproduction.s3.ap-south-1.amazonaws.com";

export interface PlayerSong extends Song {
  queueId: string; // Unique ID for this specific queue entry
  streamUrl: string;
  coverUrl: string;
  captionUrl?: string;
  posterUrl: string;
}

export function mapToPlayerSong(song: Song): PlayerSong {
  const streamBase = `${S3_BASE_URL}/${song.songKey}`;

  return {
    ...song,
    queueId:
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : Math.random().toString(36).substring(7),
    streamUrl: `${streamBase}/master.m3u8`,
    captionUrl: `${streamBase}/caption.vtt`,
    coverUrl:
      getImageUrl(song.imageKey, {
        width: 400,
        height: 400,
        focus: "auto",
        aspectRatio: "1-1",
      }) || "",
    posterUrl:
      getImageUrl(song.imageKey, {
        width: 720,
        height: 720,
        focus: "auto",
        aspectRatio: "1-1",
        quality: 90,
      }) || "",
  };
}

export function normalizePlayerSong(song: any): PlayerSong {
  const streamBase = `${S3_BASE_URL}/${song.songKey}`;
  return {
    ...song,
    queueId:
      song.queueId ||
      (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : Math.random().toString(36).substring(7)),
    streamUrl: `${streamBase}/master.m3u8`,
    captionUrl: `${streamBase}/caption.vtt`,
    coverUrl:
      getImageUrl(song.imageKey, {
        width: 400,
        height: 400,
        focus: "auto",
        aspectRatio: "1-1",
      }) || "",
    posterUrl:
      getImageUrl(song.imageKey, {
        width: 720,
        height: 720,
        focus: "auto",
        aspectRatio: "1-1",
        quality: 90,
      }) || "",
  };
}

export function mapListToPlayerSongs(songs: Song[]): PlayerSong[] {
  return songs.map(mapToPlayerSong);
}
