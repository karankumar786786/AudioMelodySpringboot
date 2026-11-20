"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type {
  DeleteJobProgress,
  DeleteJobSummaryMetrics,
  JobProgress,
  JobSummaryMetrics,
} from "@/lib/api";
import { apiGet, apiRequest, fetchPage } from "@/lib/http";
import { queryKeys } from "@/lib/query/keys";
import { patchPages, restore } from "@/lib/query/optimistic";

/**
 * The jobs screen refreshes every 15 s while the tab is visible. Each refresh is three
 * calls and each call renews the admin session in Redis (Upstash bills per command), so
 * polling pauses while the tab is hidden and resumes, with an immediate refetch, when it
 * becomes visible again (TanStack's focus manager listens to `visibilitychange`).
 */
export const JOBS_REFRESH_MS = 15_000;

function liveOptions(live: boolean, enabled: boolean) {
  return {
    enabled,
    refetchInterval: live ? JOBS_REFRESH_MS : (false as const),
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: live,
    staleTime: 5_000,
  };
}

function asArray<T>(data: unknown): T[] {
  const d = data as Record<string, unknown> | T[] | null;
  if (Array.isArray(d)) return d;
  const inner = (d?.content ?? d?.data) as unknown;
  return Array.isArray(inner) ? (inner as T[]) : [];
}

export interface IngestionListParams {
  page: number;
  size: number;
  search: string;
  status: string;
}

export interface DeletionListParams extends IngestionListParams {
  entityType: string;
}

export function useIngestionJobs(
  params: IngestionListParams,
  { live, enabled }: { live: boolean; enabled: boolean },
) {
  const opts = liveOptions(live, enabled);
  const summary = useQuery({
    queryKey: queryKeys.jobs.ingestion.summary(),
    queryFn: ({ signal }) =>
      apiGet<JobSummaryMetrics>("/admin/jobs/summary", signal),
    ...opts,
  });
  const active = useQuery({
    queryKey: queryKeys.jobs.ingestion.active(),
    queryFn: async ({ signal }) =>
      asArray<JobProgress>(await apiGet("/admin/jobs/active", signal)),
    ...opts,
  });
  const list = useQuery({
    queryKey: queryKeys.jobs.ingestion.list({ ...params }),
    queryFn: ({ signal }) =>
      fetchPage<JobProgress>("/admin/jobs", { ...params }, signal),
    placeholderData: keepPreviousData,
    ...opts,
  });
  return { summary, active, list };
}

export function useDeletionJobs(
  params: DeletionListParams,
  { live, enabled }: { live: boolean; enabled: boolean },
) {
  const opts = liveOptions(live, enabled);
  const summary = useQuery({
    queryKey: queryKeys.jobs.deletion.summary(),
    queryFn: ({ signal }) =>
      apiGet<DeleteJobSummaryMetrics>("/admin/delete-jobs/summary", signal),
    ...opts,
  });
  const active = useQuery({
    queryKey: queryKeys.jobs.deletion.active(),
    queryFn: async ({ signal }) =>
      asArray<DeleteJobProgress>(
        await apiGet("/admin/delete-jobs/active", signal),
      ),
    ...opts,
  });
  const list = useQuery({
    queryKey: queryKeys.jobs.deletion.list({ ...params }),
    queryFn: ({ signal }) =>
      fetchPage<DeleteJobProgress>("/admin/delete-jobs", { ...params }, signal),
    placeholderData: keepPreviousData,
    ...opts,
  });
  return { summary, active, list };
}

type Pipeline = "ingestion" | "deletion";

const BASE: Record<Pipeline, string> = {
  ingestion: "/admin/jobs",
  deletion: "/admin/delete-jobs",
};

/** Replaces one job in the cached list pages and the active list. */
function useWriteJob(pipeline: Pipeline) {
  const qc = useQueryClient();
  return (job: { id: string }) => {
    qc.setQueriesData<{ rows: { id: string }[] }>(
      { queryKey: queryKeys.jobs[pipeline].lists() },
      (old) =>
        old?.rows
          ? { ...old, rows: old.rows.map((j) => (j.id === job.id ? job : j)) }
          : old,
    );
    qc.setQueryData<{ id: string }[]>(
      queryKeys.jobs[pipeline].active(),
      (old) => {
        if (!old) return old;
        return old.some((j) => j.id === job.id)
          ? old.map((j) => (j.id === job.id ? job : j))
          : [job, ...old];
      },
    );
  };
}

export function useRetryJob<T extends { id: string }>(pipeline: Pipeline) {
  const qc = useQueryClient();
  const write = useWriteJob(pipeline);
  return useMutation({
    mutationFn: (jobId: string) =>
      apiRequest<T>(`${BASE[pipeline]}/${jobId}/retry`, {
        method: "POST",
        errorMessage:
          pipeline === "ingestion"
            ? "Failed to retry ingestion job."
            : "Failed to retry delete job.",
      }),
    onSuccess: (job) => {
      if (job && typeof job === "object" && "id" in job) write(job);
    },
    onSettled: () =>
      qc.invalidateQueries({ queryKey: queryKeys.jobs[pipeline].all }),
  });
}

/** Call after a job's media was recovered, with the updated job. */
export function useJobUpdated() {
  const qc = useQueryClient();
  const write = useWriteJob("ingestion");
  return (job: JobProgress) => {
    write(job);
    qc.invalidateQueries({ queryKey: queryKeys.jobs.ingestion.all });
  };
}

export function useDeleteJob(pipeline: Pipeline) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (jobId: string) =>
      apiRequest(`${BASE[pipeline]}/${jobId}`, {
        method: "DELETE",
        errorMessage:
          pipeline === "ingestion"
            ? "Failed to delete ingestion job."
            : "Failed to delete cascade delete record.",
      }),
    onMutate: async (jobId) => {
      const snapshot = await patchPages<{ id: string }>(
        qc,
        queryKeys.jobs[pipeline].lists(),
        (rows) => rows.filter((j) => j.id !== jobId),
        -1,
      );
      const activeKey = queryKeys.jobs[pipeline].active();
      const previousActive = qc.getQueryData(activeKey);
      qc.setQueryData<{ id: string }[]>(activeKey, (old) =>
        old?.filter((j) => j.id !== jobId),
      );
      return { snapshot, previousActive, activeKey };
    },
    onError: (_e, _id, ctx) => {
      restore(qc, ctx?.snapshot);
      if (ctx) qc.setQueryData(ctx.activeKey, ctx.previousActive);
    },
    onSettled: () =>
      qc.invalidateQueries({ queryKey: queryKeys.jobs[pipeline].all }),
  });
}

export function usePurgeFailedJobs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiRequest<{ deletedCount?: number }>("/admin/jobs/failed", {
        method: "DELETE",
        errorMessage: "Failed to purge failed jobs.",
      }),
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.jobs.all }),
  });
}
