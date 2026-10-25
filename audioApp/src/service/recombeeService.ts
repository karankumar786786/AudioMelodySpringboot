import recombee from "recombee-js-api-client";
import { api } from "./baseApi";
import { Song } from "@/types";

const RECOMBEE_DB =
  process.env.EXPO_PUBLIC_RECOMBEE_DATABASE_ID || "oneorg-prod";
const RECOMBEE_PUBLIC_TOKEN =
  process.env.EXPO_PUBLIC_RECOMBEE_PUBLIC_TOKEN ||
  "rZcQmUMV0K2CdU23RzTyzOrdQZCXxfJcbIEE9vO7nOSe2GJpVxdJl9dMf5kBWoPa";
const RECOMBEE_REGION =
  process.env.EXPO_PUBLIC_RECOMBEE_REGION || "eu-west";

let recombeeClientInstance: any = null;

export function getRecombeeClient(): any {
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

export function mapRecombeeHit(hit: any): Song {
  const vals = hit.values || {};
  const songKey = vals.songKey || vals.audioKey || "";
  const audioKey = vals.audioKey || vals.songKey || "";
  const videoKey = vals.videoKey || vals.canvasKey || null;
  const canvasKey = vals.canvasKey || vals.videoKey || null;
  const clipStartSec =
    typeof vals.clipStartSec === "number"
      ? vals.clipStartSec
      : typeof vals.canvasStartTime === "number"
        ? vals.canvasStartTime
        : undefined;
  const clipEndSec =
    typeof vals.clipEndSec === "number"
      ? vals.clipEndSec
      : typeof vals.canvasEndTime === "number"
        ? vals.canvasEndTime
        : undefined;

  return {
    id: String(hit.id || vals.id || ""),
    title: vals.title || "",
    artistName: vals.artistName || "",
    duration: typeof vals.duration === "number" ? vals.duration : 0,
    songKey,
    audioKey,
    imageKey: vals.imageKey || "",
    videoKey,
    canvasKey,
    fullVideoKey: vals.fullVideoKey || null,
    previewStartTime:
      typeof vals.previewStartTime === "number"
        ? vals.previewStartTime
        : undefined,
    previewEndTime:
      typeof vals.previewEndTime === "number" ? vals.previewEndTime : undefined,
    clipStartSec,
    clipEndSec,
    canvasStartTime: clipStartSec,
    canvasEndTime: clipEndSec,
    album: vals.album || undefined,
    genre: vals.genre || undefined,
    language: vals.language || "",
    lrclibId: vals.lrclibId || "",
    isFeatured: Boolean(vals.isFeatured),
    status: vals.status || "ACTIVE",
    jobId: vals.jobId || undefined,
    createdAt: vals.createdAt || undefined,
    totalStreams:
      typeof vals.totalStreams === "number"
        ? vals.totalStreams
        : typeof vals.listenCount === "number"
          ? vals.listenCount
          : 0,
  };
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
            .map(mapRecombeeHit);

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
          .map(mapRecombeeHit);

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
