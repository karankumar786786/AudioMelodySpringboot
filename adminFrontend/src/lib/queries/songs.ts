"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { Song } from "@/app/songs/types";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiGet, apiRequest, fetchPage } from "@/lib/http";
import { retryIdempotent } from "@/lib/query/client";
import { queryKeys } from "@/lib/query/keys";
import { patchPages, restore } from "@/lib/query/optimistic";

export type SongPreset =
  | "ALL"
  | "FEATURED"
  | "CANVAS"
  | "FULL_VIDEO"
  | "LYRICS";

export interface SongListParams {
  page: number;
  size: number;
  search: string;
  genre: string;
  preset: SongPreset;
}

/** Maps the UI filters to the query parameters `SongListView` reads. */
export function songListQuery({
  page,
  size,
  search,
  genre,
  preset,
}: SongListParams) {
  return {
    page,
    size,
    search,
    genre,
    featured: preset === "FEATURED" ? "true" : undefined,
    hasVideo: preset === "CANVAS" ? "true" : undefined,
    hasFullVideo: preset === "FULL_VIDEO" ? "true" : undefined,
    hasLyrics: preset === "LYRICS" ? "true" : undefined,
  };
}

export function useSongs(params: SongListParams) {
  return useQuery({
    queryKey: queryKeys.songs.list({ ...params }),
    queryFn: ({ signal }) =>
      fetchPage<Song>("/admin/song", songListQuery(params), signal),
    placeholderData: keepPreviousData,
  });
}

export function useSong(id: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.songs.detail(id ?? ""),
    queryFn: ({ signal }) => apiGet<Song>(`/admin/song/${id}`, signal),
    enabled: Boolean(id),
  });
}

/** Writes an edited song into every cached list page and its detail entry. */
export function useMergeSong() {
  const qc = useQueryClient();
  return (song: Partial<Song> & { id: string }) => {
    qc.setQueriesData<{ rows: Song[] }>(
      { queryKey: queryKeys.songs.lists() },
      (old) =>
        old?.rows
          ? {
              ...old,
              rows: old.rows.map((s) =>
                s.id === song.id ? { ...s, ...song } : s,
              ),
            }
          : old,
    );
    qc.setQueryData<Song>(queryKeys.songs.detail(song.id), (old) =>
      old ? { ...old, ...song } : old,
    );
    qc.invalidateQueries({ queryKey: queryKeys.songs.all });
  };
}

/** Promote to or remove from the featured hero ("publish" to the app's home hero). */
export function useToggleFeatured() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ song, featured }: { song: Song; featured: boolean }) =>
      // `featured` sets an explicit value (the endpoint toggles when it is absent), which
      // makes the call idempotent and safe to retry.
      apiRequest<Song>(`/admin/song/${song.id}/featured`, {
        method: "PATCH",
        body: { featured, isFeatured: featured },
        errorMessage: "Could not update featured status",
      }),
    retry: retryIdempotent,
    onMutate: async ({ song, featured }) => ({
      snapshot: await patchPages<Song>(qc, queryKeys.songs.lists(), (rows) =>
        rows.map((s) =>
          s.id === song.id ? { ...s, isFeatured: featured } : s,
        ),
      ),
    }),
    onError: (err, _vars, ctx) => {
      restore(qc, ctx?.snapshot);
      toast(err.message, "error");
    },
    onSuccess: (_data, { featured }) =>
      toast(
        featured ? "Marked as hero featured" : "Removed from hero featured",
      ),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.songs.lists() });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
  });
}

export function useDeleteSong() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (song: Pick<Song, "id" | "title">) =>
      apiRequest(`/admin/song/${song.id}`, {
        method: "DELETE",
        errorMessage: "Could not delete song",
      }),
    retry: retryIdempotent,
    onMutate: async (song) => ({
      snapshot: await patchPages<Song>(
        qc,
        queryKeys.songs.lists(),
        (rows) => rows.filter((s) => s.id !== song.id),
        -1,
      ),
    }),
    onError: (err, _song, ctx) => {
      restore(qc, ctx?.snapshot);
      toast(err.message, "error");
    },
    onSuccess: (_d, song) => toast(`Track "${song.title}" queued for deletion`),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.songs.all });
      qc.invalidateQueries({ queryKey: queryKeys.jobs.deletion.all });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
  });
}

export function useBulkDeleteSongs() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const results = await Promise.allSettled(
        ids.map((id) => apiRequest(`/admin/song/${id}`, { method: "DELETE" })),
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      return { deleted: ids.length - failed, failed };
    },
    onMutate: async (ids) => ({
      snapshot: await patchPages<Song>(
        qc,
        queryKeys.songs.lists(),
        (rows) => rows.filter((s) => !ids.includes(s.id)),
        -ids.length,
      ),
    }),
    onSuccess: ({ deleted, failed }, _ids, ctx) => {
      if (failed > 0) {
        restore(qc, ctx?.snapshot);
        toast(
          `Deleted ${deleted} tracks; ${failed} could not be deleted`,
          "error",
        );
      } else {
        toast(`Deleted ${deleted} tracks`);
      }
    },
    onError: (err, _ids, ctx) => {
      restore(qc, ctx?.snapshot);
      toast(err.message, "error");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.songs.all });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
  });
}

/** POST /admin/jobs/sync-metadata (SUPER_ADMIN): reconciles counts and resyncs search and recommendations. */
export function useSyncMetadata() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiRequest("/admin/jobs/sync-metadata", {
        method: "POST",
        errorMessage: "Failed to sync metadata",
      }),
    onSettled: () => qc.invalidateQueries(),
  });
}
