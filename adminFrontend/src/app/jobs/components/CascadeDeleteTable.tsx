"use client";

import React from "react";
import { DeleteJobProgress } from "@/lib/api";
import { Search, RotateCcw, Trash2 } from "lucide-react";
import { formatMs, formatTime, getDeleteStageBadge, getStatusBadge } from "./jobHelpers";
import { TableSkeleton } from "@/components/TableSkeleton";
import { PaginationBar } from "@/components/PaginationBar";

export interface CascadeDeleteTableProps {
  jobs: DeleteJobProgress[];
  loading: boolean;
  searchQuery: string;
  onSearchChange: (search: string) => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  typeFilter: string;
  onTypeFilterChange: (type: string) => void;
  onSelectJob: (job: DeleteJobProgress) => void;
  onRetryJob: (jobId: string, e?: React.MouseEvent) => void;
  retryingJobId: string | null;
  onDeleteJob: (jobId: string, e?: React.MouseEvent) => void;
  deletingJobId: string | null;
  page: number;
  pageSize: number;
  totalJobsCount: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

export function CascadeDeleteTable({
  jobs,
  loading,
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  typeFilter,
  onTypeFilterChange,
  onSelectJob,
  onRetryJob,
  retryingJobId,
  onDeleteJob,
  deletingJobId,
  page,
  pageSize,
  totalJobsCount,
  onPageChange,
  onPageSizeChange,
}: CascadeDeleteTableProps) {
  return (
    <div className="space-y-4">
      {/* Table Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {/* Status filter */}
          <div className="flex items-center bg-black/50 p-1 rounded-full border border-[#282828] text-xs">
            {["ALL", "PENDING", "PROCESSING", "COMPLETED", "FAILED"].map((s) => (
              <button
                key={s}
                onClick={() => onStatusFilterChange(s)}
                className={`px-3 py-1 rounded-full font-bold transition-all ${
                  statusFilter === s
                    ? "bg-white text-black shadow-sm"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                {s === "ALL" ? "All Status" : s}
              </button>
            ))}
          </div>

          {/* Entity type filter */}
          <div className="flex items-center bg-black/50 p-1 rounded-full border border-[#282828] text-xs">
            {["ALL", "SONG", "ARTIST", "ALBUM"].map((t) => (
              <button
                key={t}
                onClick={() => onTypeFilterChange(t)}
                className={`px-3 py-1 rounded-full font-bold transition-all ${
                  typeFilter === t
                    ? "bg-white text-black shadow-sm"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                {t === "ALL" ? "All Types" : t}
              </button>
            ))}
          </div>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Search entity ID, title, job ID..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-[#121212] border border-[#282828] rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white focus:ring-1 focus:ring-white/20 transition-all"
          />
        </div>
      </div>

      {/* Cascade Delete Table */}
      <div className="relative bg-[#121212] border border-[#282828] rounded-3xl overflow-hidden shadow-sm">
        {/* Top Animated Pulse Line during page/filter transitions */}
        {loading && (
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-500 via-indigo-500 to-emerald-400 animate-pulse z-20" />
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-black/60 border-b border-[#282828] text-zinc-400 uppercase font-bold tracking-wider text-[10px]">
              <tr>
                <th className="py-3.5 px-4">Entity</th>
                <th className="py-3.5 px-4">Type</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Current Stage</th>
                <th className="py-3.5 px-4">Attempts</th>
                <th className="py-3.5 px-4">S3 Purge</th>
                <th className="py-3.5 px-4">Total Time</th>
                <th className="py-3.5 px-4">Created At</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#282828] font-mono">
              {loading ? (
                <TableSkeleton columns={9} rows={Math.min(pageSize, 8)} variant="audit" />
              ) : jobs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-zinc-500 font-sans">
                    No cascade delete jobs found matching filter criteria.
                  </td>
                </tr>
              ) : (
                jobs.map((job) => {
                  const statusBadge = getStatusBadge(job.status);
                  const stageBadge = getDeleteStageBadge(job.currentStage);
                  const isRetrying = retryingJobId === job.id;
                  const isDeleting = deletingJobId === job.id;

                  return (
                    <tr
                      key={job.id}
                      onClick={() => onSelectJob(job)}
                      className="hover:bg-zinc-800/20 cursor-pointer transition-colors"
                    >
                      {/* Entity details */}
                      <td className="py-3 px-4 font-sans">
                        <div className="min-w-0">
                          <p className="font-bold text-white truncate max-w-[180px]">
                            {job.entityTitle || "Untitled Entity"}
                          </p>
                          <p className="text-[11px] text-zinc-500 font-mono truncate max-w-[180px]">
                            ID: {job.entityId}
                          </p>
                        </div>
                      </td>

                      {/* Entity Type */}
                      <td className="py-3 px-4 font-sans">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/5 text-zinc-300 border border-white/10">
                          {job.entityType}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 font-sans">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${statusBadge.bg}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${statusBadge.dot}`} />
                          {statusBadge.label}
                        </span>
                      </td>

                      {/* Stage */}
                      <td className="py-3 px-4 font-sans">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold border ${stageBadge.bg}`}
                        >
                          {stageBadge.label}
                        </span>
                      </td>

                      {/* Attempts */}
                      <td className="py-3 px-4 text-zinc-400">
                        {job.attemptCount ?? 0} / {job.maxAttempts ?? 3}
                      </td>

                      {/* S3 Purge Duration */}
                      <td className="py-3 px-4 text-zinc-400">
                        {formatMs(job.s3DurationMs)}
                      </td>

                      {/* Total Duration */}
                      <td className="py-3 px-4 font-bold text-white">
                        {formatMs(job.totalDurationMs)}
                      </td>

                      {/* Created At */}
                      <td className="py-3 px-4 text-zinc-500 text-[11px]">
                        {formatTime(job.createdAt)}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {job.status === "FAILED" && (
                            <button
                              onClick={(e) => onRetryJob(job.id, e)}
                              disabled={isRetrying || isDeleting}
                              className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                              title="Retry cascade delete job"
                            >
                              <RotateCcw className={`w-4 h-4 ${isRetrying ? "animate-spin text-white" : ""}`} />
                            </button>
                          )}
                          <button
                            onClick={(e) => onDeleteJob(job.id, e)}
                            disabled={isDeleting}
                            className="p-1.5 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                            title="Delete cascade delete audit record"
                          >
                            <Trash2 className={`w-4 h-4 ${isDeleting ? "animate-spin text-rose-400" : ""}`} />
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

        {/* Cascade Delete Table Pagination Bar with Loading Feedback */}
        <PaginationBar
          page={page}
          pageSize={pageSize}
          totalItems={totalJobsCount}
          currentCount={jobs.length}
          itemLabel="delete records"
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
          loading={loading}
        />
      </div>
    </div>
  );
}
