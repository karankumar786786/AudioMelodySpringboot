import { formatPaginated, request } from "./client";
import type { Song } from "./types";

export interface GetCanvasFeedParams {
  page?: number;
  size?: number;
  genre?: string;
  sort?: "latest" | "popular" | "random" | "discover" | "shuffle";
}

export interface ShortsLikeStatus {
  songId: number;
  isLiked: boolean;
  count: number;
}

export const canvasApi = {
  getFeed: async (params: GetCanvasFeedParams = {}) => {
    const { page = 1, size = 10, genre, sort = "random" } = params;
    const searchParams = new URLSearchParams();
    searchParams.set("page", String(page - 1));
    searchParams.set("size", String(size));
    searchParams.set("sort", sort);
    if (genre && genre !== "All") searchParams.set("genre", genre);

    const res = await request(`/api/canvas/feed?${searchParams.toString()}`);
    return formatPaginated<Song>(res);
  },

  getFeatured: async (limit = 10): Promise<Song[]> => {
    try {
      const res = await request<Song[]>(`/api/canvas/featured?limit=${limit}`);
      return Array.isArray(res) ? res : [];
    } catch {
      return [];
    }
  },

  toggleLike: async (songId: number | string): Promise<ShortsLikeStatus> => {
    return request<ShortsLikeStatus>(`/api/canvas/${songId}/like`, {
      method: "POST",
    });
  },

  getLikeStatus: async (songId: number | string): Promise<ShortsLikeStatus> => {
    return request<ShortsLikeStatus>(`/api/canvas/${songId}/like`);
  },

  getLikedShorts: async (): Promise<string[]> => {
    try {
      const res = await request<any>("/api/canvas/liked");
      if (Array.isArray(res)) {
        return res.map(String);
      }
      if (Array.isArray(res?.content)) {
        return res.content.map(String);
      }
      return [];
    } catch {
      return [];
    }
  },

  getLikedShortSongs: async (page = 1, size = 20) => {
    const searchParams = new URLSearchParams();
    searchParams.set("page", String(page - 1));
    searchParams.set("size", String(size));
    const res = await request(`/api/canvas/liked/songs?${searchParams.toString()}`);
    return formatPaginated<Song>(res);
  },
};

