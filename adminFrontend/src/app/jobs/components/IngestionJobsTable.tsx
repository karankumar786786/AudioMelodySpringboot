"use client";

import React from "react";
import Image from "next/image";
import { JobProgress } from "@/lib/api";
import { getImageUrl } from "@/lib/image-utils";
import {
  Search,
  Trash2,
  UploadCloud,
  RotateCcw,
} from "lucide-react";
import { formatMs, formatTime, getStageBadge, getStatusBadge } from "./jobHelpers";
import { TableSkeleton } from "@/components/TableSkeleton";
import { PaginationBar } from "@/components/PaginationBar";

export interface IngestionJobsTableProps {
  jobs: JobProgress[];
  loading: boolean;
  searchQuery: string;
  onSearchChange: (search: string) => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  onPurgeAllFailed: () => void;
  isPurgingFailed: boolean;
  onSelectJob: (job: JobProgress) => void;
  onRetryJob: (jobId: string, e?: React.MouseEvent) => void;
  retryingJobId: string | null;
  onOpenRecoverModal: (job: JobProgress, e?: React.MouseEvent) => void;
  onDeleteJob: (jobId: string, e?: React.MouseEvent) => void;
  deletingJobId: string | null;
  page: number;
  pageSize: number;
  totalJobsCount: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

export function IngestionJobsTable({
  jobs,
  loading,
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  onPurgeAllFailed,
  isPurgingFailed,
  onSelectJob,
  onRetryJob,
  retryingJobId,
  onOpenRecoverModal,
  onDeleteJob,
  deletingJobId,
  page,
  pageSize,
  totalJobsCount,
  onPageChange,
  onPageSizeChange,
}: IngestionJobsTableProps) {
  const hasFailedJobs = jobs.some((j) => j.status === "FAILED");

  return (
    <div className="space-y-4">
      {/* Table Filters & Purge Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {["ALL", "PENDING", "PROCESSING", "COMPLETED", "FAILED"].map((s) => {
            const isActive = statusFilter === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => onStatusFilterChange(s)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? "bg-white text-black font-bold shadow-sm"
                    : "bg-[#141418] text-zinc-400 hover:text-white hover:bg-[#1a1a20] border border-white/[0.08]"
                }`}
              >
                {s === "ALL" ? "All Jobs" : s}
              </button>
            );
          })}

          {/* Bulk Purge Failed Jobs */}
          {hasFailedJobs && (
            <button
              type="button"
              onClick={onPurgeAllFailed}
              disabled={isPurgingFailed}
              className="ml-2 px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/25 hover:bg-rose-500/20 transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{isPurgingFailed ? "Purging..." : "Purge All Failed"}</span>
            </button>
          )}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Search song, artist, job ID..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-[#121215] border border-white/[0.08] hover:border-white/[0.14] focus:border-white/30 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none transition-all"
          />
        </div>
      </div>

      {/* Ingestion Jobs Table */}
      <div className="relative bg-[#121215] border border-white/[0.08] rounded-2xl overflow-hidden shadow-sm">
        {/* Top Animated Pulse Line during page/filter transitions */}
        {loading && (
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-500 via-indigo-500 to-cyan-400 animate-pulse z-20" />
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0e0e11] border-b border-white/[0.08] text-zinc-400 uppercase font-bold tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Song / Target</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Current Stage</th>
                <th className="py-3 px-4">Attempt</th>
                <th className="py-3 px-4">Transcoding</th>
                <th className="py-3 px-4">Total Time</th>
                <th className="py-3 px-4">Created At</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06] font-mono">
              {loading ? (
                <TableSkeleton columns={8} rows={Math.min(pageSize, 8)} variant="job" />
              ) : jobs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-zinc-500 font-sans">
                    No ingestion jobs found matching filter criteria.
                  </td>
                </tr>
              ) : (
                jobs.map((job) => {
                  const statusBadge = getStatusBadge(job.status);
                  const stageBadge = getStageBadge(job.currentStage);
                  const isRetrying = retryingJobId === job.id;
                  const isDeleting = deletingJobId === job.id;

                  return (
                    <tr
                      key={job.id}
                      onClick={() => onSelectJob(job)}
                      className="hover:bg-white/[0.03] cursor-pointer transition-colors group"
                    >
                      {/* Song details */}
                      <td className="py-3 px-4 font-sans">
                        <div className="flex items-center gap-3">
                          <div className="relative w-8 h-8 rounded-lg overflow-hidden bg-black border border-white/[0.1] shrink-0">
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
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 font-sans">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${statusBadge.bg}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${statusBadge.dot}`} />
                          {statusBadge.label}
                        </span>
                      </td>

                      {/* Stage */}
                      <td className="py-3 px-4 font-sans">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${stageBadge.bg}`}
                        >
                          {stageBadge.label}
                        </span>
                      </td>

                      {/* Attempts */}
                      <td className="py-3 px-4 text-zinc-400 tabular-nums">
                        {job.transcodingAttempt ?? 1}
                      </td>

                      {/* Transcode Duration */}
                      <td className="py-3 px-4 text-zinc-400 tabular-nums">
                        {formatMs(job.transcodingDurationMs)}
                      </td>

                      {/* Total Duration */}
                      <td className="py-3 px-4 font-bold text-white tabular-nums">
                        {formatMs(job.totalDurationMs)}
                      </td>

                      {/* Created At */}
                      <td className="py-3 px-4 text-zinc-500 text-[11px] tabular-nums">
                        {formatTime(job.createdAt)}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {job.status === "FAILED" && (
                            <button
                              type="button"
                              onClick={(e) => onOpenRecoverModal(job, e)}
                              disabled={isRetrying || isDeleting}
                              className="p-1.5 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded-lg transition-colors cursor-pointer"
                              title="Upload fresh media & reprocess"
                            >
                              <UploadCloud className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {(job.status === "FAILED" || job.status === "PROCESSING") && (
                            <button
                              type="button"
                              onClick={(e) => onRetryJob(job.id, e)}
                              disabled={isRetrying || isDeleting}
                              className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                              title="Retry pipeline job now"
                            >
                              <RotateCcw className={`w-3.5 h-3.5 ${isRetrying ? "animate-spin text-white" : ""}`} />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={(e) => onDeleteJob(job.id, e)}
                            disabled={isDeleting}
                            className="p-1.5 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                            title="Delete job & wipe cloud storage"
                          >
                            <Trash2 className={`w-3.5 h-3.5 ${isDeleting ? "animate-spin text-rose-400" : ""}`} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Ingestion Table Pagination Bar */}
        <PaginationBar
          page={page}
          pageSize={pageSize}
          totalItems={totalJobsCount}
          currentCount={jobs.length}
          itemLabel="ingestion jobs"
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
          loading={loading}
        />
      </div>
    </div>
  );
}
