import { formatPaginated, request } from "./client";
import type { Artist, ArtistFollowStatus, Song } from "./types";

export const artistsApi = {
  list: async (page = 1, size = 15) => {
    const res = await request(`/api/artists?page=${page - 1}&size=${size}`);
    return formatPaginated<Artist>(res);
  },
  getById: async (id: string) => {
    const data = await request<Artist>(`/api/artists/${id}`);
    return { data };
  },
  getSongs: async (id: string, page = 1, size = 20) => {
    const res = await request(`/api/artists/${id}/songs?page=${page - 1}&size=${size}`);
    return formatPaginated<Song>(res);
  },
  follow: async (idOrName: string) => {
    const data = await request<ArtistFollowStatus>(`/api/artists/${encodeURIComponent(idOrName)}/follow`, {
      method: "POST",
    });
    return { data };
  },
  unfollow: async (idOrName: string) => {
    const data = await request<ArtistFollowStatus>(`/api/artists/${encodeURIComponent(idOrName)}/unfollow`, {
      method: "POST",
    });
    return { data };
  },
  getFollowStatus: async (idOrName: string) => {
    const data = await request<ArtistFollowStatus>(`/api/artists/${encodeURIComponent(idOrName)}/follow-status`);
    return { data };
  },
  getOnboardingList: async () => {
    const res = await request<Artist[]>("/api/artists/onboarding-list");
    return { data: res || [] };
  },
  search: async (query: string) => {
    const res = await request<Artist[]>(`/api/artists/search?q=${encodeURIComponent(query)}`);
    return { data: res || [] };
  },
  completeOnboarding: async (artistIds: string[]) => {
    const data = await request<{ success: boolean; followedCount: number; message: string }>("/api/artists/onboarding", {
      method: "POST",
      body: JSON.stringify({ artistIds }),
    });
    return { data };
  },
};
