import { request } from "./client";
import type { Song } from "./types";

export function mapRecombeeHit(hit: any): Song {
  const vals = hit?.values || hit || {};
  return {
    id: String(hit?.id || vals.id || ""),
    title: vals.title || "",
    artistName: vals.artistName || "",
    duration: typeof vals.duration === "number" ? vals.duration : 0,
    songKey: vals.songKey || "",
    imageKey: vals.imageKey || "",
    videoKey: vals.videoKey || null,
    fullVideoKey: vals.fullVideoKey || null,
    previewStartTime:
      typeof vals.previewStartTime === "number"
        ? vals.previewStartTime
        : undefined,
    previewEndTime:
      typeof vals.previewEndTime === "number" ? vals.previewEndTime : undefined,
    album: vals.album || null,
    genre: vals.genre || null,
    language: vals.language || "",
    lrclibId: vals.lrclibId || "",
    isFeatured: Boolean(vals.isFeatured),
    status: vals.status || "ACTIVE",
    jobId: vals.jobId || null,
    createdAt: vals.createdAt || "",
    totalStreams:
      typeof vals.totalStreams === "number" ? vals.totalStreams : 0,
  };
}

export const recombeeApi = {
  /**
   * Recommend items directly to a user via Spring Boot coreEngine backend.
   */
  recommendItemsToUser: async (
    _targetUserId?: string,
    count = 10,
  ): Promise<Song[] | null> => {
    try {
      const res = await request<Song[]>(
        `/api/recommendations/user?count=${count}`,
      );
      const list = Array.isArray(res) ? res : [];
      return list.length > 0 ? list : null;
    } catch (err) {
      console.warn("[Recombee] Backend recommendItemsToUser failed:", err);
      return null;
    }
  },

  /**
   * Recommend similar items via Spring Boot coreEngine backend with diversity and ranking.
   */
  recommendSimilarSongs: async (
    songId: string,
    count = 10,
  ): Promise<Song[] | null> => {
    if (!songId) return null;
    try {
      const res = await request<Song[]>(
        `/api/recommendations/similar/${encodeURIComponent(songId)}?count=${count}`,
      );
      const list = Array.isArray(res) ? res : [];
      return list.length > 0 ? list : null;
    } catch (err) {
      console.warn("[Recombee] Backend recommendSimilarSongs failed:", err);
      return null;
    }
  },

  /**
   * Recommend radio songs based on a seed song via Spring Boot coreEngine backend.
   */
  recommendRadioSongs: async (
    seedSongId: string,
    excludeIds: string[] = [],
    count = 10,
  ): Promise<Song[] | null> => {
    if (!seedSongId) return null;
    try {
      const excParam =
        excludeIds.length > 0
          ? `&excludeIds=${encodeURIComponent(excludeIds.join(","))}`
          : "";
      const res = await request<Song[]>(
        `/api/recommendations/radio?seedSongId=${encodeURIComponent(seedSongId)}&count=${count}${excParam}`,
      );
      const list = Array.isArray(res) ? res : [];
      return list.length > 0 ? list : null;
    } catch (err) {
      console.warn("[Recombee] Backend recommendRadioSongs failed:", err);
      return null;
    }
  },
};
