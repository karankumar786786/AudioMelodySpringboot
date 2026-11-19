import { api } from "./baseApi";
import { Song } from "@/types";
import { normalizeSong } from "@/utils/normalizeSong";

export interface RadioResponse {
  songs: Song[];
  /** P4: Recombee recommId for session-aware "play next" continuity. Pass back on queue refill. */
  recommId?: string;
}

/** Moods served by GET /recommendations/radio/mood (see coreEngine Recommendation/Mood.java). */
export type Mood = "chill" | "workout" | "focus" | "happy" | "sad";

export const recombeeService = {
  /**
   * Mood radio: songs whose audio features match the mood, ranked server-side
   * with the user's recently played songs left out. Returns [] on failure.
   */
  async getMoodRadio(mood: Mood, count = 20): Promise<Song[]> {
    try {
      const response = await api.get<Song[]>(
        `/recommendations/radio/mood?mood=${encodeURIComponent(mood)}&count=${count}`
      );
      if (Array.isArray(response.data)) {
        return response.data.map((s) => normalizeSong(s, "api"));
      }
    } catch (err) {
      console.warn(`[RecombeeService] Backend /recommendations/radio/mood failed for ${mood}:`, err);
    }
    return [];
  },

  /**
   * Fetch similar songs for a clicked song from Spring Boot backend.
   */
  async getSimilarSongs(songId: string, count = 15): Promise<Song[]> {
    if (!songId) return [];
    try {
      const response = await api.get<Song[]>(
        `/recommendations/similar/${encodeURIComponent(songId)}?count=${count}`
      );
      if (Array.isArray(response.data) && response.data.length > 0) {
        return response.data.map((s) => normalizeSong(s, "api"));
      }
    } catch (err) {
      console.warn(
        `[RecombeeService] Backend /recommendations/similar failed for ${songId}:`,
        err
      );
    }
    return [];
  },

  /**
   * P4: Fetch radio recommendations with session recommId for continuity.
   * Uses /radio/session endpoint which returns { songs, recommId }.
   * Falls back to /radio if the session endpoint is unavailable.
   */
  async getRadioSongs(
    seedSongId: string,
    excludeIds: string[] = [],
    count = 15,
    recommId?: string
  ): Promise<RadioResponse> {
    if (!seedSongId) return { songs: [] };

    const excParam =
      excludeIds.length > 0
        ? `&excludeIds=${encodeURIComponent(excludeIds.join(","))}`
        : "";

    // If a recommId is provided, use RecommendNextItems for session-aware continuation
    if (recommId) {
      try {
        const response = await api.get<{ songs: Song[]; recommId?: string }>(
          `/recommendations/radio/session?seedSongId=${encodeURIComponent(seedSongId)}${excParam}&count=${count}&recommId=${encodeURIComponent(recommId)}`
        );
        if (response.data?.songs?.length > 0) {
          return {
            songs: response.data.songs.map((s) => normalizeSong(s, "api")),
            recommId: response.data.recommId,
          };
        }
      } catch (err) {
        if (__DEV__) console.warn("[RecombeeService] /radio/session with recommId failed:", err);
      }
    }

    // First call or fallback: use session endpoint to get recommId
    try {
      const response = await api.get<{ songs: Song[]; recommId?: string }>(
        `/recommendations/radio/session?seedSongId=${encodeURIComponent(seedSongId)}${excParam}&count=${count}`
      );
      if (response.data?.songs?.length > 0) {
        return {
          songs: response.data.songs.map((s) => normalizeSong(s, "api")),
          recommId: response.data.recommId,
        };
      }
    } catch {
      // Fall through to plain radio endpoint
    }

    // Legacy fallback: plain /radio endpoint
    try {
      const response = await api.get<Song[]>(
        `/recommendations/radio?seedSongId=${encodeURIComponent(seedSongId)}${excParam}&count=${count}`
      );
      if (Array.isArray(response.data) && response.data.length > 0) {
        return {
          songs: response.data.map((s) => normalizeSong(s, "api")),
        };
      }
    } catch (err) {
      console.warn(
        `[RecombeeService] Backend /recommendations/radio failed for ${seedSongId}:`,
        err
      );
    }
    return { songs: [] };
  },
};
