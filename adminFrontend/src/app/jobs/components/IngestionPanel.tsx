"use client";

import type { UseQueryResult } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { DataTable } from "@/components/data-table/DataTable";
import { SearchInput, SegmentedFilter } from "@/components/data-table/Toolbar";
import type { useServerTable } from "@/components/data-table/useServerTable";
import { useConfirm } from "@/components/feedback/ConfirmProvider";
import { useToast } from "@/components/feedback/ToastProvider";
import type { JobProgress, JobSummaryMetrics } from "@/lib/api";
import type { Page } from "@/lib/http";
import { usePermissions } from "@/lib/permissions";
import { useDeleteJob, useJobUpdated, usePurgeFailedJobs, useRetryJob } from "@/lib/queries/jobs";
import { ActiveJobsLiveMonitor } from "./ActiveJobsLiveMonitor";
import { JobDetailModal } from "./JobDetailModal";
import { JobMetricsCards } from "./JobMetricsCards";
import { ingestionColumns } from "./jobColumns";
import { RecoverJobMediaModal } from "./RecoverJobMediaModal";

export type IngestionTable = ReturnType<typeof useServerTable<{ status: string }>>;

const STATUSES = ["ALL", "PENDING", "PROCESSING", "COMPLETED", "FAILED"] as const;

export function IngestionPanel({
  table,
  summary,
  active,
  list,
  onRefresh,
}: {
  table: IngestionTable;
  summary: UseQueryResult<JobSummaryMetrics>;
  active: UseQueryResult<JobProgress[]>;
  list: UseQueryResult<Page<JobProgress>>;
  onRefresh: () => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const { can } = usePermissions();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [recovering, setRecovering] = useState<JobProgress | null>(null);

  const retry = useRetryJob<JobProgress>("ingestion");
  const remove = useDeleteJob("ingestion");
  const purge = usePurgeFailedJobs();
  const jobUpdated = useJobUpdated();

  const rows = list.data?.rows ?? [];
  const activeJobs = active.data ?? [];
  // Read the selected job from the live data so the modal follows each refresh.
  const selectedJob =
    (selectedId && (rows.find((j) => j.id === selectedId) ?? activeJobs.find((j) => j.id === selectedId))) || null;

  const handleRetry = (id: string) =>
    retry.mutate(id, { onError: (err) => toast(err.message || "Error retrying ingestion job", "error") });

  const handleDelete = async (id: string) => {
    const job = rows.find((j) => j.id === id) ?? activeJobs.find((j) => j.id === id);
    const ok = await confirm({
      title: "Delete this ingestion job?",
      description:
        "This cleans up everything linked to it: S3 audio/video files, temporary uploads, Algolia search records, Recombee vectors and database entities.",
      confirmLabel: "Delete job",
      destructive: true,
      typeToConfirm: job?.title || "delete",
    });
    if (!ok) return;
    remove.mutate(id, {
      onSuccess: () => {
        if (selectedId === id) setSelectedId(null);
      },
      onError: (err) => toast(err.message || "Error deleting ingestion job", "error"),
    });
  };

  const handlePurge = async () => {
    const ok = await confirm({
      title: "Purge all failed jobs?",
      description:
        "This permanently wipes residual S3 audio/video files, halts executions and removes Algolia/Recombee records for every failed job.",
      confirmLabel: "Purge failed jobs",
      destructive: true,
      typeToConfirm: "purge failed jobs",
    });
    if (!ok) return;
    purge.mutate(undefined, {
      onSuccess: (data) => {
        toast(`Purged ${data?.deletedCount ?? 0} failed job(s) and their cloud/storage artifacts.`);
        if (selectedJob?.status === "FAILED") setSelectedId(null);
      },
      onError: (err) => toast(err.message || "Error purging failed jobs", "error"),
    });
  };

  const retryingId = retry.isPending ? (retry.variables ?? null) : null;
  const deletingId = remove.isPending ? (remove.variables ?? null) : null;
  const columns = useMemo(
    () =>
      ingestionColumns({
        onRetry: handleRetry,
        onDelete: handleDelete,
        onRecover: setRecovering,
        retryingId,
        deletingId,
      }),
    // biome-ignore lint/correctness/useExhaustiveDependencies: handlers read fresh state when called
    [retryingId, deletingId, rows],
  );

  const hasFailed = rows.some((j) => j.status === "FAILED");

  return (
    <>
      <JobMetricsCards
        type="INGESTION"
        metrics={summary.data ?? null}
        loading={summary.isPending}
        onRefresh={onRefresh}
        isRefreshing={summary.isFetching}
      />

      <ActiveJobsLiveMonitor activeJobs={activeJobs} onSelectJob={(job) => setSelectedId(job.id)} />

      <DataTable<JobProgress>
        columns={columns}
        data={rows}
        getRowId={(j) => j.id}
        rowCount={list.data?.total ?? 0}
        pagination={table.pagination}
        onPaginationChange={table.setPagination}
        loading={list.isPending}
        fetching={list.isFetching}
        error={list.error}
        onRetry={() => list.refetch()}
        onRowClick={(job) => setSelectedId(job.id)}
        toolbar={
          <>
            <SegmentedFilter
              label="Job status"
              value={table.filters.status}
              onChange={(s) => table.setFilter("status", s)}
              options={STATUSES.map((s) => ({ value: s, label: s === "ALL" ? "All Jobs" : s }))}
            />
            {hasFailed && can("job.purgeFailed") && (
              <button
                type="button"
                onClick={handlePurge}
                disabled={purge.isPending}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/25 hover:bg-rose-500/20 transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{purge.isPending ? "Purging..." : "Purge All Failed"}</span>
              </button>
            )}
            <SearchInput value={table.search} onChange={table.setSearch} placeholder="Search song, artist, job ID..." />
          </>
        }
        emptyState={
          <div className="py-12 text-center text-zinc-500 text-xs">No ingestion jobs found matching filter criteria.</div>
        }
        exportFileName="ingestion-jobs"
        storageKey="ingestion-jobs"
        defaultHiddenColumns={["failureReason"]}
        itemLabel="ingestion jobs"
        pageSizeOptions={[5, 10, 20, 50, 100]}
      />

      <JobDetailModal
        job={selectedJob}
        onClose={() => setSelectedId(null)}
        onRetryJob={handleRetry}
        retryingJobId={retryingId}
        onOpenRecoverModal={(job) => {
          setSelectedId(null);
          setRecovering(job);
        }}
        onDeleteJob={handleDelete}
        deletingJobId={deletingId}
      />

      <RecoverJobMediaModal job={recovering} onClose={() => setRecovering(null)} onSuccess={jobUpdated} />
    </>
  );
}
