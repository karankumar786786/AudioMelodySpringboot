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
  language: string;
  lrclibId: string;
  status?: string;
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

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  coverImageKey?: string;
  videoKey?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface User {
  id: string;
  name?: string;
  email: string;
  role?: string;
}

function getStoredItem(key: string) {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(key);
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

      const url = `${API_BASE_URL}/auth/refresh-token`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        clearSessionStorage();
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
  const token = getStoredItem("system_token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token && !headers["Authorization"]) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const url = endpoint.startsWith("http") ? endpoint : `${API_BASE_URL}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const isAuthFailure = response.status === 401 || response.status === 403;
    const isAuthEndpoint = endpoint.includes("/auth/");

    if (isAuthFailure && retry && !isAuthEndpoint) {
      try {
        const refreshedToken = await refreshAccessToken();
        headers["Authorization"] = `Bearer ${refreshedToken}`;

        // Retry request with updated auth header and retry set to false
        return await request<T>(endpoint, { ...options, headers }, false);
      } catch (err) {
        clearSessionStorage();

        // If public endpoint (like /api/songs, /api/artists, /api/playlists), retry without Authorization header
        if (endpoint.startsWith("/api/songs") || endpoint.startsWith("/api/artists") || endpoint.startsWith("/api/playlists")) {
          delete headers["Authorization"];
          const publicRetryRes = await fetch(url, { ...options, headers });
          if (publicRetryRes.ok) {
            if (publicRetryRes.status === 204) return {} as T;
            return publicRetryRes.json();
          }
        }
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
  users: {
    getPlaylists: async () => {
      const res = await request("/api/user/playlists");
      const list = res.content || (Array.isArray(res) ? res : []);
      return { data: { data: list } };
    },
    createPlaylist: async (name: string) => {
      const data = await request("/api/user/playlists", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      return { data };
    },
    getPlaylistById: async (id: string) => {
      const data = await request(`/api/user/playlists/${id}`);
      return { data };
    },
    getPlaylistSongs: async (id: string) => {
      const res = await request(`/api/user/playlists/${id}/songs`);
      const list = res.content || (Array.isArray(res) ? res : []);
      return { data: { data: list } };
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
    getSearchHistory: async (page = 1, size = 10) => {
      const res = await request("/api/user/history/search");
      const list = Array.isArray(res) ? res : [];
      return { data: { data: list } };
    },
    saveSearchHistory: async (searchText: string) => {
      if (!searchText || !searchText.trim()) return { success: true };
      await request("/api/user/history/search", {
        method: "POST",
        body: JSON.stringify({ searchText: searchText.trim() }),
      });
      return { success: true };
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
    recordListen: async (songId: string, percentage: number) => {
      await request("/api/interaction/play", {
        method: "POST",
        body: JSON.stringify({ songId, percentage }),
      });
    },
    recordSkip: async (songId: string) => {
      try {
        await request("/api/interaction/skip", {
          method: "POST",
          body: JSON.stringify({ songId }),
        });
      } catch (err) {
        console.error("[Api] Failed to record skip:", err);
      }
    },
  },
  search: {
    unified: async (query: string) => {
      if (!query || !query.trim()) {
        return { data: { songs: [], artists: [], playlists: [] } };
      }
      try {
        const data = await request(`/api/search?q=${encodeURIComponent(query)}`);
        return { data };
      } catch {
        return { data: { songs: [], artists: [], playlists: [] } };
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
      const verifyRes = await request("/auth/verify-otp", {
        method: "POST",
        headers: { "X-TEMP-TOKEN": token },
        body: JSON.stringify({ otp: code }),
      });
      
      const { accessToken, refreshToken } = verifyRes;

      if (typeof window !== "undefined") {
        localStorage.setItem("system_token", accessToken);
      }

      const profile = await request("/api/user/profile");

      return {
        data: {
          accessToken,
          refreshToken,
          user: {
            ...profile,
            name: profile.userName || "User",
          },
        },
      };
    },
  },
};
