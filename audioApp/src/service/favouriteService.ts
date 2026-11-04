import { api } from "./baseApi";
import { Song, PaginatedResponse } from "@/types";

export interface FavouriteService {
  getFavourites(page?: number, size?: number): Promise<PaginatedResponse<Song>>;
  addFavourite(songId: string): Promise<void>;
  removeFavourite(songId: string): Promise<void>;
  toggleFavourite(songId: string, currentLiked?: boolean): Promise<void>;
}

export const favouriteService: FavouriteService = {
  async getFavourites(page = 0, size = 20): Promise<PaginatedResponse<Song>> {
    const response = await api.get<PaginatedResponse<Song>>(
      `/interaction/favourites?page=${page}&size=${size}`
    );
    return response.data;
  },

  async addFavourite(songId: string): Promise<void> {
    await api.post(`/interaction/favourite/${songId}`);
  },

  async removeFavourite(songId: string): Promise<void> {
    await api.delete(`/interaction/favourite/${songId}`);
  },

  async toggleFavourite(songId: string, currentLiked?: boolean): Promise<void> {
    if (currentLiked) {
      await api.delete(`/interaction/favourite/${songId}`);
    } else {
      await api.post(`/interaction/favourite/${songId}`);
    }
  },
};
