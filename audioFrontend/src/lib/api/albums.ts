import { request } from "./client";
import { getAlgoliaClient, mapSongHit } from "./search";
import type { Album, Song } from "./types";

export const albumsApi = {
  list: async () => {
    const res = await request<Album[]>(`/api/songs/albums`);
    return Array.isArray(res) ? res : [];
  },
  getByName: async (name: string) => {
    if (!name?.trim()) return [];
    const trimmed = name.trim();
    try {
      const res = await request<Song[]>(`/api/songs/album/${encodeURIComponent(trimmed)}`);
      if (Array.isArray(res) && res.length > 0) {
        return res;
      }
    } catch (err) {
      console.warn(`[AlbumsApi] Backend fetch failed for "${trimmed}":`, err);
    }

    // Algolia search fallback
    try {
      const algolia = getAlgoliaClient();
      if (algolia) {
        const response: any = await algolia.client.searchSingleIndex({
          indexName: algolia.indexName,
          searchParams: {
            query: trimmed,
            filters: "type:song",
            hitsPerPage: 100,
          },
        });
        const hits: any[] = response.hits || [];
        const matched = hits.filter(
          (h) => h.album && h.album.toLowerCase() === trimmed.toLowerCase()
        );
        const results = matched.length > 0 ? matched : hits.filter((h) =>
          h.album && h.album.toLowerCase().includes(trimmed.toLowerCase())
        );
        if (results.length > 0) {
          return results.map(mapSongHit);
        }
      }
    } catch (algoliaErr) {
      console.warn(`[AlbumsApi] Algolia fallback failed for "${trimmed}":`, algoliaErr);
    }

    return [];
  },
};
