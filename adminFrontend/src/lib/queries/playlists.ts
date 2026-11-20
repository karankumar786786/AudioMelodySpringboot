"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { Playlist, PlaylistSong } from "@/app/playlists/types";
import { useToast } from "@/components/feedback/ToastProvider";
import { ApiError, apiGet, apiRequest, fetchPage } from "@/lib/http";
import { retryIdempotent } from "@/lib/query/client";
import { queryKeys } from "@/lib/query/keys";
import { patchPages, restore } from "@/lib/query/optimistic";

export interface PlaylistListParams {
  page: number;
  size: number;
  search: string;
  status: string;
}

export function usePlaylists(
  params: PlaylistListParams,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: queryKeys.playlists.list({ ...params }),
    queryFn: ({ signal }) =>
      fetchPage<Playlist>("/admin/playlist", { ...params }, signal),
    placeholderData: keepPreviousData,
    enabled: options?.enabled ?? true,
  });
}

export function usePlaylist(id: string) {
  return useQuery({
    queryKey: queryKeys.playlists.detail(id),
    queryFn: ({ signal }) => apiGet<Playlist>(`/admin/playlist/${id}`, signal),
    retry: (count, err) =>
      !(err instanceof ApiError && err.status === 404) && count < 2,
  });
}

/** All tracks of a playlist (up to 500), filtered on the client like before. */
export function usePlaylistSongs(id: string) {
  return useQuery({
    queryKey: queryKeys.playlists.songs(id),
    queryFn: async ({ signal }) =>
      (
        await fetchPage<PlaylistSong>(
          `/admin/playlist/${id}/songs`,
          { page: 0, size: 500 },
          signal,
        )
      ).rows,
  });
}

export interface PlaylistInput {
  name: string;
  description?: string;
  coverImageKey?: string;
  videoKey?: string | null;
}

export function useCreatePlaylist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: PlaylistInput) =>
      apiRequest<Playlist>("/admin/playlist", {
        method: "POST",
        body: input,
        errorMessage: "Failed to create playlist",
      }),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.playlists.all });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
  });
}

/** PUT /admin/playlist/:id with an optimistic update of the detail view. */
export function useUpdatePlaylist(id: string) {
  const qc = useQueryClient();
  const key = queryKeys.playlists.detail(id);
  return useMutation({
    mutationFn: (patch: Partial<PlaylistInput>) =>
      apiRequest<Playlist>(`/admin/playlist/${id}`, {
        method: "PUT",
        body: patch,
        errorMessage: "Update failed",
      }),
    retry: retryIdempotent,
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<Playlist>(key);
      if (previous) {
        qc.setQueryData<Playlist>(key, {
          ...previous,
          ...patch,
          videoKey:
            patch.videoKey === null
              ? undefined
              : (patch.videoKey ?? previous.videoKey),
        } as Playlist);
      }
      return { previous };
    },
    onError: (_err, _patch, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous);
    },
    onSuccess: (data) => {
      if (data && typeof data === "object" && "id" in data)
        qc.setQueryData(key, data);
    },
    onSettled: () =>
      qc.invalidateQueries({ queryKey: queryKeys.playlists.lists() }),
  });
}

export function useDeletePlaylist() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (playlist: Pick<Playlist, "id" | "name">) =>
      apiRequest(`/admin/playlist/${playlist.id}`, {
        method: "DELETE",
        errorMessage: "Failed to delete playlist",
      }),
    retry: retryIdempotent,
    onMutate: async (playlist) => ({
      snapshot: await patchPages<Playlist>(
        qc,
        queryKeys.playlists.lists(),
        (rows) => rows.filter((p) => p.id !== playlist.id),
        -1,
      ),
    }),
    onError: (err, _p, ctx) => {
      restore(qc, ctx?.snapshot);
      toast(err.message, "error");
    },
    onSuccess: (_d, playlist) => toast(`Playlist "${playlist.name}" deleted`),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.playlists.all });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
  });
}

export function useAddSongToPlaylist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      playlistId,
      songId,
    }: {
      playlistId: string;
      songId: string;
    }) =>
      apiRequest<Playlist>(`/admin/playlist/${playlistId}/songs`, {
        method: "POST",
        body: { songId },
        errorMessage: "Failed to add track to playlist",
      }),
    // Adding is get-or-create on the server, so a retry cannot duplicate the track.
    retry: retryIdempotent,
    onSettled: (_d, _e, { playlistId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.playlists.songs(playlistId) });
      qc.invalidateQueries({
        queryKey: queryKeys.playlists.detail(playlistId),
      });
      qc.invalidateQueries({ queryKey: queryKeys.playlists.lists() });
    },
  });
}

export function useRemovePlaylistSong(playlistId: string) {
  const qc = useQueryClient();
  const toast = useToast();
  const songsKey = queryKeys.playlists.songs(playlistId);
  const detailKey = queryKeys.playlists.detail(playlistId);
  return useMutation({
    mutationFn: (song: Pick<PlaylistSong, "id" | "title">) =>
      apiRequest<Playlist>(`/admin/playlist/${playlistId}/songs/${song.id}`, {
        method: "DELETE",
        errorMessage: "Failed to remove track",
      }),
    retry: retryIdempotent,
    onMutate: async (song) => {
      await qc.cancelQueries({ queryKey: songsKey });
      const previousSongs = qc.getQueryData<PlaylistSong[]>(songsKey);
      const previousDetail = qc.getQueryData<Playlist>(detailKey);
      qc.setQueryData<PlaylistSong[]>(songsKey, (old) =>
        old?.filter((s) => s.id !== song.id),
      );
      qc.setQueryData<Playlist>(detailKey, (old) =>
        old ? { ...old, totalSongs: Math.max(0, old.totalSongs - 1) } : old,
      );
      return { previousSongs, previousDetail };
    },
    onError: (err, _s, ctx) => {
      qc.setQueryData(songsKey, ctx?.previousSongs);
      qc.setQueryData(detailKey, ctx?.previousDetail);
      toast(err.message, "error");
    },
    onSuccess: (_d, song) =>
      toast(`Removed "${song.title || "track"}" from playlist`),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: songsKey });
      qc.invalidateQueries({ queryKey: queryKeys.playlists.lists() });
    },
  });
}
