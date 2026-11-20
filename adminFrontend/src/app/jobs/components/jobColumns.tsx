"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { RotateCcw, Trash2, UploadCloud } from "lucide-react";
import Image from "next/image";
import { iconButton } from "@/components/catalog/SongCells";
import type { DeleteJobProgress, JobProgress } from "@/lib/api";
import { getImageUrl } from "@/lib/image-utils";
import {
  formatMs,
  formatTime,
  getDeleteStageBadge,
  getStageBadge,
  getStatusBadge,
} from "./jobHelpers";

export interface JobRowActions {
  onRetry: (id: string) => void;
  onDelete: (id: string) => void;
  onRecover?: (job: JobProgress) => void;
  retryingId: string | null;
  deletingId: string | null;
}

function StatusCell({ status }: { status: string }) {
  const badge = getStatusBadge(status);
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${badge.bg}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
      {badge.label}
    </span>
  );
}

function StageCell({ badge }: { badge: { bg: string; label: string } }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${badge.bg}`}
    >
      {badge.label}
    </span>
  );
}

const stop = (fn: () => void) => (e: React.MouseEvent) => {
  e.stopPropagation();
  fn();
};

const created: ColumnDef<{ createdAt?: string | null }> = {
  id: "createdAt",
  accessorFn: (j) => j.createdAt ?? "",
  header: "Created At",
  meta: { cellClassName: "text-zinc-500 text-[11px] tabular-nums font-mono" },
  cell: ({ row }) => formatTime(row.original.createdAt),
};

export function ingestionColumns(a: JobRowActions): ColumnDef<JobProgress>[] {
  return [
    {
      id: "title",
      accessorFn: (j) => j.title,
      header: "Song / Target",
      meta: { label: "Song", csv: (j) => `${j.title} — ${j.artistName}` },
      cell: ({ row }) => {
        const job = row.original;
        return (
          <div className="flex items-center gap-3">
            <div className="relative w-8 h-8 rounded-lg overflow-hidden bg-black border border-white/10 shrink-0">
              {job.imageKey ? (
                <Image
                  src={getImageUrl(job.imageKey, { width: 64, height: 64 })}
                  alt={job.title || "Song cover"}
                  fill
                  sizes="32px"
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-600 text-xs">
                  🎵
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="font-bold text-white group-hover:text-indigo-300 transition-colors truncate max-w-[200px]">
                {job.title}
              </p>
              <p className="text-[11px] text-zinc-400 truncate max-w-[200px]">
                {job.artistName}
              </p>
            </div>
          </div>
        );
      },
    },
    {
      id: "status",
      accessorFn: (j) => j.status,
      header: "Status",
      cell: ({ row }) => <StatusCell status={row.original.status} />,
    },
    {
      id: "currentStage",
      accessorFn: (j) => j.currentStage,
      header: "Current Stage",
      cell: ({ row }) => (
        <StageCell badge={getStageBadge(row.original.currentStage)} />
      ),
    },
    {
      id: "transcodingAttempt",
      accessorFn: (j) => j.transcodingAttempt ?? 1,
      header: "Attempt",
      meta: { cellClassName: "text-zinc-400 tabular-nums font-mono" },
    },
    {
      id: "transcodingDurationMs",
      accessorFn: (j) => j.transcodingDurationMs ?? 0,
      header: "Transcoding",
      meta: {
        cellClassName: "text-zinc-400 tabular-nums font-mono",
        csv: (j) => formatMs(j.transcodingDurationMs),
      },
      cell: ({ row }) => formatMs(row.original.transcodingDurationMs),
    },
    {
      id: "totalDurationMs",
      accessorFn: (j) => j.totalDurationMs ?? 0,
      header: "Total Time",
      meta: {
        cellClassName: "font-bold text-white tabular-nums font-mono",
        csv: (j) => formatMs(j.totalDurationMs),
      },
      cell: ({ row }) => formatMs(row.original.totalDurationMs),
    },
    {
      id: "failureReason",
      accessorFn: (j) => j.failureReason ?? "",
      header: "Failure",
      enableSorting: false,
      cell: ({ getValue }) => (
        <span className="text-rose-300/80 truncate max-w-60 block">
          {getValue<string>() || "—"}
        </span>
      ),
    },
    created as ColumnDef<JobProgress>,
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      enableSorting: false,
      enableHiding: false,
      meta: {
        csv: false,
        label: "Actions",
        headerClassName: "text-right",
        cellClassName: "text-right",
      },
      cell: ({ row }) => {
        const job = row.original;
        const retrying = a.retryingId === job.id;
        const deleting = a.deletingId === job.id;
        return (
          <div className="flex items-center justify-end gap-1">
            {job.status === "FAILED" && a.onRecover && (
              <button
                type="button"
                onClick={stop(() => a.onRecover?.(job))}
                disabled={retrying || deleting}
                className={`${iconButton} text-zinc-300 hover:text-white hover:bg-white/10`}
                title="Upload fresh media & reprocess"
                aria-label={`Recover media for ${job.title}`}
              >
                <UploadCloud className="w-3.5 h-3.5" />
              </button>
            )}
            {(job.status === "FAILED" || job.status === "PROCESSING") && (
              <button
                type="button"
                onClick={stop(() => a.onRetry(job.id))}
                disabled={retrying || deleting}
                className={`${iconButton} text-zinc-400 hover:text-white hover:bg-white/10`}
                title="Retry pipeline job now"
                aria-label={`Retry ${job.title}`}
              >
                <RotateCcw
                  className={`w-3.5 h-3.5 ${retrying ? "animate-spin text-white" : ""}`}
                />
              </button>
            )}
            <button
              type="button"
              onClick={stop(() => a.onDelete(job.id))}
              disabled={deleting}
              className={`${iconButton} text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10`}
              title="Delete job & wipe cloud storage"
              aria-label={`Delete job ${job.title}`}
            >
              <Trash2
                className={`w-3.5 h-3.5 ${deleting ? "animate-spin text-rose-400" : ""}`}
              />
            </button>
          </div>
        );
      },
    },
  ];
}

export function deletionColumns(
  a: JobRowActions,
): ColumnDef<DeleteJobProgress>[] {
  return [
    {
      id: "entityTitle",
      accessorFn: (j) => j.entityTitle || "Untitled Entity",
      header: "Entity",
      cell: ({ row }) => (
        <div className="min-w-0">
          <p className="font-bold text-white truncate max-w-[180px]">
            {row.original.entityTitle || "Untitled Entity"}
          </p>
          <p className="text-[11px] text-zinc-500 font-mono truncate max-w-[180px]">
            ID: {row.original.entityId}
          </p>
        </div>
      ),
    },
    {
      id: "entityType",
      accessorFn: (j) => j.entityType,
      header: "Type",
      cell: ({ getValue }) => (
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/5 text-zinc-300 border border-white/10">
          {getValue<string>()}
        </span>
      ),
    },
    {
      id: "status",
      accessorFn: (j) => j.status,
      header: "Status",
      cell: ({ row }) => <StatusCell status={row.original.status} />,
    },
    {
      id: "currentStage",
      accessorFn: (j) => j.currentStage,
      header: "Current Stage",
      cell: ({ row }) => (
        <StageCell badge={getDeleteStageBadge(row.original.currentStage)} />
      ),
    },
    {
      id: "attempts",
      accessorFn: (j) => `${j.attemptCount ?? 0} / ${j.maxAttempts ?? 3}`,
      header: "Attempts",
      enableSorting: false,
      meta: { cellClassName: "text-zinc-400 font-mono" },
    },
    {
      id: "s3DurationMs",
      accessorFn: (j) => j.s3DurationMs ?? 0,
      header: "S3 Purge",
      meta: {
        cellClassName: "text-zinc-400 font-mono",
        csv: (j) => formatMs(j.s3DurationMs),
      },
      cell: ({ row }) => formatMs(row.original.s3DurationMs),
    },
    {
      id: "totalDurationMs",
      accessorFn: (j) => j.totalDurationMs ?? 0,
      header: "Total Time",
      meta: {
        cellClassName: "font-bold text-white font-mono",
        csv: (j) => formatMs(j.totalDurationMs),
      },
      cell: ({ row }) => formatMs(row.original.totalDurationMs),
    },
    created as ColumnDef<DeleteJobProgress>,
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      enableSorting: false,
      enableHiding: false,
      meta: {
        csv: false,
        label: "Actions",
        headerClassName: "text-right",
        cellClassName: "text-right",
      },
      cell: ({ row }) => {
        const job = row.original;
        const retrying = a.retryingId === job.id;
        const deleting = a.deletingId === job.id;
        return (
          <div className="flex items-center justify-end gap-1.5">
            {job.status === "FAILED" && (
              <button
                type="button"
                onClick={stop(() => a.onRetry(job.id))}
                disabled={retrying || deleting}
                className={`${iconButton} text-zinc-400 hover:text-white hover:bg-white/10`}
                title="Retry cascade delete job"
                aria-label={`Retry delete of ${job.entityTitle ?? job.entityId}`}
              >
                <RotateCcw
                  className={`w-4 h-4 ${retrying ? "animate-spin text-white" : ""}`}
                />
              </button>
            )}
            <button
              type="button"
              onClick={stop(() => a.onDelete(job.id))}
              disabled={deleting}
              className={`${iconButton} text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10`}
              title="Delete cascade delete audit record"
              aria-label={`Delete record for ${job.entityTitle ?? job.entityId}`}
            >
              <Trash2
                className={`w-4 h-4 ${deleting ? "animate-spin text-rose-400" : ""}`}
              />
            </button>
          </div>
        );
      },
    },
  ];
}
