import { algoliasearch, type SearchClient } from "algoliasearch";
import { request } from "./client";
import type {
  Artist,
  Playlist,
  Song,
  UnifiedSearchResult,
  UserPlaylist,
} from "./types";

const ALGOLIA_APP_ID = process.env.NEXT_PUBLIC_ALGOLIA_APP_ID || "";
const ALGOLIA_SEARCH_KEY = process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_KEY || "";
const ALGOLIA_INDEX_NAME = process.env.NEXT_PUBLIC_ALGOLIA_INDEX_NAME || "";

let algoliaClientInstance: SearchClient | null = null;

/**
 * Returns the cached algoliasearch SearchClient instance and indexName synchronously.
 */
export function getAlgoliaClient(): {
  client: SearchClient;
  indexName: string;
} | null {
  if (!ALGOLIA_APP_ID || !ALGOLIA_SEARCH_KEY || !ALGOLIA_INDEX_NAME) {
    return null;
  }

  if (!algoliaClientInstance) {
    algoliaClientInstance = algoliasearch(ALGOLIA_APP_ID, ALGOLIA_SEARCH_KEY);
  }

  return { client: algoliaClientInstance, indexName: ALGOLIA_INDEX_NAME };
}

export function mapSongHit(hit: any): Song {
  return {
    id: hit.objectID || hit.id,
    title: hit.title || "",
    artistName: hit.artistName || hit.artist || "",
    duration: hit.duration || 0,
    songKey: hit.songKey || "",
    imageKey: hit.imageKey || hit.coverImageKey || "",
    videoKey: hit.videoKey || null,
    previewStartTime:
      typeof hit.previewStartTime === "number"
        ? hit.previewStartTime
        : undefined,
    previewEndTime:
      typeof hit.previewEndTime === "number" ? hit.previewEndTime : undefined,
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
        coverImageKey: hit.coverImageKey || "",
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

export async function searchDirectAlgolia(
  query: string,
): Promise<UnifiedSearchResult | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  const algolia = getAlgoliaClient();
  if (!algolia) return null;

  const { client, indexName } = algolia;

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
          hitsPerPage: 15,
          typoTolerance: true,
        },
        {
          indexName,
          query: trimmed,
          filters: "type:playlist OR type:userPlaylist",
          hitsPerPage: 6,
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
          if (userPlaylists.length < 6) {
            userPlaylists.push(mapped.userPlaylist);
          }
        } else if (mapped.playlist) {
          if (playlists.length < 6) {
            playlists.push(mapped.playlist);
          }
        }
      }
    }

    return { songs, artists, playlists, userPlaylists };
  } catch {
    return null;
  }
}

export const searchApi = {
  getClient: getAlgoliaClient,
  unified: async (query: string): Promise<{ data: UnifiedSearchResult }> => {
    const trimmed = query?.trim();
    if (!trimmed) {
      return {
        data: { songs: [], artists: [], playlists: [], userPlaylists: [] },
      };
    }

    // 1. PRIMARY: Direct Algolia search using Algolia Search Client
    // Instant client-side search with typo tolerance; avoids unnecessary database load while typing.
    try {
      const direct = await searchDirectAlgolia(trimmed);
      if (direct !== null) {
        return { data: direct };
      }
    } catch (err) {
      console.warn(
        "[Search] Direct Algolia search failed, falling back to backend:",
        err,
      );
    }

    // 2. BACKEND FALLBACK: Only if direct Algolia is unreachable or credentials are missing
    try {
      const data = await request<UnifiedSearchResult>(
        `/api/search?q=${encodeURIComponent(trimmed)}`,
      );
      if (data) {
        return {
          data: {
            songs: data.songs || [],
            artists: data.artists || [],
            playlists: data.playlists || [],
            userPlaylists: data.userPlaylists || [],
          },
        };
      }
    } catch (err) {
      console.warn("[Search] Backend search fallback failed:", err);
    }

    return {
      data: { songs: [], artists: [], playlists: [], userPlaylists: [] },
    };
  },
};
