"use client";

import { useState } from "react";
import { useServerTable } from "@/components/data-table/useServerTable";
import { useToast } from "@/components/feedback/ToastProvider";
import { usePermissions } from "@/lib/permissions";
import { useDeletionJobs, useIngestionJobs } from "@/lib/queries/jobs";
import { useSyncMetadata } from "@/lib/queries/songs";
import { DeletionPanel } from "./components/DeletionPanel";
import { IngestionPanel } from "./components/IngestionPanel";
import { JobsHeader, type JobsTab } from "./components/JobsHeader";

export default function JobMonitoringPage() {
  const toast = useToast();
  const { can } = usePermissions();
  const [tab, setTab] = useState<JobsTab>("INGESTION");
  const [live, setLive] = useState(true);

  const ingestionTable = useServerTable({ initialFilters: { status: "ALL" } });
  const deletionTable = useServerTable({
    initialFilters: { status: "ALL", entityType: "ALL" },
  });

  // Only the visible tab's queries run (and poll every 15 s while the browser tab is visible).
  const ingestion = useIngestionJobs(
    {
      page: ingestionTable.pagination.pageIndex,
      size: ingestionTable.pagination.pageSize,
      search: ingestionTable.debouncedSearch,
      status: ingestionTable.filters.status,
    },
    { live, enabled: tab === "INGESTION" },
  );
  const deletion = useDeletionJobs(
    {
      page: deletionTable.pagination.pageIndex,
      size: deletionTable.pagination.pageSize,
      search: deletionTable.debouncedSearch,
      status: deletionTable.filters.status,
      entityType: deletionTable.filters.entityType,
    },
    { live, enabled: tab === "DELETION" },
  );

  const current = tab === "INGESTION" ? ingestion : deletion;
  const refresh = () => {
    current.summary.refetch();
    current.active.refetch();
    current.list.refetch();
  };
  const refreshing = current.summary.isFetching || current.list.isFetching;

  const sync = useSyncMetadata();
  const handleSync = () =>
    sync.mutate(undefined, {
      onSuccess: () => toast("Pagination metadata synced"),
      onError: (err) =>
        toast(err.message || "Failed to sync pagination metadata.", "error"),
    });

  return (
    <div className="p-6 md:p-8 max-w-[1600px] mx-auto space-y-8 text-white font-sans">
      <JobsHeader
        tab={tab}
        onTabChange={setTab}
        activeCount={current.active.data?.length ?? 0}
        live={live}
        onLiveChange={setLive}
        refreshing={refreshing}
        onRefresh={refresh}
        onSyncMetadata={can("system.syncMetadata") ? handleSync : undefined}
        syncing={sync.isPending}
      />

      {tab === "INGESTION" ? (
        <IngestionPanel
          table={ingestionTable}
          summary={ingestion.summary}
          active={ingestion.active}
          list={ingestion.list}
          onRefresh={refresh}
        />
      ) : (
        <DeletionPanel
          table={deletionTable}
          summary={deletion.summary}
          list={deletion.list}
          onRefresh={refresh}
        />
      )}
    </div>
  );
}
