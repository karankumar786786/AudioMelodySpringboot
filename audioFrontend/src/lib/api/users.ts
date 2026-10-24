import { formatPaginated, getDeviceId, request } from "./client";
import type {
  Artist,
  Playlist,
  PlaylistPrivacy,
  SaveSearchHistoryPayload,
  SearchHistoryGroupedResponse,
  SearchHistoryItem,
  SessionStatus,
  Song,
  User,
  UserPlaylist,
  UserSession,
} from "./types";

export const usersApi = {
  getPlaylists: async () => {
    const res = await request("/api/user/playlists");
    const list = res.content || (Array.isArray(res) ? res : []);
    return { data: { data: list as UserPlaylist[] } };
  },
  createPlaylist: async (
    name: string,
    privacy: PlaylistPrivacy = "PRIVATE",
  ) => {
    const data = await request<UserPlaylist>("/api/user/playlists", {
      method: "POST",
      body: JSON.stringify({ name, privacy }),
    });
    return { data };
  },
  renamePlaylist: async (id: string, name: string) => {
    const data = await request<UserPlaylist>(`/api/user/playlists/${id}`, {
      method: "PUT",
      body: JSON.stringify({ name }),
    });
    return { data };
  },
  updatePrivacy: async (id: string, privacy: PlaylistPrivacy) => {
    const data = await request<UserPlaylist>(
      `/api/user/playlists/${id}/privacy`,
      {
        method: "PATCH",
        body: JSON.stringify({ privacy }),
      },
    );
    return { data };
  },
  getPlaylistById: async (id: string) => {
    const data = await request<UserPlaylist>(`/api/user/playlists/${id}`);
    return { data };
  },
  getSharedPlaylist: async (tokenOrId: string) => {
    const data = await request<UserPlaylist>(
      `/api/user/playlists/shared/${tokenOrId}`,
    );
    return { data };
  },
  getSharedPlaylistSongs: async (tokenOrId: string, page = 1, size = 50) => {
    const res = await request(
      `/api/user/playlists/shared/${tokenOrId}/songs?page=${page - 1}&size=${size}`,
    );
    const list = res.content || (Array.isArray(res) ? res : []);
    return { data: { data: list as Song[] } };
  },
  getPlaylistSongs: async (id: string) => {
    const res = await request(`/api/user/playlists/${id}/songs`);
    const list = res.content || (Array.isArray(res) ? res : []);
    return { data: { data: list as Song[] } };
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
      const data = await request<{ isSaved: boolean }>(
        `/api/user/playlists/${id}/saved`,
      );
      return Boolean(data?.isSaved);
    } catch {
      return false;
    }
  },
  duplicatePlaylist: async (id: string) => {
    const data = await request<UserPlaylist>(
      `/api/user/playlists/${id}/duplicate`,
      {
        method: "POST",
      },
    );
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
    const data = await request(
      `/api/user/playlists/${playlistId}/songs/${songId}`,
      {
        method: "DELETE",
      },
    );
    return { data };
  },
  deletePlaylist: async (id: string) => {
    await request(`/api/user/playlists/${id}`, { method: "DELETE" });
    return { success: true };
  },
  getFavourites: async (page = 1, size = 100) => {
    const res = await request(
      `/api/interaction/favourites?page=${page - 1}&size=${size}`,
    );
    const list = res.content || (Array.isArray(res) ? res : []);
    return { data: { data: list as Song[] } };
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
  getSearchHistory: async (): Promise<{
    data: SearchHistoryGroupedResponse;
  }> => {
    try {
      const res = await request<SearchHistoryGroupedResponse>(
        "/api/user/history/search",
      );
      if (
        res &&
        (res.recent ||
          res.songs ||
          res.artists ||
          res.playlists ||
          res.userPlaylists)
      ) {
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
            playlists: list
              .map((r) => r.playlist)
              .filter(Boolean) as Playlist[],
            userPlaylists: list
              .map((r) => r.userPlaylist)
              .filter(Boolean) as UserPlaylist[],
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
  updateProfile: async (userName: string) => {
    const data = await request<User>("/api/user/profile", {
      method: "PUT",
      body: JSON.stringify({ userName }),
    });
    return { data };
  },
  getListeningHistory: async (page = 1, size = 20) => {
    const res = await request(
      `/api/user/history?page=${page - 1}&size=${size}`,
    );
    return formatPaginated<any>(res);
  },
  getSessionStatus: async () => {
    return await request<SessionStatus>("/api/user/sessions/status");
  },
  getSessions: async () => {
    const deviceId = getDeviceId();
    const res = await request<UserSession[]>(
      `/api/user/sessions?deviceId=${encodeURIComponent(deviceId)}`,
    );
    return Array.isArray(res) ? res : [];
  },
  revokeSession: async (sessionId: string) => {
    await request(`/api/user/sessions/${sessionId}`, { method: "DELETE" });
    return { success: true };
  },
  revokeOtherSessions: async () => {
    const deviceId = getDeviceId();
    await request("/api/user/sessions/revoke-others", {
      method: "POST",
      body: JSON.stringify({ deviceId }),
    });
    return { success: true, message: "Other sessions revoked successfully" };
  },
  logoutSession: async (allDevices = false) => {
    const deviceId = getDeviceId();
    await request("/api/user/sessions/logout", {
      method: "POST",
      body: JSON.stringify({ deviceId, allDevices }),
    });
    return { success: true };
  },
};
