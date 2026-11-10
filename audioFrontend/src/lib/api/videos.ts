import { formatPaginated, request } from "./client";
import type { Song } from "./types";

export interface GetVideosParams {
  page?: number;
  size?: number;
  genre?: string;
  language?: string;
  sort?: "latest" | "popular" | "trending";
}

export const videosApi = {
  getVideos: async (params: GetVideosParams = {}) => {
    const { page = 1, size = 15, genre, language, sort = "latest" } = params;
    const searchParams = new URLSearchParams();
    searchParams.set("page", String(page - 1));
    searchParams.set("size", String(size));
    searchParams.set("sort", sort);
    if (genre && genre !== "All") searchParams.set("genre", genre);
    if (language && language !== "All") searchParams.set("language", language);

    const res = await request(`/api/videos?${searchParams.toString()}`);
    return formatPaginated<Song>(res);
  },

  getTrending: async (limit = 15, window = "7d", genre?: string, language?: string) => {
    const searchParams = new URLSearchParams();
    searchParams.set("limit", String(limit));
    searchParams.set("window", window);
    if (genre && genre !== "All") searchParams.set("genre", genre);
    if (language && language !== "All") searchParams.set("language", language);

    const res = await request<Song[]>(`/api/videos/trending?${searchParams.toString()}`);
    return Array.isArray(res) ? res : [];
  },

  getPopular: async (limit = 15, genre?: string, language?: string) => {
    const searchParams = new URLSearchParams();
    searchParams.set("limit", String(limit));
    if (genre && genre !== "All") searchParams.set("genre", genre);
    if (language && language !== "All") searchParams.set("language", language);

    const res = await request<Song[]>(`/api/videos/popular?${searchParams.toString()}`);
    return Array.isArray(res) ? res : [];
  },

  getRelated: async (id: string, limit = 10) => {
    if (!id) return [];
    const res = await request<Song[]>(`/api/videos/${encodeURIComponent(id)}/related?limit=${limit}`);
    return Array.isArray(res) ? res : [];
  },

  getByArtist: async (artistName: string, page = 1, size = 15) => {
    const searchParams = new URLSearchParams();
    searchParams.set("page", String(page - 1));
    searchParams.set("size", String(size));

    const res = await request(`/api/videos/artist/${encodeURIComponent(artistName)}?${searchParams.toString()}`);
    return formatPaginated<Song>(res);
  },
};
