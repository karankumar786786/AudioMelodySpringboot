import { algoliasearch, type SearchClient } from "algoliasearch";
import { api } from "./baseApi";
import {
  SearchResult,
  UserSearchHistoryGrouped,
  SaveSearchHistoryRequest,
  SearchHistoryType,
  Song,
  Artist,
  Playlist,
  UserPlaylist,
} from "@/types";

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
  const songKey = hit.songKey || hit.audioKey || "";
  const audioKey = hit.audioKey || hit.songKey || "";
  const videoKey = hit.videoKey || hit.canvasKey || null;
  const canvasKey = hit.canvasKey || hit.videoKey || null;
  const clipStartSec =
    typeof hit.clipStartSec === "number"
      ? hit.clipStartSec
      : typeof hit.canvasStartTime === "number"
        ? hit.canvasStartTime
        : undefined;
  const clipEndSec =
    typeof hit.clipEndSec === "number"
      ? hit.clipEndSec
      : typeof hit.canvasEndTime === "number"
        ? hit.canvasEndTime
        : undefined;

  return {
    id: hit.objectID || hit.id,
    title: hit.title || "",
    artistName: hit.artistName || hit.artist || "",
    duration: typeof hit.duration === "number" ? hit.duration : 0,
    songKey,
    audioKey,
    imageKey: hit.imageKey || hit.coverImageKey || "",
    videoKey,
    canvasKey,
    fullVideoKey: hit.fullVideoKey || null,
    previewStartTime:
      typeof hit.previewStartTime === "number"
        ? hit.previewStartTime
        : undefined,
    previewEndTime:
      typeof hit.previewEndTime === "number" ? hit.previewEndTime : undefined,
    clipStartSec,
    clipEndSec,
    canvasStartTime: clipStartSec,
    canvasEndTime: clipEndSec,
    album: hit.album || undefined,
    genre: hit.genre || undefined,
    language: hit.language || "",
    lrclibId: hit.lrclibId || "",
    isFeatured: Boolean(hit.isFeatured),
    status: hit.status || "ACTIVE",
    jobId: hit.jobId || undefined,
    createdAt: hit.createdAt || undefined,
    totalStreams:
      typeof hit.totalStreams === "number"
        ? hit.totalStreams
        : typeof hit.listenCount === "number"
          ? hit.listenCount
          : 0,
  };
}

function mapArtistHit(hit: any): Artist {
  return {
    id: hit.objectID || hit.id,
    name: hit.name || "",
    coverImageKey: hit.coverImageKey || "",
    followersCount:
      typeof hit.followersCount === "number" ? hit.followersCount : undefined,
  };
}

function mapPlaylistHit(hit: any): {
  isUserPlaylist: boolean;
  playlist?: Playlist;
  userPlaylist?: UserPlaylist;
} {
  const id = hit.objectID || hit.id;
  const isUserPlaylist =
    hit.isUserPlaylist || Boolean(hit.ownerId) || hit.type === "userPlaylist";

  if (isUserPlaylist) {
    return {
      isUserPlaylist: true,
      userPlaylist: {
        id,
        name: hit.name || "",
        totalSongs: hit.totalSongs || 0,
        privacy: hit.privacy || "PUBLIC",
        ownerName: hit.ownerName,
      },
    };
  }

  return {
    isUserPlaylist: false,
    playlist: {
      id,
      name: hit.name || "",
      totalSongs: hit.totalSongs || 0,
      coverImageKey: hit.coverImageKey || "",
    },
  };
}

export interface SearchService {
  search(query: string): Promise<SearchResult>;
  getSearchHistory(): Promise<UserSearchHistoryGrouped>;
  saveSearchHistory(data: SaveSearchHistoryRequest): Promise<void>;
  deleteSearchHistoryItem(id: string): Promise<void>;
  clearSearchHistory(): Promise<void>;
  trackSearchClick(type: SearchHistoryType, id: string): Promise<void>;
  trackSearchPlay(songId: string): Promise<void>;
}

