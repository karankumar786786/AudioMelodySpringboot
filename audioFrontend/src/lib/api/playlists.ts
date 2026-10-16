import { formatPaginated, request } from "./client";
import type { Playlist, Song } from "./types";

export const playlistsApi = {
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
};
