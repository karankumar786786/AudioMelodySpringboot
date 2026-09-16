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
      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Status:</span>
          {["ALL", "QUEUED", "PROCESSING", "COMPLETED", "FAILED"].map((s) => (
            <button
              key={s}
              onClick={() => onStatusFilterChange(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border cursor-pointer ${
                statusFilter === s
                  ? "bg-white text-black border-white shadow-sm"
                  : "bg-black/60 text-zinc-400 border-[#282828] hover:text-white hover:border-zinc-500"
              }`}
            >
              {s}
            </button>
          ))}

          <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 ml-3">Type:</span>
          {["ALL", "SONG", "PLAYLIST", "ARTIST"].map((t) => (
            <button
              key={t}
              onClick={() => onTypeFilterChange(t)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border cursor-pointer ${
                typeFilter === t
                  ? "bg-white text-black border-white shadow-sm"
                  : "bg-black/60 text-zinc-400 border-[#282828] hover:text-white hover:border-zinc-500"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Search title, entity ID, job ID..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-[#121212] border border-[#282828] rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-400 transition-all"
          />
        </div>
      </div>

      {/* Delete Jobs Table */}
      <div className="bg-[#121212] border border-[#282828] rounded-3xl overflow-hidden shadow-sm">
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
                <TableSkeleton columns={9} rows={5} variant="audit" />
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

                  return (
                    <tr
                      key={job.id}
                      onClick={() => onSelectJob(job)}
                      className="hover:bg-zinc-800/30 transition-colors cursor-pointer group"
                    >
                      <td className="py-3 px-4 font-sans">
                        <div className="min-w-0">
                          <div className="font-bold text-white truncate max-w-[220px] group-hover:text-rose-400 transition-colors">
                            {job.entityTitle || "Untitled Entity"}
                          </div>
                          <div className="text-[11px] text-zinc-500 font-mono truncate max-w-[220px]">
                            {job.entityId}
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 font-sans">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-black/60 border border-[#282828] text-zinc-300">
                          {job.entityType}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-sans font-bold border ${statusBadge.bg} ${statusBadge.text}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${statusBadge.dot}`} />
                          {statusBadge.label}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-sans font-bold border ${stageBadge.bg}`}
                        >
                          {stageBadge.label}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-zinc-300">
                        {job.attemptCount > 1 ? (
                          <span className="font-bold text-amber-400">#{job.attemptCount}</span>
                        ) : (
                          "#1"
                        )}
                        <span className="text-[10px] text-zinc-500"> / {job.maxAttempts}</span>
                      </td>

                      <td className="py-3 px-4 text-zinc-300">{formatMs(job.s3DurationMs)}</td>

                      <td className="py-3 px-4 font-bold text-white">
                        {formatMs(job.totalDurationMs || job.elapsedTotalMs)}
                      </td>

                      <td className="py-3 px-4 text-zinc-400 text-[11px]">{formatTime(job.createdAt)}</td>

                      <td className="py-3 px-4 text-right font-sans">
                        <div className="flex items-center justify-end gap-2">
                          {job.status === "FAILED" && (
                            <button
                              onClick={(e) => onRetryJob(job.id, e)}
                              disabled={isRetrying}
                              className="px-2.5 py-1 bg-rose-500/10 text-rose-400 hover:bg-rose-600 hover:text-white border border-rose-500/30 font-bold text-[11px] rounded-lg transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                              title="1-Click Retry"
                            >
                              <RotateCcw className={`w-3 h-3 ${isRetrying ? "animate-spin" : ""}`} />
                              Retry
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectJob(job);
                            }}
                            className="px-3 py-1 bg-black/60 hover:bg-white hover:text-black border border-[#282828] text-zinc-300 font-bold text-[11px] rounded-lg transition-all cursor-pointer"
                          >
                            Details
                          </button>
                          <button
                            onClick={(e) => onDeleteJob(job.id, e)}
                            disabled={deletingJobId === job.id}
                            className="p-1.5 bg-rose-500/10 text-rose-400 hover:bg-rose-600 hover:text-white border border-rose-500/20 rounded-lg transition-all cursor-pointer disabled:opacity-50"
                            title="Delete Audit Record"
                          >
                            <Trash2 className={`w-3.5 h-3.5 ${deletingJobId === job.id ? "animate-pulse" : ""}`} />
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

        {/* Cascade Delete Table Pagination Bar */}
        <PaginationBar
          page={page}
          pageSize={pageSize}
          totalItems={totalJobsCount}
          currentCount={jobs.length}
          itemLabel="audit records"
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
          loading={loading}
        />
      </div>
    </div>
  );
}