export const searchService: SearchService = {
  /**
   * Direct Algolia search identical to audioFrontend architecture:
   * Queries Algolia index directly using the Algolia client with typo-tolerance
   * and facet filters for artists, songs, and playlists.
   */
  async search(query: string): Promise<SearchResult> {
    const trimmed = query.trim();
    if (!trimmed) {
      return { songs: [], artists: [], playlists: [], userPlaylists: [] };
    }

    const { client, indexName } = getAlgoliaClient();

    // 1. Primary: Multi-search category queries with typo tolerance
    try {
      const response = await client.search({
        requests: [
          {
            indexName,
            query: trimmed,
            filters: "type:artist",
            hitsPerPage: 8,
            typoTolerance: true,
          },
          {
            indexName,
            query: trimmed,
            filters: "type:song",
            hitsPerPage: 20,
            typoTolerance: true,
          },
          {
            indexName,
            query: trimmed,
            filters: "type:playlist OR type:userPlaylist",
            hitsPerPage: 10,
            typoTolerance: true,
          },
        ],
      });

      const results = response.results || [];
      const artistHits: any[] = (results[0] as any)?.hits || [];
      const songHits: any[] = (results[1] as any)?.hits || [];
      const playlistHits: any[] = (results[2] as any)?.hits || [];

      const songs: Song[] = songHits.map(mapSongHit);
      const artists: Artist[] = artistHits.map(mapArtistHit);
      const playlists: Playlist[] = [];
      const userPlaylists: UserPlaylist[] = [];

      for (const hit of playlistHits) {
        const mapped = mapPlaylistHit(hit);
        if (mapped.isUserPlaylist && mapped.userPlaylist) {
          userPlaylists.push(mapped.userPlaylist);
        } else if (mapped.playlist) {
          playlists.push(mapped.playlist);
        }
      }

      return { songs, artists, playlists, userPlaylists };
    } catch {
      // Continue to single query fallback
    }

    // 2. Fallback to single index query with larger hitsPerPage (100)
    try {
      const singleRes = await client.searchSingleIndex({
        indexName,
        searchParams: {
          query: trimmed,
          hitsPerPage: 100,
          typoTolerance: true,
        },
      });

      const hits: any[] = singleRes.hits || [];
      const songs: Song[] = [];
      const artists: Artist[] = [];
      const playlists: Playlist[] = [];
      const userPlaylists: UserPlaylist[] = [];

      for (const hit of hits) {
        const type = hit.type;

        if (type === "song") {
          if (songs.length < 20) {
            songs.push(mapSongHit(hit));
          }
        } else if (type === "artist") {
          if (artists.length < 8) {
            artists.push(mapArtistHit(hit));
          }
        } else if (type === "playlist" || type === "userPlaylist") {
          const mapped = mapPlaylistHit(hit);
          if (mapped.isUserPlaylist && mapped.userPlaylist) {
            if (userPlaylists.length < 10) {
              userPlaylists.push(mapped.userPlaylist);
            }
          } else if (mapped.playlist) {
            if (playlists.length < 10) {
              playlists.push(mapped.playlist);
            }
          }
        }
      }

      return { songs, artists, playlists, userPlaylists };
    } catch {
      return { songs: [], artists: [], playlists: [], userPlaylists: [] };
    }
  },

  async getSearchHistory(): Promise<UserSearchHistoryGrouped> {
    const response = await api.get<UserSearchHistoryGrouped>(
      "/user/history/search"
    );
    return response.data;
  },

  async saveSearchHistory(data: SaveSearchHistoryRequest): Promise<void> {
    try {
      await api.post("/user/history/search", data);
    } catch {
      // Fire-and-forget: do not block UX if search history fails
    }
  },

  async deleteSearchHistoryItem(id: string): Promise<void> {
    await api.delete(`/user/history/search/${id}`);
  },

  async clearSearchHistory(): Promise<void> {
    await api.delete("/user/history/search");
  },

  async trackSearchClick(type: SearchHistoryType, id: string): Promise<void> {
    try {
      await api.post("/interaction/search-click", { type, id });
    } catch {
      // Non-blocking interaction tracking
    }
  },

  async trackSearchPlay(songId: string): Promise<void> {
    try {
      await api.post("/interaction/search-play", { songId });
    } catch {
      // Non-blocking interaction tracking
    }
  },
};
