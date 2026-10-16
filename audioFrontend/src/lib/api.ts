const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:9090";

export interface Song {
  id: string;
  title: string;
  artistName: string;
  duration: number;
  songKey: string;
  imageKey: string;
  videoKey?: string;
  fullVideoKey?: string;
  album?: string | null;
  genre?: string | null;
  language: string;
  lrclibId: string;
  status?: string;
  isFeatured?: boolean;
  previewStartTime?: number | null;
  previewEndTime?: number | null;
  totalStreams?: number;
  createdAt?: string;
}

export interface Artist {
  id: string;
  name: string;
  about?: string;
  dob?: string;
  coverImageKey?: string;
  status?: string;
  createdAt?: string;
}

export interface ArtistFollowStatus {
  artistId: string;
  artistName: string;
  followersCount: number;
  isFollowing: boolean;
}

export type PlaylistPrivacy = "PUBLIC" | "PRIVATE" | "SHARE_BY_LINK";

export interface UserPlaylist {
  id: string;
  name: string;
  title?: string;
  privacy: PlaylistPrivacy;
  shareToken?: string;
  ownerName?: string;
  ownerId?: string;
  totalSongs: number;
  status?: string;
  description?: string;
  coverImageKey?: string;
  videoKey?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Album {
  name: string;
  artistName: string;
  trackCount: number;
  imageKey?: string;
  genre?: string;
}

export interface Playlist {
  id: string;
  name: string;
  title?: string;
  description?: string;
  coverImageKey?: string;
  videoKey?: string;
  totalSongs: number;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface UnifiedSearchResult {
  songs: Song[];
  artists: Artist[];
  playlists: Playlist[];
  userPlaylists: UserPlaylist[];
}

export interface SearchHistoryItem {
  id: string;
  type: "SONG" | "ARTIST" | "PLAYLIST" | "USER_PLAYLIST" | string;
  song?: Song | null;
  artist?: Artist | null;
  playlist?: Playlist | null;
  userPlaylist?: UserPlaylist | null;
  createdAt?: string;
}

export interface SearchHistoryGroupedResponse {
  recent: SearchHistoryItem[];
  songs: Song[];
  artists: Artist[];
  playlists: Playlist[];
  userPlaylists: UserPlaylist[];
}

export interface SaveSearchHistoryPayload {
  type?: "SONG" | "ARTIST" | "PLAYLIST" | "USER_PLAYLIST";
  songId?: string;
  artistId?: string;
  playlistId?: string;
  userPlaylistId?: string;
}

export interface User {
  id: string;
  name?: string;
  username?: string;
  email: string;
  role?: string;
}

function getStoredItem(key: string) {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(key);
}

export function getDeviceId(): string {
  if (typeof window === "undefined") {
    return "server-device";
  }
  let deviceId = localStorage.getItem("melody_device_id");
  if (!deviceId) {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      deviceId = crypto.randomUUID();
    } else {
      deviceId = `dev_${Math.random().toString(36).substring(2, 12)}_${Date.now()}`;
    }
    localStorage.setItem("melody_device_id", deviceId);
  }
  return deviceId;
}

function saveSessionTokens(accessToken: string, refreshToken: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem("system_token", accessToken);
  localStorage.setItem("system_refresh_token", refreshToken);
  import("@/store/player.store")
    .then(({ playerStore }) => {
      playerStore.setState((s) => ({
        ...s,
        systemToken: accessToken,
        systemRefreshToken: refreshToken,
      }));
    })
    .catch(() => {});
}

function notifySessionCleared() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("session:cleared"));
  }
}

function clearSessionStorage() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("system_token");
  localStorage.removeItem("system_refresh_token");
  localStorage.removeItem("system_user");
  notifySessionCleared();
}

let isRefreshing = false;
let refreshTokenPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  // If a refresh is already in progress, wait for the pending refresh promise
  if (isRefreshing && refreshTokenPromise) {
    return refreshTokenPromise;
  }

  isRefreshing = true;
  refreshTokenPromise = (async () => {
    try {
      const refreshToken = getStoredItem("system_refresh_token");
      if (!refreshToken) {
        throw new Error("No refresh token available");
      }

      const deviceId = getDeviceId();
      const url = `${API_BASE_URL}/auth/refresh-token`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Device-Id": deviceId,
        },
        body: JSON.stringify({ refreshToken, deviceId }),
      });

      if (!response.ok) {
        // Only purge session if the refresh token is explicitly rejected as unauthorized/invalid
        if (response.status === 401 || response.status === 403 || response.status === 400) {
          clearSessionStorage();
        }
        let errMessage = `HTTP error ${response.status}`;
        try {
          const errData = await response.json();
          errMessage = errData.message || errMessage;
        } catch {}
        const error: any = new Error(errMessage);
        error.response = { status: response.status };
        throw error;
      }

      const data = await response.json();
      if (!data.accessToken || !data.refreshToken) {
        clearSessionStorage();
        throw new Error("Invalid refresh token response");
      }

      saveSessionTokens(data.accessToken, data.refreshToken);
      return data.accessToken as string;
    } finally {
      isRefreshing = false;
      refreshTokenPromise = null;
    }
  })();

  return refreshTokenPromise;
}

