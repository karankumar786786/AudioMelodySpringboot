import { api } from "./baseApi";
import { Artist, Song, PaginatedResponse, ArtistFollowStatus } from "@/types";
import { getAlgoliaClient } from "./algoliaClient";
import { normalizeSong } from "@/utils/normalizeSong";

export interface ArtistService {
  getArtistById(id: string): Promise<Artist>;
  getArtistSongs(
    id: string,
    page?: number,
    size?: number,
    artistName?: string
  ): Promise<PaginatedResponse<Song>>;
  getFollowStatus(id: string): Promise<ArtistFollowStatus>;
  followArtist(id: string): Promise<ArtistFollowStatus>;
  unfollowArtist(id: string): Promise<ArtistFollowStatus>;
}

export const artistService: ArtistService = {
  async getArtistById(id: string): Promise<Artist> {
    const response = await api.get<Artist>(`/artists/${encodeURIComponent(id)}`);
    return response.data;
  },

  async getArtistSongs(
    id: string,
    page = 0,
    size = 20,
    artistName?: string
  ): Promise<PaginatedResponse<Song>> {
    const targetQuery =
      artistName?.trim() ||
      (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
        ? id.trim()
        : "");

    if (targetQuery.length > 0) {
      try {
        const { client, indexName } = getAlgoliaClient();
        let response: any;
        try {
          response = await client.searchSingleIndex({
            indexName,
            searchParams: {
              query: targetQuery,
              filters: "type:song",
              restrictSearchableAttributes: ["artistName"],
              hitsPerPage: size,
              page: page,
              typoTolerance: true,
            },
          });
        } catch (attrErr) {
          // Retry without restrictSearchableAttributes if index settings conflict
          response = await client.searchSingleIndex({
            indexName,
            searchParams: {
              query: targetQuery,
              filters: "type:song",
              hitsPerPage: size,
              page: page,
              typoTolerance: true,
            },
          });
        }

        const hits: any[] = response.hits || [];
        if (hits.length > 0) {
          const songs: Song[] = hits.map((h: any) => normalizeSong(h, "algolia"));
          const totalHits = response.nbHits || songs.length;
          return {
            content: songs,
            page,
            size,
            paginationMetaData: {
              totalCount: totalHits,
              activeCount: totalHits,
            },
          };
        }
      } catch (err) {
        console.warn("[ArtistService] Algolia songs query error:", err);
      }
    }

    // Zero DB queries - return empty result to avoid expensive DB fallback
    return {
      content: [],
      page,
      size,
      paginationMetaData: {
        totalCount: 0,
        activeCount: 0,
      },
    };
  },

  async getFollowStatus(id: string): Promise<ArtistFollowStatus> {
    const response = await api.get<ArtistFollowStatus>(
      `/artists/${encodeURIComponent(id)}/follow-status`
    );
    return response.data;
  },

  async followArtist(id: string): Promise<ArtistFollowStatus> {
    const response = await api.post<ArtistFollowStatus>(
      `/artists/${encodeURIComponent(id)}/follow`
    );
    return response.data;
  },

  async unfollowArtist(id: string): Promise<ArtistFollowStatus> {
    const response = await api.post<ArtistFollowStatus>(
      `/artists/${encodeURIComponent(id)}/unfollow`
    );
    return response.data;
  },
};
