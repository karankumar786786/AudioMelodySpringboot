import recombee from "recombee-js-api-client";
import { api } from "./baseApi";
import { Song } from "@/types";
import { normalizeSong } from "@/utils/normalizeSong";

const RECOMBEE_DB =
  process.env.EXPO_PUBLIC_RECOMBEE_DATABASE_ID || "";
const RECOMBEE_PUBLIC_TOKEN =
  process.env.EXPO_PUBLIC_RECOMBEE_PUBLIC_TOKEN || "";
const RECOMBEE_REGION =
  process.env.EXPO_PUBLIC_RECOMBEE_REGION || "eu-west";

if (!RECOMBEE_DB || !RECOMBEE_PUBLIC_TOKEN) {
  console.warn(
    "[Recombee] Missing env vars EXPO_PUBLIC_RECOMBEE_DATABASE_ID or EXPO_PUBLIC_RECOMBEE_PUBLIC_TOKEN. " +
    "Recombee recommendations will be disabled; fallback to backend/trending."
  );
}

let recombeeClientInstance: any = null;

export function getRecombeeClient(): any {
  if (!RECOMBEE_DB || !RECOMBEE_PUBLIC_TOKEN) return null;
  if (!recombeeClientInstance) {
    try {
      recombeeClientInstance = new recombee.ApiClient(
        RECOMBEE_DB,
        RECOMBEE_PUBLIC_TOKEN,
        { region: RECOMBEE_REGION }
      );
    } catch (err) {
      console.warn("[Recombee] Failed to initialize client:", err);
    }
  }
  return recombeeClientInstance;
}



export const recombeeService = {
  /**
   * Directly fetch similar songs for a clicked song from Recombee with full metadata.
   */
  async getSimilarSongs(
    songId: string,
    count = 15,
    targetUserId?: string
  ): Promise<Song[]> {
    if (!songId) return [];
    const client = getRecombeeClient();
    const user = targetUserId || "anonymous";
    // 1. Primary: Direct Recombee RecommendItemsToItem request
    if (client) {
      try {
        const response = await client.send(
          new recombee.RecommendItemsToItem(songId, user, count, {
            cascadeCreate: true,
            returnProperties: true,
          })
        );

        const recomms = response?.recomms || [];
        if (recomms.length > 0) {
          const direct = recomms
            .filter((r: any) => r.values && r.values.title && r.values.songKey)
            .map((r: any) => normalizeSong(r, "recombee"));

          if (direct.length > 0) {
            console.log(
              `[Recombee] Fetched ${direct.length} similar songs directly from Recombee for song ${songId}`
            );
            return direct;
          }
        }
      } catch (err) {
        console.warn(
          "[Recombee] Direct RecommendItemsToItem failed, falling back to backend:",
          err
        );
      }
    }

    // 2. Secondary fallback: Spring Boot backend /api/recommendations/similar/{songId}
    try {
      const response = await api.get<Song[]>(
        `/recommendations/similar/${encodeURIComponent(songId)}?count=${count}`
      );
      if (Array.isArray(response.data) && response.data.length > 0) {
        return response.data;
      }
    } catch {
      // Continue to last-resort fallback
    }

    // 3. Last-resort fallback: Trending songs
    try {
      const { homeService } = await import("./homeService");
      const trending = await homeService.getTrendingSongs(count);
      return (trending || []).filter((s) => s.id !== songId);
    } catch {
      return [];
    }
  },

  /**
   * Recommend continuous radio stream based on seed song, excluding past queue history.
   */
  async getRadioSongs(
    seedSongId: string,
    excludeIds: string[] = [],
    count = 10,
    targetUserId?: string
  ): Promise<Song[]> {
    if (!seedSongId) return [];

    const client = getRecombeeClient();
    const user = targetUserId || "anonymous";
    const excludeSet = new Set([...excludeIds, seedSongId]);

    // 1. Direct Recombee request with larger buffer to filter exclusions
    if (client) {
      try {
        const fetchCount = Math.max(count * 2, 20);
        const response = await client.send(
          new recombee.RecommendItemsToItem(seedSongId, user, fetchCount, {
            cascadeCreate: true,
            returnProperties: true,
          })
        );

        const recomms = response?.recomms || [];
        const filtered = recomms
          .filter(
            (r: any) =>
              !excludeSet.has(r.id) &&
              r.values &&
              r.values.title &&
              r.values.songKey
          )
          .slice(0, count)
          .map((r: any) => normalizeSong(r, "recombee"));

        if (filtered.length > 0) {
          return filtered;
        }
      } catch (err) {
        console.warn("[Recombee] Direct getRadioSongs failed, trying backend:", err);
      }
    }

    // 2. Fallback to backend /recommendations/radio
    try {
      const excludeParam =
        excludeIds.length > 0
          ? `&excludeIds=${encodeURIComponent(excludeIds.join(","))}`
          : "";
      const response = await api.get<Song[]>(
        `/recommendations/radio?seedSongId=${encodeURIComponent(seedSongId)}${excludeParam}&count=${count}`
      );
      if (Array.isArray(response.data) && response.data.length > 0) {
        return response.data;
      }
    } catch {
      // Continue to trending
    }

    // 3. Fallback: Trending
    try {
      const { homeService } = await import("./homeService");
      const trending = await homeService.getTrendingSongs(count * 2);
      return (trending || [])
        .filter((s) => !excludeSet.has(s.id))
        .slice(0, count);
    } catch {
      return [];
    }
  },
};
