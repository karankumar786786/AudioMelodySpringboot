import { formatPaginated, request } from "./client";
import type { Song } from "./types";

export const songsApi = {
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
};
