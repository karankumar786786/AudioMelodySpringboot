import { api } from "./baseApi";
import { Song, PaginatedResponse } from "@/types";

export interface GetCanvasFeedParams {
  page?: number;
  size?: number;
  genre?: string;
  sort?: "latest" | "popular" | "random" | "discover" | "shuffle";
  seed?: number | string;
}

export interface ShortsLikeStatus {
  songId: number;
  isLiked: boolean;
  count: number;
}

export const canvasService = {
  async getFeed(params: GetCanvasFeedParams = {}): Promise<PaginatedResponse<Song>> {
    const { page = 0, size = 10, genre, sort = "random", seed } = params;
    const queryParams: Record<string, any> = { page, size, sort };
    if (genre && genre !== "All") queryParams.genre = genre;
    if (seed !== undefined) queryParams._t = seed;

    console.log(`[canvasService] 📡 GET /canvas/feed params:`, JSON.stringify(queryParams));
    try {
      const response = await api.get<PaginatedResponse<Song>>("/canvas/feed", {
        params: queryParams,
      });
      const items = response.data?.content || [];
      console.log(
        `[canvasService] ✅ /canvas/feed OK: received ${items.length} items (totalCount: ${response.data?.paginationMetaData?.totalCount ?? "unknown"})`
      );
      if (items.length > 0) {
        console.log(
          `[canvasService] 🎵 First song: id=${items[0].id}, title="${items[0].title}", videoKey="${items[0].videoKey}"`
        );
      }
      return response.data;
    } catch (err: any) {
      console.error(
        `[canvasService] ❌ /canvas/feed FAILED: status=${err?.response?.status}, msg=${err?.response?.data?.message || err?.message}`
      );
      throw err;
    }
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

  async getLikedShortSongs(page = 0, size = 20): Promise<PaginatedResponse<Song>> {
    const response = await api.get<PaginatedResponse<Song>>("/canvas/liked/songs", {
      params: { page, size },
    });
    return response.data;
  },
};

