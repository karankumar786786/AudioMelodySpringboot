import AsyncStorage from "@react-native-async-storage/async-storage";
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
  WordSuggestion,
  RecentSearchItem,
  AutocompleteResult,
} from "@/types";
import { getAlgoliaClient } from "./algoliaClient";
import { normalizeSong } from "@/utils/normalizeSong";

const RECENT_SEARCHES_STORAGE_KEY = "@one_melody_recent_searches_v2";
const MAX_RECENT_ITEMS = 12;

export function extractWordSuggestions(query: string, hits: any[]): WordSuggestion[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const results: WordSuggestion[] = [];
  const seen = new Set<string>();

  // 1. Extract exact matching word from Algolia's _highlightResult
  for (const hit of hits) {
    const highlights = [
      hit._highlightResult?.title?.value,
      hit._highlightResult?.name?.value,
      hit._highlightResult?.artistName?.value,
    ].filter(Boolean);

    for (const hl of highlights) {
      const regex = /<em>([^<]+)<\/em>([\w'-]*)/gi;
      let m: RegExpExecArray | null;
      while ((m = regex.exec(hl)) !== null) {
        const fullWord = (m[1] + (m[2] || "")).trim();
        const lowerWord = fullWord.toLowerCase();
        if (lowerWord.length >= q.length && !seen.has(lowerWord)) {
          seen.add(lowerWord);
          results.push({
            label: fullWord,
            type: "word",
            matchedPrefix: m[1],
          });
        }
      }
    }
    if (results.length >= 2) break;
  }

  // 2. Add top matching song / artist titles
  for (const hit of hits) {
    const title = (hit.title || hit.name || "").trim();
    if (!title) continue;
    const lowerTitle = title.toLowerCase();
    if (!seen.has(lowerTitle)) {
      seen.add(lowerTitle);
      results.push({
        label: title,
        type: hit.type === "artist" ? "artist" : "song",
      });
    }
    if (results.length >= 4) break;
  }

  return results.slice(0, 4);
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
  autocomplete(query: string): Promise<AutocompleteResult>;
  getStoredRecentSearches(): Promise<RecentSearchItem[]>;
  saveRecentSearchItem(
    entry: Omit<RecentSearchItem, "timestamp">
  ): Promise<RecentSearchItem[]>;
  removeRecentSearchItem(id: string): Promise<RecentSearchItem[]>;
  clearAllRecentSearches(): Promise<void>;
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
            hitsPerPage: 4,
            typoTolerance: true,
          },
          {
            indexName,
            query: trimmed,
            filters: "type:song",
            hitsPerPage: 8,
            typoTolerance: true,
          },
          {
            indexName,
            query: trimmed,
            filters: "type:playlist OR type:userPlaylist",
            hitsPerPage: 8,
            typoTolerance: true,
          },
        ],
      });

      const results = response.results || [];
      const artistHits: any[] = (results[0] as any)?.hits || [];
      const songHits: any[] = (results[1] as any)?.hits || [];
      const playlistHits: any[] = (results[2] as any)?.hits || [];

      const songs: Song[] = songHits.slice(0, 8).map((h: any) => normalizeSong(h, "algolia"));
      const artists: Artist[] = artistHits.slice(0, 4).map(mapArtistHit);
      const playlists: Playlist[] = [];
      const userPlaylists: UserPlaylist[] = [];

      for (const hit of playlistHits) {
        const mapped = mapPlaylistHit(hit);
        if (mapped.isUserPlaylist && mapped.userPlaylist) {
          if (userPlaylists.length < 4) {
            userPlaylists.push(mapped.userPlaylist);
          }
        } else if (mapped.playlist) {
          if (playlists.length < 4) {
            playlists.push(mapped.playlist);
          }
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
          if (songs.length < 8) {
            songs.push(normalizeSong(hit, "algolia"));
          }
        } else if (type === "artist") {
          if (artists.length < 4) {
            artists.push(mapArtistHit(hit));
          }
        } else if (type === "playlist" || type === "userPlaylist") {
          const mapped = mapPlaylistHit(hit);
          if (mapped.isUserPlaylist && mapped.userPlaylist) {
            if (userPlaylists.length < 4) {
              userPlaylists.push(mapped.userPlaylist);
            }
          } else if (mapped.playlist) {
            if (playlists.length < 4) {
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

  /**
   * Fast multi-search Algolia autocomplete identical to audioFrontend:
   * Requests word highlight suggestions, top songs, artists, and playlists in one round-trip.
   */
  async autocomplete(query: string): Promise<AutocompleteResult> {
    const trimmed = query.trim();
    if (!trimmed) {
      return {
        wordSuggestions: [],
        prediction: "",
        songs: [],
        artists: [],
        playlists: [],
        userPlaylists: [],
      };
    }

    const { client, indexName } = getAlgoliaClient();

    try {
      const response = await client.search({
        requests: [
          // 1. General query for word suggestions (unfiltered hits)
          {
            indexName,
            query: trimmed,
            hitsPerPage: 8,
            typoTolerance: true,
          },
          // 2. Songs
          {
            indexName,
            query: trimmed,
            filters: "type:song",
            hitsPerPage: 5,
            typoTolerance: true,
          },
          // 3. Artists
          {
            indexName,
            query: trimmed,
            filters: "type:artist",
            hitsPerPage: 3,
            typoTolerance: true,
          },
          // 4. Playlists & Community Playlists
          {
            indexName,
            query: trimmed,
            filters: "type:playlist OR type:userPlaylist",
            hitsPerPage: 3,
            typoTolerance: true,
          },
        ],
      });

      const results = response.results || [];
      const suggestionHits: any[] = (results[0] as any)?.hits || [];
      const songHits: any[] = (results[1] as any)?.hits || [];
      const artistHits: any[] = (results[2] as any)?.hits || [];
      const playlistHits: any[] = (results[3] as any)?.hits || [];

      const wordSuggestions = extractWordSuggestions(trimmed, suggestionHits);

      const songs: Song[] = songHits.map((h: any) =>
        normalizeSong(h, "algolia")
      );
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

      let prediction = "";
      if (wordSuggestions.length > 0) {
        prediction = wordSuggestions[0].label;
      } else if (songs.length > 0) {
        prediction = songs[0].title;
      }

      return {
        wordSuggestions,
        prediction,
        songs,
        artists,
        playlists,
        userPlaylists,
      };
    } catch (err) {
      console.warn("Algolia autocomplete failed, falling back to basic search:", err);
      try {
        const fallback = await searchService.search(trimmed);
        return {
          wordSuggestions: [],
          prediction: fallback.songs[0]?.title || "",
          songs: fallback.songs.slice(0, 5),
          artists: fallback.artists.slice(0, 3),
          playlists: fallback.playlists.slice(0, 3),
          userPlaylists: fallback.userPlaylists.slice(0, 3),
        };
      } catch {
        return {
          wordSuggestions: [],
          prediction: "",
          songs: [],
          artists: [],
          playlists: [],
          userPlaylists: [],
        };
      }
    }
  },

  async getStoredRecentSearches(): Promise<RecentSearchItem[]> {
    try {
      const raw = await AsyncStorage.getItem(RECENT_SEARCHES_STORAGE_KEY);
      if (!raw) return [];
      const items = JSON.parse(raw);
      return Array.isArray(items) ? items : [];
    } catch {
      return [];
    }
  },

  async saveRecentSearchItem(
    entry: Omit<RecentSearchItem, "timestamp">
  ): Promise<RecentSearchItem[]> {
    try {
      const existing = await searchService.getStoredRecentSearches();
      const filtered = existing.filter((item) => {
        if (item.id === entry.id) return false;
        if (item.type === "word" && entry.type === "word") {
          return item.label.toLowerCase() !== entry.label.toLowerCase();
        }
        return true;
      });
      const updated: RecentSearchItem[] = [
        { ...entry, timestamp: Date.now() },
        ...filtered,
      ].slice(0, MAX_RECENT_ITEMS);
      await AsyncStorage.setItem(
        RECENT_SEARCHES_STORAGE_KEY,
        JSON.stringify(updated)
      );
      return updated;
    } catch (err) {
      console.warn("Failed to save recent search item:", err);
      return [];
    }
  },

  async removeRecentSearchItem(id: string): Promise<RecentSearchItem[]> {
    try {
      const existing = await searchService.getStoredRecentSearches();
      const updated = existing.filter((item) => item.id !== id);
      await AsyncStorage.setItem(
        RECENT_SEARCHES_STORAGE_KEY,
        JSON.stringify(updated)
      );
      return updated;
    } catch (err) {
      console.warn("Failed to remove recent search item:", err);
      return [];
    }
  },

  async clearAllRecentSearches(): Promise<void> {
    try {
      await AsyncStorage.removeItem(RECENT_SEARCHES_STORAGE_KEY);
    } catch (err) {
      console.warn("Failed to clear recent searches:", err);
    }
  },
};
