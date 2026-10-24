import { useQuery } from "@tanstack/react-query";
import { musicApi } from "@/lib/api";
import type { Song } from "@/lib/api/types";
import { queryKeys } from "./queryKeys";

export function useTrendingSongs(limit = 10) {
  return useQuery({
    queryKey: queryKeys.songs.trending(limit),
    queryFn: async () => {
      const res = await musicApi.interactions.getTrending(limit);
      return res.data?.data || [];
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
}

export function useFeaturedSongs() {
  return useQuery({
    queryKey: queryKeys.songs.featured(),
    queryFn: async () => {
      const res = await musicApi.songs.getFeatured();
      return res || [];
    },
    staleTime: 1000 * 60 * 15,
  });
}

export function useSong(id?: string) {
  return useQuery({
    queryKey: queryKeys.songs.detail(id || ""),
    queryFn: async () => {
      if (!id) return null;
      const res = await musicApi.songs.getById(id);
      return (res.data as Song) || null;
    },
    enabled: Boolean(id),
    staleTime: 1000 * 60 * 30, // 30 minutes
  });
}

export function useAlbumSongs(albumName?: string) {
  return useQuery({
    queryKey: queryKeys.songs.album(albumName || ""),
    queryFn: async () => {
      if (!albumName) return [];
      const res = await musicApi.albums.getByName(albumName);
      return res || [];
    },
    enabled: Boolean(albumName),
    staleTime: 1000 * 60 * 15,
  });
}

export function useAlbums() {
  return useQuery({
    queryKey: queryKeys.songs.albums(),
    queryFn: async () => {
      const res = await musicApi.albums.list();
      return res || [];
    },
    staleTime: 1000 * 60 * 20,
  });
}
