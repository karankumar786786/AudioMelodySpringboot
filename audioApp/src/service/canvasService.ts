import { api } from "./baseApi";
import { Song, PaginatedResponse } from "@/types";

export interface GetCanvasFeedParams {
  page?: number;
  size?: number;
  genre?: string;
  sort?: "latest" | "popular";
}

export const canvasService = {
  async getFeed(params: GetCanvasFeedParams = {}): Promise<PaginatedResponse<Song>> {
    const { page = 0, size = 10, genre, sort = "latest" } = params;
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
};
