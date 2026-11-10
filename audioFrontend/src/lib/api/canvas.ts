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

  getLikedShorts: async (page = 0, size = 50): Promise<number[]> => {
    try {
      const res = await request<{ content: number[] }>(`/api/canvas/liked?page=${page}&size=${size}`);
      return res?.content || [];
    } catch {
      return [];
    }
  },
};

