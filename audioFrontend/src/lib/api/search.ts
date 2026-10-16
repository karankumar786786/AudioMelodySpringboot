import { request } from "./client";
import type {
  AlgoliaConfig,
  Artist,
  Playlist,
  Song,
  UnifiedSearchResult,
  UserPlaylist,
} from "./types";

let algoliaConfigCache: {
  appId: string;
  indexName: string;
  apiKey: string;
  fetchedAt: number;
} | null = null;

export async function getAlgoliaConfig(): Promise<AlgoliaConfig | null> {
  const now = Date.now();
  // Cache credentials in-memory for 1 hour
  if (algoliaConfigCache && now - algoliaConfigCache.fetchedAt < 3600 * 1000) {
    return algoliaConfigCache;
  }
  try {
    const config = await request<AlgoliaConfig>("/api/search/config");
    if (config?.appId && config?.indexName && config?.apiKey) {
      algoliaConfigCache = { ...config, fetchedAt: now };
      return algoliaConfigCache;
    }
    return null;
  } catch {
    return null;
  }
}

export async function searchDirectAlgolia(query: string): Promise<UnifiedSearchResult | null> {
  const config = await getAlgoliaConfig();
  if (!config || !config.apiKey) return null;

  const trimmed = query.trim();
  if (!trimmed) return null;

  // 1. Try Algolia multi-search so artists, songs, and playlists each get their dedicated quota
  try {
    const multiUrl = `https://${config.appId}-dsn.algolia.net/1/indexes/*/queries`;
    const response = await fetch(multiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-algolia-application-id": config.appId,
        "x-algolia-api-key": config.apiKey,
      },
      body: JSON.stringify({
        requests: [
          {
            indexName: config.indexName,
            query: trimmed,
            filters: "type:artist",
            hitsPerPage: 8,
          },
          {
            indexName: config.indexName,
            query: trimmed,
            filters: "type:song",
            hitsPerPage: 15,
          },
          {
            indexName: config.indexName,
            query: trimmed,
            filters: "type:playlist",
            hitsPerPage: 6,
          },
        ],
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const results = data.results || [];
      const artistHits: any[] = results[0]?.hits || [];
      const songHits: any[] = results[1]?.hits || [];
      const playlistHits: any[] = results[2]?.hits || [];

      const songs: Song[] = songHits.map((hit: any) => ({
        id: hit.objectID || hit.id,
        title: hit.title || "",
        artistName: hit.artistName || "",
        duration: hit.duration || 0,
        songKey: hit.songKey || "",
        imageKey: hit.imageKey || "",
        album: hit.album || null,
        genre: hit.genre || null,
        language: hit.language || "",
        lrclibId: hit.lrclibId || "",
        totalStreams: typeof hit.totalStreams === "number" ? hit.totalStreams : 0,
      }));

      const artists: Artist[] = artistHits.map((hit: any) => ({
        id: hit.objectID || hit.id,
        name: hit.name || "",
        coverImageKey: hit.coverImageKey || "",
        followersCount: typeof hit.followersCount === "number" ? hit.followersCount : undefined,
      }));

      const playlists: Playlist[] = [];
      const userPlaylists: UserPlaylist[] = [];

      for (const hit of playlistHits) {
        const id = hit.objectID || hit.id;
        const isUserPlaylist = hit.isUserPlaylist || Boolean(hit.ownerId) || hit.type === "userPlaylist";
        if (isUserPlaylist) {
          userPlaylists.push({
            id,
            name: hit.name || "",
            totalSongs: hit.totalSongs || 0,
            coverImageKey: hit.coverImageKey || "",
            privacy: hit.privacy || "PUBLIC",
            ownerName: hit.ownerName,
          });
        } else {
          playlists.push({
            id,
            name: hit.name || "",
            totalSongs: hit.totalSongs || 0,
            coverImageKey: hit.coverImageKey || "",
          });
        }
      }

      if (songs.length > 0 || artists.length > 0 || playlists.length > 0 || userPlaylists.length > 0) {
        return { songs, artists, playlists, userPlaylists };
      }
    }
  } catch {
    // Continue to single query fallback
  }

  // 2. Fallback to single index query with larger hitsPerPage (100) so artists are not pushed off
  try {
    const url = `https://${config.appId}-dsn.algolia.net/1/indexes/${encodeURIComponent(config.indexName)}/query`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-algolia-application-id": config.appId,
        "x-algolia-api-key": config.apiKey,
      },
      body: JSON.stringify({
        query: trimmed,
        hitsPerPage: 100,
      }),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const hits: any[] = data.hits || [];

    const songs: Song[] = [];
    const artists: Artist[] = [];
    const playlists: Playlist[] = [];
    const userPlaylists: UserPlaylist[] = [];

    for (const hit of hits) {
      const id = hit.objectID || hit.id;
      const type = hit.type;

      if (type === "song") {
        if (songs.length < 20) {
          const streams = typeof hit.totalStreams === "number" ? hit.totalStreams : 0;
          songs.push({
            id,
            title: hit.title || "",
            artistName: hit.artistName || "",
            duration: hit.duration || 0,
            songKey: hit.songKey || "",
            imageKey: hit.imageKey || "",
            album: hit.album || null,
            genre: hit.genre || null,
            language: hit.language || "",
            lrclibId: hit.lrclibId || "",
            totalStreams: streams,
          });
        }
      } else if (type === "artist") {
        if (artists.length < 8) {
          artists.push({
            id,
            name: hit.name || "",
            coverImageKey: hit.coverImageKey || "",
            followersCount: typeof hit.followersCount === "number" ? hit.followersCount : undefined,
          });
        }
      } else if (type === "playlist" || type === "userPlaylist") {
        const isUserPlaylist = hit.isUserPlaylist || Boolean(hit.ownerId) || hit.type === "userPlaylist";
        if (isUserPlaylist) {
          if (userPlaylists.length < 6) {
            userPlaylists.push({
              id,
              name: hit.name || "",
              totalSongs: hit.totalSongs || 0,
              coverImageKey: hit.coverImageKey || "",
              privacy: hit.privacy || "PUBLIC",
              ownerName: hit.ownerName,
            });
          }
        } else {
          if (playlists.length < 6) {
            playlists.push({
              id,
              name: hit.name || "",
              totalSongs: hit.totalSongs || 0,
              coverImageKey: hit.coverImageKey || "",
            });
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
  getConfig: getAlgoliaConfig,
  unified: async (query: string): Promise<{ data: UnifiedSearchResult }> => {
    if (!query || !query.trim()) {
      return { data: { songs: [], artists: [], playlists: [], userPlaylists: [] } };
    }
    // 1. Try blazing-fast (<20ms) direct Algolia search from frontend
    try {
      const direct = await searchDirectAlgolia(query);
      if (direct && (direct.songs.length > 0 || direct.artists.length > 0 || direct.playlists.length > 0)) {
        return { data: direct };
      }
    } catch {
      // Fall through to backend unified search
    }

    // 2. Seamless fallback to Spring Boot (/api/search?q=...)
    try {
      const data = await request<UnifiedSearchResult>(`/api/search?q=${encodeURIComponent(query)}`);
      return {
        data: {
          songs: data?.songs || [],
          artists: data?.artists || [],
          playlists: data?.playlists || [],
          userPlaylists: data?.userPlaylists || [],
        },
      };
    } catch {
      return { data: { songs: [], artists: [], playlists: [], userPlaylists: [] } };
    }
  },
};
