import { request } from "./client";
import type { Album, Song } from "./types";

export const albumsApi = {
  list: async () => {
    const res = await request<Album[]>(`/api/songs/albums`);
    return Array.isArray(res) ? res : [];
  },
  getByName: async (name: string) => {
    const res = await request<Song[]>(`/api/songs/album/${encodeURIComponent(name)}`);
    return Array.isArray(res) ? res : [];
  },
};
