import { algoliasearch, type SearchClient } from "algoliasearch";
import { api } from "./baseApi";
import { Artist, Song, PaginatedResponse, ArtistFollowStatus } from "@/types";

const ALGOLIA_APP_ID =
  process.env.EXPO_PUBLIC_ALGOLIA_APP_ID || "NQKIDY69EZ";
const ALGOLIA_SEARCH_KEY =
  process.env.EXPO_PUBLIC_ALGOLIA_SEARCH_KEY ||
  "d56f43f0df08191b3eea750c0f4d3cd0";
const ALGOLIA_INDEX_NAME =
  process.env.EXPO_PUBLIC_ALGOLIA_INDEX_NAME || "one_melody_springboot";

let algoliaClientInstance: SearchClient | null = null;

function getAlgoliaClient(): { client: SearchClient; indexName: string } {
  if (!algoliaClientInstance) {
    algoliaClientInstance = algoliasearch(
      ALGOLIA_APP_ID,
      ALGOLIA_SEARCH_KEY
    );
  }
  return { client: algoliaClientInstance, indexName: ALGOLIA_INDEX_NAME };
}

function mapSongHit(hit: any): Song {
  return {
    id: hit.objectID || hit.id,
    title: hit.title || "",
    artistName: hit.artistName || hit.artist || "",
    duration: typeof hit.duration === "number" ? hit.duration : 0,
    songKey: hit.songKey || "",
    imageKey: hit.imageKey || hit.coverImageKey || "",
    videoKey: hit.videoKey || null,
    previewStartTime:
      typeof hit.previewStartTime === "number"
        ? hit.previewStartTime
        : undefined,
    previewEndTime:
      typeof hit.previewEndTime === "number" ? hit.previewEndTime : undefined,
    album: hit.album || undefined,
    genre: hit.genre || undefined,
    language: hit.language || "",
    totalStreams:
      typeof hit.totalStreams === "number"
        ? hit.totalStreams
        : typeof hit.listenCount === "number"
          ? hit.listenCount
          : 0,
  };
}

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
    // 1. Direct Algolia attempt (identical to audioFrontend)
    if (artistName && artistName.trim().length > 0) {
      try {
        const { client, indexName } = getAlgoliaClient();
        const response = await client.searchSingleIndex({
          indexName,
          searchParams: {
            query: artistName.trim(),
            filters: "type:song",
            restrictSearchableAttributes: ["artistName", "artist"],
            hitsPerPage: size,
            page: page,
            typoTolerance: true,
          },
        });

        const hits: any[] = response.hits || [];
        if (hits.length > 0) {
          const songs: Song[] = hits.map(mapSongHit);
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

    // 2. Database backend fallback
    const response = await api.get<PaginatedResponse<Song>>(
      `/artists/${encodeURIComponent(id)}/songs?page=${page}&size=${size}`
    );
    return response.data;
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
