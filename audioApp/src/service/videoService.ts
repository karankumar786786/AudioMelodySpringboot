import { api } from "./baseApi";
import { Song, PaginatedResponse } from "@/types";

export interface GetVideosParams {
  page?: number;
  size?: number;
  genre?: string;
  language?: string;
  sort?: "latest" | "popular" | "trending";
}

export interface GetTrendingVideosParams {
  limit?: number;
  window?: string;
  genre?: string;
  language?: string;
}

export interface VideoService {
  getVideos(params?: GetVideosParams): Promise<PaginatedResponse<Song>>;
  getTrendingVideos(params?: GetTrendingVideosParams): Promise<Song[]>;
  getPopularVideos(limit?: number, genre?: string, language?: string): Promise<Song[]>;
  getRelatedVideos(songId: string, limit?: number): Promise<Song[]>;
  getVideosByArtist(artistName: string, page?: number, size?: number): Promise<PaginatedResponse<Song>>;
}

export const videoService: VideoService = {
  async getVideos(params: GetVideosParams = {}): Promise<PaginatedResponse<Song>> {
    const { page = 0, size = 15, genre, language, sort = "latest" } = params;
    const queryParams: Record<string, any> = { page, size, sort };
    if (genre && genre !== "All") queryParams.genre = genre;
    if (language && language !== "All") queryParams.language = language;

    const response = await api.get<PaginatedResponse<Song>>("/videos", {
      params: queryParams,
    });
    return response.data;
  },

  async getTrendingVideos(params: GetTrendingVideosParams = {}): Promise<Song[]> {
    try {
      const { limit = 15, window = "7d", genre, language } = params;
      const queryParams: Record<string, any> = { limit, window };
      if (genre && genre !== "All") queryParams.genre = genre;
      if (language && language !== "All") queryParams.language = language;

      const response = await api.get<Song[]>("/videos/trending", {
        params: queryParams,
      });
      return Array.isArray(response.data) ? response.data : [];
    } catch (e) {
      console.warn("[videoService] getTrendingVideos error:", e);
      return [];
    }
  },

  async getPopularVideos(limit = 15, genre?: string, language?: string): Promise<Song[]> {
    try {
      const queryParams: Record<string, any> = { limit };
      if (genre && genre !== "All") queryParams.genre = genre;
      if (language && language !== "All") queryParams.language = language;

      const response = await api.get<Song[]>("/videos/popular", {
        params: queryParams,
      });
      return Array.isArray(response.data) ? response.data : [];
    } catch (e) {
      console.warn("[videoService] getPopularVideos error:", e);
      return [];
    }
  },

  async getRelatedVideos(songId: string, limit = 10): Promise<Song[]> {
    if (!songId) return [];
    try {
      const response = await api.get<Song[]>(`/videos/${encodeURIComponent(songId)}/related`, {
        params: { limit },
      });
      return Array.isArray(response.data) ? response.data : [];
    } catch (e) {
      console.warn(`[videoService] getRelatedVideos error for song ${songId}:`, e);
      return [];
    }
  },

  async getVideosByArtist(artistName: string, page = 0, size = 15): Promise<PaginatedResponse<Song>> {
    const response = await api.get<PaginatedResponse<Song>>(
      `/videos/artist/${encodeURIComponent(artistName)}`,
      { params: { page, size } }
    );
    return response.data;
  },
};