async function request<T = any>(endpoint: string, options: RequestInit = {}, retry = true): Promise<T> {
  // Prevent any API fetch calls when offline
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    const offlineErr = new Error("Device is offline");
    (offlineErr as any).isOffline = true;
    (offlineErr as any).status = 0;
    throw offlineErr;
  }

  const token = getStoredItem("system_token");
  const deviceId = getDeviceId();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Device-Id": deviceId,
    ...(options.headers as Record<string, string>),
  };

  if (token && !headers["Authorization"]) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const url = endpoint.startsWith("http") ? endpoint : `${API_BASE_URL}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch (err: any) {
    const error: any = new Error(err?.message || "Network request failed");
    error.isOffline = typeof navigator !== "undefined" && !navigator.onLine;
    error.status = 0;
    throw error;
  }

  if (!response.ok) {
    const isAuthFailure = response.status === 401 || response.status === 403;
    const isAuthEndpoint = endpoint.includes("/auth/");
    const storedRefreshToken = getStoredItem("system_refresh_token");

    if (isAuthFailure && retry && !isAuthEndpoint && storedRefreshToken) {
      try {
        const refreshedToken = await refreshAccessToken();
        headers["Authorization"] = `Bearer ${refreshedToken}`;

        // Retry request with updated auth header and retry set to false
        return await request<T>(endpoint, { ...options, headers }, false);
      } catch (err) {
        throw err;
      }
    }

    let errMessage = `HTTP error ${response.status}`;
    let errData: any = null;
    try {
      errData = await response.json();
      errMessage = errData.message || errMessage;
    } catch {}
    const error: any = new Error(errMessage);
    error.response = {
      status: response.status,
      data: errData,
    };
    throw error;
  }

  if (response.status === 204) {
    return {} as T;
  }

  // Safely parse JSON — some endpoints return 200 with empty body
  const text = await response.text();
  if (!text || !text.trim()) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return {} as T;
  }
}

function formatPaginated<T>(res: any) {
  const content = res.content || (Array.isArray(res) ? res : res.data || []);
  const page = res.page !== undefined ? res.page : 0;
  const size = res.size !== undefined ? res.size : content.length;
  const total = res.paginationMetaData?.activeCount || res.paginationMetaData?.totalCount || content.length;

  return {
    data: {
      data: content,
      pagination: {
        page: page + 1,
        limit: size,
        total,
        hasNext: content.length >= size && (page + 1) * size < total,
      },
    },
  };
}

export interface AlgoliaConfig {
  appId: string;
  indexName: string;
  apiKey: string;
}

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

async function searchDirectAlgolia(query: string): Promise<UnifiedSearchResult | null> {
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
    } else if (type === "playlist") {
      playlists.push({
        id,
        name: hit.name || "",
        totalSongs: hit.totalSongs || 0,
        coverImageKey: hit.coverImageKey || "",
      });
    }
  }

  return { songs, artists, playlists, userPlaylists };
}

export const musicApi = {
  songs: {
    getFeed: async (page = 1, size = 15) => {
      const res = await request(`/api/songs?page=${page - 1}&size=${size}`);
      return formatPaginated<Song>(res);
    },
    getById: async (id: string) => {
      const data = await request<Song>(`/api/songs/${id}`);
      return { data };
    },
    getFeatured: async () => {
      const res = await request<Song[]>(`/api/songs/featured`);
      const list = Array.isArray(res) ? res : [];
      return list;
    },
  },
  artists: {
    list: async (page = 1, size = 15) => {
      const res = await request(`/api/artists?page=${page - 1}&size=${size}`);
      return formatPaginated<Artist>(res);
    },
    getById: async (id: string) => {
      const data = await request<Artist>(`/api/artists/${id}`);
      return { data };
    },
    getSongs: async (id: string, page = 1, size = 20) => {
      const res = await request(`/api/artists/${id}/songs?page=${page - 1}&size=${size}`);
      return formatPaginated<Song>(res);
    },
    follow: async (idOrName: string) => {
      const data = await request<ArtistFollowStatus>(`/api/artists/${encodeURIComponent(idOrName)}/follow`, {
        method: "POST",
      });
      return { data };
    },
    unfollow: async (idOrName: string) => {
      const data = await request<ArtistFollowStatus>(`/api/artists/${encodeURIComponent(idOrName)}/unfollow`, {
        method: "POST",
      });
      return { data };
    },
    getFollowStatus: async (idOrName: string) => {
      const data = await request<ArtistFollowStatus>(`/api/artists/${encodeURIComponent(idOrName)}/follow-status`);
      return { data };
    },
    getOnboardingList: async () => {
      const res = await request<Artist[]>("/api/artists/onboarding-list");
      return { data: res || [] };
    },
    search: async (query: string) => {
      const res = await request<Artist[]>(`/api/artists/search?q=${encodeURIComponent(query)}`);
      return { data: res || [] };
    },
    completeOnboarding: async (artistIds: string[]) => {
      const data = await request<{ success: boolean; followedCount: number; message: string }>("/api/artists/onboarding", {
        method: "POST",
        body: JSON.stringify({ artistIds }),
      });
      return { data };
    },
  },
  playlists: {
    list: async (page = 1, size = 15) => {
      const res = await request(`/api/playlists?page=${page - 1}&size=${size}`);
      return formatPaginated<Playlist>(res);
    },
    getById: async (id: string) => {
      const data = await request<Playlist>(`/api/playlists/${id}`);
      return { data };
    },
    getSongs: async (id: string, page = 1, size = 20) => {
      const res = await request(`/api/playlists/${id}/songs?page=${page - 1}&size=${size}`);
      return formatPaginated<Song>(res);
    },
  },
  albums: {
    list: async () => {
      const res = await request<Album[]>(`/api/songs/albums`);
      return Array.isArray(res) ? res : [];
    },
    getByName: async (name: string) => {
      const res = await request<Song[]>(`/api/songs/album/${encodeURIComponent(name)}`);
      return Array.isArray(res) ? res : [];
    },
  },
  users: {
    getPlaylists: async () => {
      const res = await request("/api/user/playlists");
      const list = res.content || (Array.isArray(res) ? res : []);
      return { data: { data: list } };
    },
    createPlaylist: async (name: string, privacy: PlaylistPrivacy = "PRIVATE") => {
      const data = await request<UserPlaylist>("/api/user/playlists", {
        method: "POST",
        body: JSON.stringify({ name, privacy }),
      });
      return { data };
    },
    updatePrivacy: async (id: string, privacy: PlaylistPrivacy) => {
      const data = await request<UserPlaylist>(`/api/user/playlists/${id}/privacy`, {
        method: "PATCH",
        body: JSON.stringify({ privacy }),
      });
      return { data };
    },
    getPlaylistById: async (id: string) => {
      const data = await request<UserPlaylist>(`/api/user/playlists/${id}`);
      return { data };
    },
    getSharedPlaylist: async (tokenOrId: string) => {
      const data = await request<UserPlaylist>(`/api/user/playlists/shared/${tokenOrId}`);
      return { data };
    },
    getSharedPlaylistSongs: async (tokenOrId: string, page = 1, size = 50) => {
      const res = await request(`/api/user/playlists/shared/${tokenOrId}/songs?page=${page - 1}&size=${size}`);
      const list = res.content || (Array.isArray(res) ? res : []);
      return { data: { data: list } };
    },
    getPlaylistSongs: async (id: string) => {
      const res = await request(`/api/user/playlists/${id}/songs`);
      const list = res.content || (Array.isArray(res) ? res : []);
      return { data: { data: list } };
    },
    savePlaylistToLibrary: async (id: string) => {
      const data = await request<UserPlaylist>(`/api/user/playlists/${id}/save`, {
        method: "POST",
      });
      return { data };
    },
    unsavePlaylistFromLibrary: async (id: string) => {
      await request(`/api/user/playlists/${id}/save`, {
        method: "DELETE",
      });
      return { success: true };
    },
    isPlaylistSaved: async (id: string) => {
      try {
        const data = await request<{ isSaved: boolean }>(`/api/user/playlists/${id}/saved`);
        return Boolean(data?.isSaved);
      } catch {
        return false;
      }
    },
    duplicatePlaylist: async (id: string) => {
      const data = await request<UserPlaylist>(`/api/user/playlists/${id}/duplicate`, {
        method: "POST",
      });
      return { data };
    },
    addSongToPlaylist: async (playlistId: string, songId: string) => {
      const data = await request(`/api/user/playlists/${playlistId}/songs`, {
        method: "POST",
        body: JSON.stringify({ songId }),
      });
      return { data };
    },
    removeSongFromPlaylist: async (playlistId: string, songId: string) => {
      const data = await request(`/api/user/playlists/${playlistId}/songs/${songId}`, {
        method: "DELETE",
      });
      return { data };
    },
    deletePlaylist: async (id: string) => {
      await request(`/api/user/playlists/${id}`, { method: "DELETE" });
      return { success: true };
    },
    getFavourites: async (page = 1, size = 100) => {
      const res = await request(`/api/interaction/favourites?page=${page - 1}&size=${size}`);
      const list = res.content || (Array.isArray(res) ? res : []);
      return { data: { data: list } };
    },
    addFavourite: async (songId: string) => {
      await request(`/api/interaction/favourite/${songId}`, { method: "POST" });
      return { success: true };
    },
    removeFavourite: async (songId: string) => {
      await request(`/api/interaction/favourite/${songId}`, { method: "DELETE" });
      return { success: true };
    },
    getRecentlyPlayed: async () => {
      const res = await request<any[]>("/api/user/history/recent");
      const list = Array.isArray(res) ? res : [];
      return { data: { data: list } };
    },
    getSearchHistory: async (): Promise<{ data: SearchHistoryGroupedResponse }> => {
      try {
        const res = await request<SearchHistoryGroupedResponse>("/api/user/history/search");
        if (res && (res.recent || res.songs || res.artists || res.playlists || res.userPlaylists)) {
          return {
            data: {
              recent: res.recent || [],
              songs: res.songs || [],
              artists: res.artists || [],
              playlists: res.playlists || [],
              userPlaylists: res.userPlaylists || [],
            },
          };
        }
        if (Array.isArray(res)) {
          const list = res as SearchHistoryItem[];
          return {
            data: {
              recent: list,
              songs: list.map((r) => r.song).filter(Boolean) as Song[],
              artists: list.map((r) => r.artist).filter(Boolean) as Artist[],
              playlists: list.map((r) => r.playlist).filter(Boolean) as Playlist[],
              userPlaylists: list.map((r) => r.userPlaylist).filter(Boolean) as UserPlaylist[],
            },
          };
        }
        return {
          data: {
            recent: [],
            songs: [],
            artists: [],
            playlists: [],
            userPlaylists: [],
          },
        };
      } catch {
        return {
          data: {
            recent: [],
            songs: [],
            artists: [],
            playlists: [],
            userPlaylists: [],
          },
        };
      }
    },
    saveSearchHistory: async (payload: SaveSearchHistoryPayload) => {
      try {
        await request("/api/user/history/search", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        return { success: true };
      } catch {
        return { success: false };
      }
    },
    deleteSearchHistoryItem: async (id: string) => {
      try {
        await request(`/api/user/history/search/${id}`, {
          method: "DELETE",
        });
        return { success: true };
      } catch {
        return { success: false };
      }
    },
    clearSearchHistory: async () => {
      try {
        await request("/api/user/history/search", {
          method: "DELETE",
        });
        return { success: true };
      } catch {
        return { success: false };
      }
    },
  },
  interactions: {
    getTrending: async (limit = 10) => {
      const res = await request<Song[]>(`/api/songs/trending?limit=${limit}`);
      const list = Array.isArray(res) ? res : [];
      return { data: { data: list } };
    },
    getRecommendations: async () => {
      try {
        const res = await request("/api/recommendations/user");
        const list = Array.isArray(res) ? res : [];
        return { data: { data: list } };
      } catch {
        const res = await request("/api/songs?page=0&size=10");
        const list = res.content || (Array.isArray(res) ? res : []);
        return { data: { data: list } };
      }
    },
    getSimilarSongs: async (songId: string, count = 10) => {
      try {
        const res = await request<Song[]>(`/api/recommendations/similar/${songId}?count=${count}`);
        const list = Array.isArray(res) ? res : [];
        return { data: { data: list } };
      } catch {
        return { data: { data: [] } };
      }
    },
    getRadioSongs: async (seedSongId: string, excludeIds: string[] = [], count = 10) => {
      try {
        const excludeParam =
          excludeIds.length > 0
            ? `&excludeIds=${encodeURIComponent(excludeIds.join(","))}`
            : "";
        const res = await request<Song[]>(
          `/api/recommendations/radio?seedSongId=${encodeURIComponent(seedSongId)}&count=${count}${excludeParam}`
        );
        const list = Array.isArray(res) ? res : [];
        return { data: { data: list } };
      } catch (err) {
        console.warn("[API] getRadioSongs failed, falling back to getSimilarSongs", err);
        return musicApi.interactions.getSimilarSongs(seedSongId, count);
      }
    },
    recordListen: async (songId: string, percentage = 0.05) => {
      if (!songId) return;
      try {
        const safePercentage = Math.min(1.0, Math.max(0.0, isNaN(percentage) ? 0.05 : percentage));
        await request("/api/interaction/play", {
          method: "POST",
          body: JSON.stringify({ songId, percentage: safePercentage }),
          keepalive: true,
        });
      } catch (err) {
        console.warn("[Interaction] recordListen failed:", err);
      }
    },
    recordSkip: async (songId: string) => {
      try {
        await request("/api/interaction/skip", {
          method: "POST",
          body: JSON.stringify({ songId }),
          keepalive: true,
        });
      } catch (err) {
        // Silently catch background telemetry drops
      }
    },
    recordSearchPlay: async (songId: string, query?: string) => {
      try {
        await request("/api/interaction/search-play", {
          method: "POST",
          body: JSON.stringify({ songId, query: query || undefined }),
          keepalive: true,
        });
      } catch {
        // Silently catch background telemetry drops
      }
    },
    recordSearchClick: async (
      type: "SONG" | "ARTIST" | "PLAYLIST",
      id: string,
      query?: string,
    ) => {
      try {
        await request("/api/interaction/search-click", {
          method: "POST",
          body: JSON.stringify({ type, id, query: query || undefined }),
          keepalive: true,
        });
      } catch {
        // Silently catch background telemetry drops
      }
    },
    recordQueueAdd: async (songId: string) => {
      try {
        await request("/api/interaction/queue-add", {
          method: "POST",
          body: JSON.stringify({ songId }),
          keepalive: true,
        });
      } catch {
        // Silently catch background telemetry drops
      }
    },
    recordQueueRemove: async (songId: string) => {
      try {
        await request("/api/interaction/queue-remove", {
          method: "POST",
          body: JSON.stringify({ songId }),
          keepalive: true,
        });
      } catch {
        // Silently catch background telemetry drops
      }
    },
    recordDislike: async (songId: string) => {
      try {
        await request("/api/interaction/dislike", {
          method: "POST",
          body: JSON.stringify({ songId }),
          keepalive: true,
        });
      } catch {
        // Silently catch background telemetry drops
      }
    },
    recordShare: async (songId: string) => {
      try {
        await request("/api/interaction/share", {
          method: "POST",
          body: JSON.stringify({ songId }),
          keepalive: true,
        });
      } catch {
        // Silently catch background telemetry drops
      }
    },
  },
  search: {
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
  },
  auth: {
    login: async (email: string) => {
      const data = await request("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password: "password" }),
      });
      return { data: { token: data.tempToken } };
    },
    register: async (name: string, email: string) => {
      const data = await request("/auth/register", {
        method: "POST",
        body: JSON.stringify({ userName: name, email, password: "password" }),
      });
      return { data: { token: data.tempToken } };
    },
    resendOtp: async (token: string) => {
      await request("/auth/resend-otp", {
        method: "POST",
        headers: { "X-TEMP-TOKEN": token },
      });
      return { data: { token } };
    },
    verifyOtp: async (token: string, code: string) => {
      const deviceId = getDeviceId();
      const verifyRes = await request("/auth/verify-otp", {
        method: "POST",
        headers: { "X-TEMP-TOKEN": token, "X-Device-Id": deviceId },
        body: JSON.stringify({ otp: code, deviceId }),
      });
      
      const { accessToken, refreshToken } = verifyRes;

      if (accessToken && refreshToken) {
        saveSessionTokens(accessToken, refreshToken);
      } else if (accessToken && typeof window !== "undefined") {
        localStorage.setItem("system_token", accessToken);
      }

      const profile = await request("/api/user/profile");

      return {
        data: {
          accessToken,
          refreshToken,
          isNewUser: Boolean(verifyRes?.isNewUser),
          user: {
            ...profile,
            name: profile.userName || "User",
          },
        },
      };
    },
    logout: async () => {
      try {
        const deviceId = getDeviceId();
        const refreshToken = getStoredItem("system_refresh_token");
        await request("/auth/logout", {
          method: "POST",
          body: JSON.stringify({ deviceId, refreshToken }),
        });
      } catch {
        // Silently handle logout failure on network error
      } finally {
        clearSessionStorage();
      }
    },
  },
};
