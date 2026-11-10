import { api } from "./baseApi";
import { Song, PaginatedResponse } from "@/types";

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

export const canvasService = {
  async getFeed(params: GetCanvasFeedParams = {}): Promise<PaginatedResponse<Song>> {
    const { page = 0, size = 10, genre, sort = "random" } = params;
    const queryParams: Record<string, any> = { page, size, sort };
    if (genre && genre !== "All") queryParams.genre = genre;

    const response = await api.get<PaginatedResponse<Song>>("/canvas/feed", {
      params: queryParams,
    });
    return response.data;
  },

  async getFeatured(limit = 10): Promise<Song[]> {
    try {
      const response = await api.get<Song[]>("/canvas/featured", {
        params: { limit },
      });
      return Array.isArray(response.data) ? response.data : [];
    } catch (e) {
      console.warn("[canvasService] getFeatured error:", e);
      return [];
    }
  },

  async toggleLike(songId: number | string): Promise<ShortsLikeStatus> {
    const response = await api.post<ShortsLikeStatus>(`/canvas/${songId}/like`);
    return response.data;
  },

  async getLikeStatus(songId: number | string): Promise<ShortsLikeStatus> {
    const response = await api.get<ShortsLikeStatus>(`/canvas/${songId}/like`);
    return response.data;
  },

  async getLikedShorts(): Promise<string[]> {
    try {
      const response = await api.get<any>("/canvas/liked");
      if (Array.isArray(response.data)) {
        return response.data.map(String);
      }
      if (Array.isArray(response.data?.content)) {
        return response.data.content.map(String);
      }
      return [];
    } catch (e) {
      console.warn("[canvasService] getLikedShorts error:", e);
      return [];
    }
  },
};

