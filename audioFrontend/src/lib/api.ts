const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:9090";

export interface Song {
  id: string;
  title: string;
  artistName: string;
  duration: number;
  songKey: string;
  imageKey: string;
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
  bannerImageKey?: string;
  status?: string;
  createdAt?: string;
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  coverImageKey?: string;
  bannerImageKey?: string;
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

async function request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("system_token") : null;
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

  return response.json();
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
    getHistory: async () => {
      const res = await request("/api/user/history");
      const list = res.content || (Array.isArray(res) ? res : []);
      return { data: { data: list } };
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
    getSearchHistory: async (page = 1, size = 10) => {
      const res = await request("/api/user/history/search");
      const list = Array.isArray(res) ? res : [];
      return { data: { data: list } };
    },
    saveSearchHistory: async (queryText: string) => {
      return { success: true };
    },
    clearSearchHistory: async () => {
      return { success: true };
    },
  },
  interactions: {
    getTrending: async (page = 1, size = 10) => {
      const res = await request(`/api/songs?page=${page - 1}&size=${size}`);
      return formatPaginated<Song>(res);
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
      return { data };
    },
    register: async (name: string, email: string) => {
      const data = await request("/auth/register", {
        method: "POST",
        body: JSON.stringify({ userName: name, email, password: "password" }),
      });
      return { data };
    },
    resendOtp: async (token: string) => {
      return { data: { token: token || "session-token" } };
    },
    verifyOtp: async (token: string, code: string) => {
      return {
        data: {
          accessToken: token || "mock-access-token",
          refreshToken: "mock-refresh-token",
          user: { id: "user1", email: "user@example.com", name: "User" },
        },
      };
    },
  },
};
