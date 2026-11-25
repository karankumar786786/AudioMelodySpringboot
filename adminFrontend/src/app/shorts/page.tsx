"use client";

import { Plus, RefreshCw, X } from "lucide-react";
import { useState } from "react";
import { DataTable } from "@/components/data-table/DataTable";
import { useServerTable } from "@/components/data-table/useServerTable";
import { useConfirm } from "@/components/feedback/ConfirmProvider";
import { usePermissions } from "@/lib/permissions";
import {
  useBanFromShorts,
  useResolveReport,
  useShortAction,
  useShortReports,
  useShorts,
} from "@/lib/queries/shorts";
import { ShortUploadModal } from "./components/ShortUploadModal";
import { shortColumns } from "./components/shortColumns";
import {
  SHORT_STATUS_FILTERS,
  type ShortAction,
  type ShortItem,
  type ShortOwnerFilter,
  type ShortReportItem,
  type ShortStatusFilter,
  shortMediaUrl,
} from "./types";

const select =
  "bg-[#181818] border border-[#282828] text-white rounded-full text-xs px-3 py-2 cursor-pointer";

export default function ShortsPage() {
  const [tab, setTab] = useState<"shorts" | "reports">("shorts");
  const [uploadOpen, setUploadOpen] = useState(false);
  const { can } = usePermissions();

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            Shorts
          </h1>
          <p className="text-zinc-400 mt-1 text-sm">
            Vertical videos with their own audio, posted by One Melody or by
            listeners, optionally linked to a song.
          </p>
        </div>
        {can("short.create") ? (
          <button
            type="button"
            onClick={() => setUploadOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-full text-sm font-bold cursor-pointer self-start md:self-auto"
          >
            <Plus className="w-4 h-4" /> Upload short
          </button>
        ) : null}
      </div>

      <div className="flex gap-2" role="tablist">
        {(["shorts", "reports"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold cursor-pointer ${
              tab === t
                ? "bg-white text-black"
                : "bg-[#181818] text-zinc-300 border border-[#282828]"
            }`}
          >
            {t === "shorts" ? "All shorts" : "Reports"}
          </button>
        ))}
      </div>

      {tab === "shorts" ? <ShortsTab /> : <ReportsTab />}

      <ShortUploadModal
        isOpen={uploadOpen}
        onClose={() => setUploadOpen(false)}
      />
    </div>
  );
}

function ShortsTab() {
  const { can } = usePermissions();
  const confirm = useConfirm();
  const action = useShortAction();
  const ban = useBanFromShorts();
  const [preview, setPreview] = useState<ShortItem | null>(null);

  const table = useServerTable({
    initialFilters: {
      status: "ALL" as ShortStatusFilter,
      owner: "ALL" as ShortOwnerFilter,
      reported: "no",
    },
  });
  const { pagination, filters } = table;
  const query = useShorts({
    page: pagination.pageIndex,
    size: pagination.pageSize,
    search: table.debouncedSearch,
    status: filters.status,
    owner: filters.owner,
    reported: filters.reported === "yes",
  });

  const onAction = async (short: ShortItem, a: ShortAction) => {
    if (a === "delete") {
      const ok = await confirm({
        title: "Delete this short?",
        description:
          "It disappears from every feed and its video files are removed. This cannot be undone.",
        confirmLabel: "Delete short",
        destructive: true,
        typeToConfirm: "delete",
      });
      if (!ok) return;
    }
    action.mutate({
      short,
      action: a,
      reason: a === "hide" ? "Hidden by an admin" : undefined,
    });
  };

  const onBan = async (short: ShortItem) => {
    if (!short.userId) return;
    const ok = await confirm({
      title: "Stop this account posting shorts for 30 days?",
      description:
        "They can still listen and watch. Their existing shorts stay until you hide or delete them.",
      confirmLabel: "Ban for 30 days",
      destructive: true,
      typeToConfirm: "ban",
    });
    if (ok) ban.mutate({ userId: short.userId, days: 30 });
  };

  const pending =
    action.isPending && action.variables
      ? { id: action.variables.short.id, action: action.variables.action }
      : null;

  const columns = shortColumns({
    canModerate: can("short.moderate"),
    canBan: can("short.ban"),
    pending,
    onAction,
    onPreview: setPreview,
    onBan,
  });

  return (
    <>
      <DataTable<ShortItem>
        columns={columns}
        data={query.data?.rows ?? []}
        getRowId={(s) => s.id}
        rowCount={query.data?.total ?? 0}
        pagination={pagination}
        onPaginationChange={table.setPagination}
        loading={query.isPending}
        fetching={query.isFetching}
        error={query.error}
        onRetry={() => query.refetch()}
        exportFileName="shorts"
        storageKey="shorts"
        itemLabel="shorts"
        pageSizeOptions={[10, 20, 50, 100]}
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={table.search}
              onChange={(e) => table.setSearch(e.target.value)}
              placeholder="Search caption, song or id"
              className="bg-[#181818] border border-[#282828] text-white rounded-full text-xs px-3 py-2 w-56"
            />
            <select
              aria-label="Status"
              className={select}
              value={filters.status}
              onChange={(e) =>
                table.setFilter("status", e.target.value as ShortStatusFilter)
              }
            >
              {SHORT_STATUS_FILTERS.map((s) => (
                <option key={s} value={s}>
                  {s === "ALL" ? "Any status" : s}
                </option>
              ))}
            </select>
            <select
              aria-label="Posted by"
              className={select}
              value={filters.owner}
              onChange={(e) =>
                table.setFilter("owner", e.target.value as ShortOwnerFilter)
              }
            >
              <option value="ALL">Anyone</option>
              <option value="ADMIN">One Melody</option>
              <option value="LISTENER">Listeners</option>
            </select>
            <select
              aria-label="Reported"
              className={select}
              value={filters.reported}
              onChange={(e) => table.setFilter("reported", e.target.value)}
            >
              <option value="no">All</option>
              <option value="yes">Reported only</option>
            </select>
          </div>
        }
        actions={
          <button
            type="button"
            onClick={() => query.refetch()}
            className={select}
            aria-label="Refresh"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${query.isFetching ? "animate-spin" : ""}`}
            />
          </button>
        }
      />
      {preview ? (
        <PreviewModal short={preview} onClose={() => setPreview(null)} />
      ) : null}
    </>
  );
}

function ReportsTab() {
  const [page, setPage] = useState({ pageIndex: 0, pageSize: 20 });
  const reports = useShortReports({
    page: page.pageIndex,
    size: page.pageSize,
  });
  const resolve = useResolveReport();

  const columns = [
    {
      id: "short",
      header: "Short",
      cell: ({ row }: { row: { original: ShortReportItem } }) => (
        <div className="flex items-center gap-3">
          {row.original.thumbnailKey ? (
            <img
              src={shortMediaUrl(row.original.thumbnailKey)}
              alt=""
              className="w-8 h-14 rounded object-cover"
            />
          ) : null}
          <div>
            <div className="text-xs text-white">
              {row.original.shortCaption || "No caption"}
            </div>
            <div className="text-[11px] text-zinc-500">
              {row.original.shortStatus}
            </div>
          </div>
        </div>
      ),
    },
    { id: "reason", header: "Reason", accessorKey: "reason" },
    {
      id: "note",
      header: "Note",
      cell: ({ row }: { row: { original: ShortReportItem } }) => (
        <span className="text-xs text-zinc-400">
          {row.original.note || "–"}
        </span>
      ),
    },
    {
      id: "reporter",
      header: "Reported by",
      cell: ({ row }: { row: { original: ShortReportItem } }) => (
        <span className="text-xs text-zinc-400">
          {row.original.reporterEmail || row.original.reporterId}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }: { row: { original: ShortReportItem } }) => (
        <div className="flex justify-end gap-1.5">
          <button
            type="button"
            className={select}
            onClick={() =>
              resolve.mutate({ report: row.original, action: "hide" })
            }
          >
            Hide short
          </button>
          <button
            type="button"
            className={select}
            onClick={() =>
              resolve.mutate({ report: row.original, action: "dismiss" })
            }
          >
            Dismiss
          </button>
        </div>
      ),
    },
  ];

  return (
    <DataTable<ShortReportItem>
      columns={columns}
      data={reports.data?.rows ?? []}
      getRowId={(r) => String(r.id)}
      rowCount={reports.data?.total ?? 0}
      pagination={page}
      onPaginationChange={setPage}
      loading={reports.isPending}
      fetching={reports.isFetching}
      error={reports.error}
      onRetry={() => reports.refetch()}
      storageKey="short-reports"
      itemLabel="open reports"
    />
  );
}

function PreviewModal({
  short,
  onClose,
}: {
  short: ShortItem;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Short preview"
    >
      <div className="relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute -top-10 right-0 text-zinc-300 hover:text-white cursor-pointer"
          aria-label="Close preview"
        >
          <X className="w-6 h-6" />
        </button>
        {/* HLS plays natively in Safari; other browsers show the poster and offer the link. */}
        {/* biome-ignore lint/a11y/useMediaCaption: shorts are user videos without caption tracks */}
        <video
          src={shortMediaUrl(short.hlsKey)}
          poster={shortMediaUrl(short.thumbnailKey)}
          controls
          autoPlay
          playsInline
          className="h-[80vh] aspect-[9/16] rounded-2xl bg-black"
        />
        <a
          href={shortMediaUrl(short.hlsKey)}
          target="_blank"
          rel="noreferrer"
          className="block text-center text-xs text-zinc-400 mt-2 underline"
        >
          Open stream (HLS)
        </a>
      </div>
    </div>
  );
}
