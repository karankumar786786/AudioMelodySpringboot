import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { musicApi } from "@/lib/api";
import type { PlaylistPrivacy, UserPlaylist } from "@/lib/api/types";
import { queryKeys } from "./queryKeys";

export function useCuratedPlaylists(page = 1, size = 30) {
  return useQuery({
    queryKey: queryKeys.playlists.curated(page, size),
    queryFn: async () => {
      const res = await musicApi.playlists.list(page, size);
      return res.data?.data || [];
    },
    staleTime: 1000 * 60 * 15,
  });
}

export function useUserPlaylists() {
  return useQuery({
    queryKey: queryKeys.playlists.userPlaylists(),
    queryFn: async () => {
      const res = await musicApi.users.getPlaylists();
      return (res.data?.data as UserPlaylist[]) || [];
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function usePlaylist(id?: string) {
  return useQuery({
    queryKey: queryKeys.playlists.detail(id || ""),
    queryFn: async () => {
      if (!id) return null;
      const res = await musicApi.playlists.getById(id);
      return res.data || null;
    },
    enabled: Boolean(id),
    staleTime: 1000 * 60 * 10,
  });
}

export function usePlaylistSongs(id?: string, page = 1, size = 50) {
  return useQuery({
    queryKey: queryKeys.playlists.songs(id || "", page, size),
    queryFn: async () => {
      if (!id) return [];
      const res = await musicApi.playlists.getSongs(id, page, size);
      return res.data?.data || [];
    },
    enabled: Boolean(id),
    staleTime: 1000 * 60 * 5,
  });
}

export function useSharedPlaylist(token?: string) {
  return useQuery({
    queryKey: queryKeys.playlists.shared(token || ""),
    queryFn: async () => {
      if (!token) return null;
      const res = await musicApi.users.getSharedPlaylist(token);
      return res.data || null;
    },
    enabled: Boolean(token),
    staleTime: 1000 * 60 * 10,
  });
}

export function useSharedPlaylistSongs(token?: string, page = 1, size = 50) {
  return useQuery({
    queryKey: queryKeys.playlists.sharedSongs(token || "", page, size),
    queryFn: async () => {
      if (!token) return [];
      const res = await musicApi.users.getSharedPlaylistSongs(
        token,
        page,
        size,
      );
      return res.data?.data || [];
    },
    enabled: Boolean(token),
    staleTime: 1000 * 60 * 5,
  });
}

export function useCreatePlaylistMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      name,
      privacy = "PRIVATE",
    }: {
      name: string;
      privacy?: PlaylistPrivacy;
    }) => {
      const res = await musicApi.users.createPlaylist(name, privacy);
      return res.data;
    },
    onSuccess: (newPlaylist) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.playlists.userPlaylists(),
      });
      toast.success(`Created playlist "${newPlaylist.name}"`);
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to create playlist");
    },
  });
}

export function useRenamePlaylistMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const res = await musicApi.users.renamePlaylist(id, name);
      return res.data;
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.playlists.userPlaylists(),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.playlists.detail(updated.id),
      });
      toast.success("Playlist renamed successfully");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to rename playlist");
    },
  });
}

export function useDeletePlaylistMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await musicApi.users.deletePlaylist(id);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.playlists.userPlaylists(),
      });
      toast.success("Playlist deleted");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to delete playlist");
    },
  });
}

export function useAddSongToPlaylistMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      playlistId,
      songId,
    }: {
      playlistId: string;
      songId: string;
    }) => {
      const res = await musicApi.users.addSongToPlaylist(playlistId, songId);
      return res.data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.playlists.songs(vars.playlistId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.playlists.userPlaylists(),
      });
      toast.success("Added song to playlist");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to add song to playlist");
    },
  });
}

export function useRemoveSongFromPlaylistMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      playlistId,
      songId,
    }: {
      playlistId: string;
      songId: string;
    }) => {
      const res = await musicApi.users.removeSongFromPlaylist(
        playlistId,
        songId,
      );
      return res.data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.playlists.songs(vars.playlistId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.playlists.userPlaylists(),
      });
      toast.success("Removed song from playlist");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to remove song");
    },
  });
}
