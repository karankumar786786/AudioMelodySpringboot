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
    const response = await api.get<any>(
      `/interaction/favourites?page=${page}&size=${size}`
    );
    const data = response.data;
    const content: Song[] =
      data?.content ||
      (Array.isArray(data) ? data : data?.data || []);

    return {
      content,
      page: data?.page ?? page,
      size: data?.size ?? size,
      paginationMetaData: data?.paginationMetaData,
    };
  },

  async addFavourite(songId: string): Promise<void> {
    const sid = String(songId);
    try {
      console.log(`[favouriteService] POST /interaction/favourite/${sid}`);
      await api.post(`/interaction/favourite/${sid}`);
      console.log(`[favouriteService] Successfully added favourite: ${sid}`);
    } catch (err: any) {
      const status = err?.response?.status;
      // 409 Conflict = already in favourites, treat as idempotent success (matches audioFrontend)
      if (status === 409) {
        console.warn(`[favouriteService] Song ${sid} already in favourites (409), ignoring`);
        return;
      }
      console.error(`[favouriteService] Failed to add favourite ${sid}:`, err?.response?.data || err?.message || err);
      throw err;
    }
  },

  async removeFavourite(songId: string): Promise<void> {
    const sid = String(songId);
    try {
      console.log(`[favouriteService] DELETE /interaction/favourite/${sid}`);
      await api.delete(`/interaction/favourite/${sid}`);
      console.log(`[favouriteService] Successfully removed favourite: ${sid}`);
    } catch (err: any) {
      const status = err?.response?.status;
      // 404 Not Found = already removed from favourites, treat as idempotent success (matches audioFrontend)
      if (status === 404) {
        console.warn(`[favouriteService] Song ${sid} already not in favourites (404), ignoring`);
        return;
      }
      console.error(`[favouriteService] Failed to remove favourite ${sid}:`, err?.response?.data || err?.message || err);
      throw err;
    }
  },

  async toggleFavourite(songId: string, currentLiked?: boolean): Promise<void> {
    if (currentLiked) {
      await favouriteService.removeFavourite(songId);
    } else {
      await favouriteService.addFavourite(songId);
    }
  },
};
