import { api } from "./baseApi";
import { Song } from "@/types";
import { normalizeSong } from "@/utils/normalizeSong";

export const recombeeService = {
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
   * Fetch radio stream recommendations from Spring Boot backend with exclusions.
   */
  async getRadioSongs(
    seedSongId: string,
    excludeIds: string[] = [],
    count = 15
  ): Promise<Song[]> {
    if (!seedSongId) return [];
    try {
      const excParam =
        excludeIds.length > 0
          ? `&excludeIds=${encodeURIComponent(excludeIds.join(","))}`
          : "";
      const response = await api.get<Song[]>(
        `/recommendations/radio?seedSongId=${encodeURIComponent(seedSongId)}${excParam}&count=${count}`
      );
      if (Array.isArray(response.data) && response.data.length > 0) {
        return response.data.map((s) => normalizeSong(s, "api"));
      }
    } catch (err) {
      console.warn(
        `[RecombeeService] Backend /recommendations/radio failed for ${seedSongId}:`,
        err
      );
    }
    return [];
  },
};
