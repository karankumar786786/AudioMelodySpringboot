import { formatPaginated, request } from "./client";
import { getAlgoliaClient } from "./search";
import type { Artist, ArtistFollowStatus, Song } from "./types";

export const artistsApi = {
  list: async (page = 1, size = 15) => {
    const res = await request(`/api/artists?page=${page - 1}&size=${size}`);
    return formatPaginated<Artist>(res);
  },
  getById: async (id: string) => {
    const data = await request<Artist>(`/api/artists/${id}`);
    return { data };
  },
  getSongsFromAlgolia: async (artistName: string, page = 1, size = 15) => {
    if (!artistName?.trim()) return null;
    const algolia = await getAlgoliaClient();
    if (!algolia) return null;

    try {
      const response = await algolia.client.searchSingleIndex({
        indexName: algolia.indexName,
        searchParams: {
          query: artistName.trim(),
          filters: "type:song",
          restrictSearchableAttributes: ["artistName", "artist"],
          hitsPerPage: size,
          page: Math.max(0, page - 1),
          typoTolerance: true,
        },
      });

      const hits: any[] = response.hits || [];

      const songs: Song[] = hits.map((hit: any) => ({
        id: hit.objectID || hit.id,
        title: hit.title || "",
        artistName: hit.artistName || hit.artist || artistName,
        duration: hit.duration || 0,
        songKey: hit.songKey || "",
        imageKey: hit.imageKey || hit.coverImageKey || "",
        videoKey: hit.videoKey || null,
        previewStartTime:
          typeof hit.previewStartTime === "number"
            ? hit.previewStartTime
            : undefined,
        previewEndTime:
          typeof hit.previewEndTime === "number"
            ? hit.previewEndTime
            : undefined,
        album: hit.album || null,
        genre: hit.genre || null,
        language: hit.language || "",
        lrclibId: hit.lrclibId || "",
        totalStreams:
          typeof hit.totalStreams === "number"
            ? hit.totalStreams
            : typeof hit.listenCount === "number"
              ? hit.listenCount
              : 0,
      }));

      return {
        data: {
          data: songs,
          pagination: {
            page,
            limit: size,
            total: response.nbHits || songs.length,
            hasNext: page * size < (response.nbHits || songs.length),
          },
        },
      };
    } catch (err) {
      console.warn(
        "[ArtistsApi] Direct Algolia artist songs query failed:",
        err,
      );
      return null;
    }
  },
  getSongsFromDbFallback: async (idOrName: string, page = 1, size = 15) => {
    try {
      const res = await request(
        `/api/artists/${encodeURIComponent(idOrName)}/songs?page=${page - 1}&size=${size}`,
      );
      return formatPaginated<Song>(res);
    } catch (err) {
      console.warn(
        `[ArtistsApi] Database fallback failed for ${idOrName}:`,
        err,
      );
      return {
        data: {
          data: [],
          pagination: { page, limit: size, total: 0, hasNext: false },
        },
      };
    }
  },
  getBackupSongs: async (idOrName: string, page = 1, size = 15) => {
    return artistsApi.getSongsFromDbFallback(idOrName, page, size);
  },
  getSongs: async (
    idOrName: string,
    page = 1,
    size = 15,
    artistName?: string,
  ) => {
    // 1. Primary: Load artist songs directly from Algolia with pagination (instant, zero DB queries)
    const targetQuery = artistName || idOrName;
    if (targetQuery) {
      try {
        const algoliaResult = await artistsApi.getSongsFromAlgolia(
          targetQuery,
          page,
          size,
        );
        if (
          algoliaResult &&
          algoliaResult.data?.data &&
          algoliaResult.data.data.length > 0
        ) {
          return algoliaResult;
        }
      } catch (err) {
        console.warn(
          "[ArtistsApi] Algolia query error, falling back to database backup API:",
          err,
        );
      }
    }

    // 2. Dedicated fallback: Load from backend database backup API
    return artistsApi.getSongsFromDbFallback(idOrName, page, size);
  },
  follow: async (idOrName: string) => {
    const data = await request<ArtistFollowStatus>(
      `/api/artists/${encodeURIComponent(idOrName)}/follow`,
      {
        method: "POST",
      },
    );
    return { data };
  },
  unfollow: async (idOrName: string) => {
    const data = await request<ArtistFollowStatus>(
      `/api/artists/${encodeURIComponent(idOrName)}/unfollow`,
      {
        method: "POST",
      },
    );
    return { data };
  },
  getFollowStatus: async (idOrName: string) => {
    const data = await request<ArtistFollowStatus>(
      `/api/artists/${encodeURIComponent(idOrName)}/follow-status`,
    );
    return { data };
  },
  getOnboardingList: async () => {
    const res = await request<Artist[]>("/api/artists/onboarding-list");
    return { data: res || [] };
  },
  search: async (query: string) => {
    const res = await request<Artist[]>(
      `/api/artists/search?q=${encodeURIComponent(query)}`,
    );
    return { data: res || [] };
  },
  completeOnboarding: async (artistIds: string[]) => {
    const data = await request<{
      success: boolean;
      followedCount: number;
      message: string;
    }>("/api/artists/onboarding", {
      method: "POST",
      body: JSON.stringify({ artistIds }),
    });
    return { data };
  },
};
