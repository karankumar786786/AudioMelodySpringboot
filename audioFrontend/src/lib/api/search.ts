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

  const url = `https://${config.appId}-dsn.algolia.net/1/indexes/${encodeURIComponent(config.indexName)}/query`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-algolia-application-id": config.appId,
      "x-algolia-api-key": config.apiKey,
    },
    body: JSON.stringify({
      query: query.trim(),
      hitsPerPage: 20,
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
    } else if (type === "artist") {
      artists.push({
        id,
        name: hit.name || "",
        coverImageKey: hit.coverImageKey || "",
      });
    } else if (type === "playlist" || type === "userPlaylist") {
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
  }

  return { songs, artists, playlists, userPlaylists };
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
