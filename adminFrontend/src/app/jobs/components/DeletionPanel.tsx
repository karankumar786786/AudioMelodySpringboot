"use client";

import type { UseQueryResult } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { DataTable } from "@/components/data-table/DataTable";
import { SearchInput, SegmentedFilter } from "@/components/data-table/Toolbar";
import type { useServerTable } from "@/components/data-table/useServerTable";
import { useConfirm } from "@/components/feedback/ConfirmProvider";
import { useToast } from "@/components/feedback/ToastProvider";
import type { DeleteJobProgress, DeleteJobSummaryMetrics } from "@/lib/api";
import type { Page } from "@/lib/http";
import { useDeleteJob, useRetryJob } from "@/lib/queries/jobs";
import { DeleteJobDetailModal } from "./DeleteJobDetailModal";
import { JobMetricsCards } from "./JobMetricsCards";
import { deletionColumns } from "./jobColumns";

export type DeletionTable = ReturnType<typeof useServerTable<{ status: string; entityType: string }>>;

// DeleteJob statuses and entity types as the delete pipeline stores them.
const STATUSES = ["ALL", "PENDING", "IN_PROGRESS", "COMPLETED", "FAILED"] as const;
const TYPES = ["ALL", "SONG", "ARTIST", "PLAYLIST"] as const;

export function DeletionPanel({
  table,
  summary,
  list,
  onRefresh,
}: {
  table: DeletionTable;
  summary: UseQueryResult<DeleteJobSummaryMetrics>;
  list: UseQueryResult<Page<DeleteJobProgress>>;
  onRefresh: () => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const retry = useRetryJob<DeleteJobProgress>("deletion");
  const remove = useDeleteJob("deletion");

  const rows = list.data?.rows ?? [];
  const selectedJob = (selectedId && rows.find((j) => j.id === selectedId)) || null;

  const handleRetry = (id: string) =>
    retry.mutate(id, { onError: (err) => toast(err.message || "Error retrying delete job", "error") });

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: "Delete this cascade delete audit record?",
      description: "This cannot be undone.",
      confirmLabel: "Delete record",
      destructive: true,
      typeToConfirm: "delete",
    });
    if (!ok) return;
    remove.mutate(id, {
      onSuccess: () => {
        if (selectedId === id) setSelectedId(null);
      },
      onError: (err) => toast(err.message || "Error deleting cascade delete job", "error"),
    });
  };

  const retryingId = retry.isPending ? (retry.variables ?? null) : null;
  const deletingId = remove.isPending ? (remove.variables ?? null) : null;
  const columns = useMemo(
    () => deletionColumns({ onRetry: handleRetry, onDelete: handleDelete, retryingId, deletingId }),
    // biome-ignore lint/correctness/useExhaustiveDependencies: handlers read fresh state when called
    [retryingId, deletingId],
  );

  return (
    <>
      <JobMetricsCards
        type="DELETION"
        metrics={summary.data ?? null}
        loading={summary.isPending}
        onRefresh={onRefresh}
        isRefreshing={summary.isFetching}
      />

      <DataTable<DeleteJobProgress>
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
              label="Delete job status"
              value={table.filters.status}
              onChange={(s) => table.setFilter("status", s)}
              options={STATUSES.map((s) => ({ value: s, label: s === "ALL" ? "All Status" : s.replace("_", " ") }))}
            />
            <SegmentedFilter
              label="Entity type"
              value={table.filters.entityType}
              onChange={(t) => table.setFilter("entityType", t)}
              options={TYPES.map((t) => ({ value: t, label: t === "ALL" ? "All Types" : t }))}
            />
            <SearchInput value={table.search} onChange={table.setSearch} placeholder="Search entity ID, title, job ID..." />
          </>
        }
        emptyState={
          <div className="py-12 text-center text-zinc-500 text-xs">No cascade delete jobs found matching filter criteria.</div>
        }
        exportFileName="delete-jobs"
        storageKey="delete-jobs"
        itemLabel="delete records"
        pageSizeOptions={[5, 10, 20, 50, 100]}
      />

      <DeleteJobDetailModal
        job={selectedJob}
        onClose={() => setSelectedId(null)}
        onRetryJob={handleRetry}
        retryingJobId={retryingId}
        onDeleteJob={handleDelete}
        deletingJobId={deletingId}
      />
    </>
  );
}
