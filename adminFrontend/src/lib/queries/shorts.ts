"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type {
  ShortAction,
  ShortItem,
  ShortReportItem,
} from "@/app/shorts/types";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiRequest, fetchPage } from "@/lib/http";
import { queryKeys } from "@/lib/query/keys";

export interface ShortListParams {
  page: number;
  size: number;
  search: string;
  status: string;
  owner: string;
  reported: boolean;
}

export function useShorts(params: ShortListParams) {
  return useQuery({
    queryKey: queryKeys.shorts.list({ ...params }),
    queryFn: ({ signal }) =>
      fetchPage<ShortItem>(
        "/admin/shorts",
        {
          page: params.page,
          size: params.size,
          search: params.search || undefined,
          status: params.status === "ALL" ? undefined : params.status,
          owner: params.owner === "ALL" ? undefined : params.owner,
          reported: params.reported ? "true" : undefined,
        },
        signal,
      ),
    placeholderData: keepPreviousData,
    // Keep processing shorts moving without a manual refresh, only while the tab is visible.
    refetchInterval: (query) =>
      query.state.data?.rows.some(
        (s) => s.status === "PROCESSING" || s.status === "UPLOADING",
      )
        ? 10_000
        : false,
    refetchIntervalInBackground: false,
  });
}

export function useShortReports(params: { page: number; size: number }) {
  return useQuery({
    queryKey: queryKeys.shorts.reports({ ...params }),
    queryFn: ({ signal }) =>
      fetchPage<ShortReportItem>("/admin/shorts/reports", params, signal),
    placeholderData: keepPreviousData,
  });
}

const ACTION_DONE: Record<ShortAction, string> = {
  hide: "Short hidden",
  unhide: "Short is visible again",
  delete: "Short deleted",
};

export function useShortAction() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({
      short,
      action,
      reason,
    }: {
      short: ShortItem;
      action: ShortAction;
      reason?: string;
    }) =>
      action === "delete"
        ? apiRequest(`/admin/shorts/${short.id}`, {
            method: "DELETE",
            errorMessage: "Could not delete the short",
          })
        : apiRequest(`/admin/shorts/${short.id}/${action}`, {
            method: "POST",
            body: action === "hide" ? { reason } : {},
            errorMessage: `Could not ${action} the short`,
          }),
    onSuccess: (_data, { action }) => toast(ACTION_DONE[action], "success"),
    onError: (err) =>
      toast(err instanceof Error ? err.message : "Action failed", "error"),
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.shorts.all }),
  });
}

export function useResolveReport() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({
      report,
      action,
    }: {
      report: ShortReportItem;
      action: "hide" | "dismiss";
    }) =>
      apiRequest(`/admin/shorts/reports/${report.id}/resolve`, {
        method: "POST",
        body: { action },
        errorMessage: "Could not resolve the report",
      }),
    onSuccess: (_d, { action }) =>
      toast(action === "hide" ? "Short hidden" : "Report dismissed", "success"),
    onError: (err) =>
      toast(err instanceof Error ? err.message : "Action failed", "error"),
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.shorts.all }),
  });
}

export function useBanFromShorts() {
  const toast = useToast();
  return useMutation({
    mutationFn: ({ userId, days }: { userId: string; days: number }) =>
      apiRequest(`/admin/shorts/ban/${encodeURIComponent(userId)}`, {
        method: "POST",
        body: { days },
        errorMessage: "Could not ban the account",
      }),
    onSuccess: (_d, { days }) =>
      toast(
        days > 0
          ? `Account can't post shorts for ${days} days`
          : "Account can't post shorts",
        "success",
      ),
    onError: (err) =>
      toast(err instanceof Error ? err.message : "Ban failed", "error"),
  });
}

export interface CreateShortInput {
  rawKey: string;
  caption?: string;
  songId?: string | null;
}

export function useCreateShort() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (input: CreateShortInput) =>
      apiRequest<ShortItem>("/admin/shorts", {
        method: "POST",
        body: input,
        errorMessage: "Could not create the short",
      }),
    onSuccess: () => toast("Short uploaded, now processing", "success"),
    onError: (err) =>
      toast(err instanceof Error ? err.message : "Upload failed", "error"),
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.shorts.all }),
  });
}

export interface SongOption {
  id: string;
  title: string;
  artistName?: string;
}

/** Song picker for linking a short to a catalog song. */
export function useSongSearch(search: string) {
  return useQuery({
    queryKey: ["songs", "picker", search],
    queryFn: async ({ signal }) => {
      const page = await fetchPage<SongOption>(
        "/admin/song",
        { page: 0, size: 8, search },
        signal,
      );
      return page.rows;
    },
    enabled: search.trim().length >= 2,
    staleTime: 30_000,
  });
}
