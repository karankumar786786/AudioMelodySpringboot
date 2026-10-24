import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { musicApi } from "@/lib/api";
import type { Artist } from "@/lib/api/types";
import { queryKeys } from "./queryKeys";

export function useArtists(page = 1, size = 50) {
  return useQuery({
    queryKey: queryKeys.artists.list(page, size),
    queryFn: async () => {
      const res = await musicApi.artists.list(page, size);
      return (res.data?.data as Artist[]) || [];
    },
    staleTime: 1000 * 60 * 15,
  });
}

export function useArtist(id?: string) {
  return useQuery({
    queryKey: queryKeys.artists.detail(id || ""),
    queryFn: async () => {
      if (!id) return null;
      const res = await musicApi.artists.getById(id);
      return res.data || null;
    },
    enabled: Boolean(id),
    staleTime: 1000 * 60 * 30,
  });
}

export function useArtistSongs(id?: string, page = 1, size = 50) {
  return useQuery({
    queryKey: queryKeys.artists.songs(id || "", page, size),
    queryFn: async () => {
      if (!id) return [];
      const res = await musicApi.artists.getSongs(id, page, size);
      return res.data?.data || [];
    },
    enabled: Boolean(id),
    staleTime: 1000 * 60 * 10,
  });
}

export function useArtistFollowStatus(id?: string) {
  return useQuery({
    queryKey: queryKeys.artists.followStatus(id || ""),
    queryFn: async () => {
      if (!id) return { isFollowing: false };
      const res = await musicApi.artists.getFollowStatus(id);
      return res.data || { isFollowing: false };
    },
    enabled: Boolean(id),
    staleTime: 1000 * 60 * 5,
  });
}

export function useFollowArtistMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (artistId: string) => {
      const res = await musicApi.artists.follow(artistId);
      return res.data;
    },
    onSuccess: (_, artistId) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.artists.followStatus(artistId),
      });
      toast.success("Following artist");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to follow artist");
    },
  });
}

export function useUnfollowArtistMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (artistId: string) => {
      const res = await musicApi.artists.unfollow(artistId);
      return res.data;
    },
    onSuccess: (_, artistId) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.artists.followStatus(artistId),
      });
      toast.success("Unfollowed artist");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to unfollow artist");
    },
  });
}
