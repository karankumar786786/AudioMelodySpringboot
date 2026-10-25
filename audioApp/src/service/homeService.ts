import { api } from "./baseApi";
import { Song, Artist, Playlist, PaginatedResponse } from "@/types";

export interface HomeService {
  getFeaturedSongs(): Promise<Song[]>;
  getTrendingSongs(limit?: number): Promise<Song[]>;
  getTopArtists(page?: number, size?: number): Promise<PaginatedResponse<Artist>>;
  getFeaturedPlaylists(page?: number, size?: number): Promise<PaginatedResponse<Playlist>>;
  getDiscoverFeed(page?: number, size?: number): Promise<PaginatedResponse<Song>>;
  getSongById(id: string): Promise<Song>;
}

export const homeService: HomeService = {
  async getFeaturedSongs(): Promise<Song[]> {
    const response = await api.get<Song[]>("/songs/featured");
    return Array.isArray(response.data) ? response.data : [];
  },

  async getTrendingSongs(limit = 12): Promise<Song[]> {
    const response = await api.get<Song[]>(`/songs/trending?limit=${limit}`);
    return Array.isArray(response.data) ? response.data : [];
  },

  async getTopArtists(page = 0, size = 15): Promise<PaginatedResponse<Artist>> {
    const response = await api.get<PaginatedResponse<Artist>>(
      `/artists?page=${page}&size=${size}`,
    );
    return response.data;
  },

  async getFeaturedPlaylists(
    page = 0,
    size = 15,
  ): Promise<PaginatedResponse<Playlist>> {
    const response = await api.get<PaginatedResponse<Playlist>>(
      `/playlists?page=${page}&size=${size}`,
    );
    return response.data;
  },

  async getDiscoverFeed(
    page = 0,
    size = 15,
  ): Promise<PaginatedResponse<Song>> {
    const response = await api.get<PaginatedResponse<Song>>(
      `/songs?page=${page}&size=${size}`,
    );
    return response.data;
  },

  async getSongById(id: string): Promise<Song> {
    const response = await api.get<Song>(`/songs/${id}`);
    return response.data;
  },
};
