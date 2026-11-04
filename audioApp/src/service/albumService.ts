import { api } from "./baseApi";
import { getAlgoliaClient } from "./algoliaClient";
import { normalizeSong } from "@/utils/normalizeSong";
import { Song } from "@/types";

export interface AlbumService {
  getSongsByAlbum(albumName: string): Promise<Song[]>;
  getAllAlbums(): Promise<any[]>;
}

export const albumService: AlbumService = {
  async getSongsByAlbum(albumName: string): Promise<Song[]> {
    if (!albumName?.trim()) return [];
    const trimmed = albumName.trim();

    // 1. Try Backend API
    try {
      const response = await api.get<Song[]>(`/songs/album/${encodeURIComponent(trimmed)}`);
      if (Array.isArray(response.data) && response.data.length > 0) {
        return response.data.map((s) => normalizeSong(s, "api"));
      }
    } catch (err) {
      console.warn(`[AlbumService] Backend fetch failed for album "${trimmed}":`, err);
    }

    // 2. Fallback to Algolia
    try {
      const { client, indexName } = getAlgoliaClient();
      const response: any = await client.searchSingleIndex({
        indexName,
        searchParams: {
          query: trimmed,
          filters: "type:song",
          hitsPerPage: 60,
        },
      });

      const hits: any[] = response.hits || [];
      const exactMatches = hits.filter(
        (h) => h.album && h.album.toLowerCase() === trimmed.toLowerCase()
      );
      const matched = exactMatches.length > 0 ? exactMatches : hits.filter((h) =>
        h.album && h.album.toLowerCase().includes(trimmed.toLowerCase())
      );

      return (matched.length > 0 ? matched : hits).map((h) => normalizeSong(h, "algolia"));
    } catch (algoliaErr) {
      console.warn(`[AlbumService] Algolia search fallback failed for "${trimmed}":`, algoliaErr);
      return [];
    }
  },

  async getAllAlbums(): Promise<any[]> {
    try {
      const response = await api.get<any[]>("/songs/albums");
      return Array.isArray(response.data) ? response.data : [];
    } catch (err) {
      console.warn("[AlbumService] Failed to fetch all albums:", err);
      return [];
    }
  },
};
