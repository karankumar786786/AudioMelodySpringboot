"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Artist } from "@/app/artists/types";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiGet, apiRequest, fetchPage } from "@/lib/http";
import { retryIdempotent } from "@/lib/query/client";
import { queryKeys } from "@/lib/query/keys";
import { patchPages, restore } from "@/lib/query/optimistic";

export interface ArtistListParams {
  page: number;
  size: number;
  search: string;
  status: string;
}

export function useArtists(params: ArtistListParams) {
  return useQuery({
    queryKey: queryKeys.artists.list({ ...params }),
    queryFn: ({ signal }) => fetchPage<Artist>("/admin/artist", { ...params }, signal),
    placeholderData: keepPreviousData,
  });
}

export function useArtist(id: string) {
  return useQuery({
    queryKey: queryKeys.artists.detail(id),
    queryFn: ({ signal }) => apiGet<Artist>(`/admin/artist/${id}`, signal),
  });
}

export function useArtistSongs<T>(id: string, params: { page: number; size: number }) {
  return useQuery({
    queryKey: queryKeys.artists.songs(id, params),
    queryFn: ({ signal }) => fetchPage<T>(`/admin/artist/${id}/songs`, params, signal),
    placeholderData: keepPreviousData,
  });
}

export interface CreateArtistInput {
  name: string;
  about?: string;
  dob?: string | null;
  coverImageKey?: string;
}

export function useCreateArtist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateArtistInput) =>
      apiRequest<Artist>("/admin/artist", { method: "POST", body: input, errorMessage: "Failed to create artist" }),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.artists.all });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
  });
}

export function useDeleteArtist() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (artist: Pick<Artist, "id" | "name">) =>
      apiRequest(`/admin/artist/${artist.id}`, { method: "DELETE", errorMessage: "Delete failed" }),
    retry: retryIdempotent,
    onMutate: async (artist) => ({
      snapshot: await patchPages<Artist>(
        qc,
        queryKeys.artists.lists(),
        (rows) => rows.filter((a) => a.id !== artist.id),
        -1,
      ),
    }),
    onError: (err, _a, ctx) => {
      restore(qc, ctx?.snapshot);
      toast(err.message, "error");
    },
    onSuccess: (_d, artist) => toast(`Artist "${artist.name}" deleted`),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.artists.all });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
  });
}
