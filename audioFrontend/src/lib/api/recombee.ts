import recombee from "recombee-js-api-client";
import { getDeviceId } from "./client";
import { getAlgoliaClient, mapSongHit } from "./search";
import type { Song } from "./types";

const RECOMBEE_DB =
  process.env.NEXT_PUBLIC_RECOMBEE_DATABASE_ID || "oneorg-prod";
const RECOMBEE_PUBLIC_TOKEN =
  process.env.NEXT_PUBLIC_RECOMBEE_PUBLIC_TOKEN ||
  "rZcQmUMV0K2CdU23RzTyzOrdQZCXxfJcbIEE9vO7nOSe2GJpVxdJl9dMf5kBWoPa";
const RECOMBEE_REGION = process.env.NEXT_PUBLIC_RECOMBEE_REGION || "eu-west";

let recombeeClientInstance: any = null;

export function getRecombeeClient(): any {
  if (!recombeeClientInstance && typeof window !== "undefined") {
    try {
      recombeeClientInstance = new recombee.ApiClient(
        RECOMBEE_DB,
        RECOMBEE_PUBLIC_TOKEN,
        { region: RECOMBEE_REGION },
      );
    } catch (err) {
      console.warn("[Recombee] Failed to initialize client:", err);
    }
  }
  return recombeeClientInstance;
}

/**
 * Hydrates recommended item IDs with rich song metadata from Algolia in ~1ms
 * preserving the exact order recommended by Recombee.
 */
export async function hydrateRecommendedSongs(
  songIds: string[],
): Promise<Song[]> {
  if (!songIds || songIds.length === 0) return [];
  const algolia = await getAlgoliaClient();
  if (!algolia) return [];

  try {
    const filter = songIds.map((id) => `objectID:${id}`).join(" OR ");
    const response = await algolia.client.searchSingleIndex({
      indexName: algolia.indexName,
      searchParams: {
        query: "",
        filters: filter,
        hitsPerPage: Math.max(songIds.length, 20),
      },
    });

    const hits: any[] = response.hits || [];

    const hitMap = new Map<string, any>();
    hits.forEach((h: any) => {
      hitMap.set(h.objectID || h.id, h);
    });

    const songs: Song[] = [];
    for (const id of songIds) {
      const hit = hitMap.get(id);
      if (hit) {
        songs.push(mapSongHit(hit));
      }
    }
    return songs;
  } catch (err) {
    console.warn("[Recombee] Algolia hydration failed:", err);
    return [];
  }
}

export const recombeeApi = {
  /**
   * Recommend items directly to a user from Recombee, hydrated via Algolia.
   */
  recommendItemsToUser: async (
    targetUserId?: string,
    count = 10,
  ): Promise<Song[] | null> => {
    const client = getRecombeeClient();
    if (!client) return null;

    const user =
      targetUserId ||
      (typeof window !== "undefined" ? getDeviceId() : "anonymous");
    try {
      const response = await client.send(
        new recombee.RecommendItemsToUser(user, count, {
          cascadeCreate: true,
          returnProperties: true,
        }),
      );

      const recomms = response?.recomms || [];
      const songIds = recomms.map((r: any) => r.id);
      if (songIds.length === 0) return null;

      const hydrated = await hydrateRecommendedSongs(songIds);
      return hydrated.length > 0 ? hydrated : null;
    } catch (err) {
      console.warn("[Recombee] recommendItemsToUser failed:", err);
      return null;
    }
  },

  /**
   * Recommend similar items directly from Recombee, hydrated via Algolia.
   */
  recommendSimilarSongs: async (
    songId: string,
    count = 10,
    targetUserId?: string,
  ): Promise<Song[] | null> => {
    const client = getRecombeeClient();
    if (!client || !songId) return null;

    const user =
      targetUserId ||
      (typeof window !== "undefined" ? getDeviceId() : "anonymous");
    try {
      const response = await client.send(
        new recombee.RecommendItemsToItem(songId, user, count, {
          cascadeCreate: true,
          returnProperties: true,
        }),
      );

      const recomms = response?.recomms || [];
      const songIds = recomms.map((r: any) => r.id);
      if (songIds.length === 0) return null;

      const hydrated = await hydrateRecommendedSongs(songIds);
      return hydrated.length > 0 ? hydrated : null;
    } catch (err) {
      console.warn("[Recombee] recommendSimilarSongs failed:", err);
      return null;
    }
  },

  /**
   * Recommend radio songs based on a seed song, excluding history.
   */
  recommendRadioSongs: async (
    seedSongId: string,
    excludeIds: string[] = [],
    count = 10,
    targetUserId?: string,
  ): Promise<Song[] | null> => {
    const client = getRecombeeClient();
    if (!client || !seedSongId) return null;

    const user =
      targetUserId ||
      (typeof window !== "undefined" ? getDeviceId() : "anonymous");
    try {
      const excludeSet = new Set([...excludeIds, seedSongId]);
      const fetchCount = Math.max(count * 2, 20);
      const response = await client.send(
        new recombee.RecommendItemsToItem(seedSongId, user, fetchCount, {
          cascadeCreate: true,
          returnProperties: true,
        }),
      );

      const recomms = response?.recomms || [];
      const songIds = recomms
        .map((r: any) => r.id)
        .filter((id: string) => !excludeSet.has(id))
        .slice(0, count);

      if (songIds.length === 0) return null;

      const hydrated = await hydrateRecommendedSongs(songIds);
      return hydrated.length > 0 ? hydrated : null;
    } catch (err) {
      console.warn("[Recombee] recommendRadioSongs failed:", err);
      return null;
    }
  },

  /**
   * Direct client-side interaction logging to Recombee using the public token.
   */
  sendDetailView: (userId: string, songId: string): void => {
    const client = getRecombeeClient();
    if (!client || !userId || !songId) return;
    client
      .send(new recombee.AddDetailView(userId, songId, { cascadeCreate: true }))
      .catch((err: any) =>
        console.debug("[Recombee] DetailView telemetry dropped:", err?.message),
      );
  },

  sendRating: (userId: string, songId: string, rating: number): void => {
    const client = getRecombeeClient();
    if (!client || !userId || !songId) return;
    client
      .send(
        new recombee.AddRating(userId, songId, rating, { cascadeCreate: true }),
      )
      .catch((err: any) =>
        console.debug("[Recombee] Rating telemetry dropped:", err?.message),
      );
  },

  sendBookmark: (userId: string, songId: string): void => {
    const client = getRecombeeClient();
    if (!client || !userId || !songId) return;
    client
      .send(new recombee.AddBookmark(userId, songId, { cascadeCreate: true }))
      .catch((err: any) =>
        console.debug("[Recombee] Bookmark telemetry dropped:", err?.message),
      );
  },
};
