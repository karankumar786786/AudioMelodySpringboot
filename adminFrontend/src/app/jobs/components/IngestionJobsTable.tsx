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
  return (
    <div className="space-y-4">
      {/* Filters & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Filter Status:</span>
          {["ALL", "PROCESSING", "PENDING", "COMPLETED", "FAILED"].map((s) => (
            <button
              key={s}
              onClick={() => onStatusFilterChange(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border cursor-pointer ${
                statusFilter === s
                  ? "bg-white text-black border-white shadow-sm"
                  : "bg-[#121212] text-zinc-400 border-[#282828] hover:text-white hover:border-zinc-700"
              }`}
            >
              {s}
            </button>
          ))}
          {statusFilter === "FAILED" && (
            <button
              onClick={onPurgeAllFailed}
              disabled={isPurgingFailed}
              className="ml-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all border bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-600 hover:text-white flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Trash2 className={`w-3.5 h-3.5 ${isPurgingFailed ? "animate-spin" : ""}`} />
              <span>{isPurgingFailed ? "Purging Failed Jobs..." : "Purge All Failed"}</span>
            </button>
          )}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Search song, artist, job ID..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-[#121212] border border-[#282828] rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white focus:ring-1 focus:ring-white/20 transition-all"
          />
        </div>
      </div>

      {/* Ingestion Jobs Table */}
      <div className="bg-[#121212] border border-[#282828] rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-black/60 border-b border-[#282828] text-zinc-400 uppercase font-bold tracking-wider text-[10px]">
              <tr>
                <th className="py-3.5 px-4">Song / Target</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Current Stage</th>
                <th className="py-3.5 px-4">Attempt</th>
                <th className="py-3.5 px-4">Transcoding</th>
                <th className="py-3.5 px-4">Total Time</th>
                <th className="py-3.5 px-4">Created At</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#282828] font-mono">
              {loading ? (
                <TableSkeleton columns={8} rows={5} variant="job" />
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

                  return (
                    <tr
                      key={job.id}
                      onClick={() => onSelectJob(job)}
                      className="hover:bg-[#181818] transition-colors cursor-pointer group"
                    >
                      <td className="py-3 px-4 font-sans">
                        <div className="flex items-center gap-3">
                          <div className="relative w-8 h-8 rounded-lg overflow-hidden bg-black shrink-0 border border-[#282828]">
                            {job.imageKey ? (
                              <Image
                                src={getImageUrl(job.imageKey, { width: 80, height: 80 })}
                                alt={job.title}
                                fill
                                className="object-cover"
                                unoptimized
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[9px] text-zinc-500">
                                IMG
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-white truncate max-w-[200px] group-hover:underline transition-colors">
                              {job.title}
                            </div>
                            <div className="text-[11px] text-zinc-400 truncate max-w-[200px]">
                              {job.artistName}
                            </div>
                          </div>
                        </div>
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

                      <td className="py-3 px-4 text-zinc-400">
                        {job.transcodingAttempt > 1 ? (
                          <span className="font-bold text-amber-400">#{job.transcodingAttempt}</span>
                        ) : (
                          "#1"
                        )}
                      </td>

                      <td className="py-3 px-4 text-zinc-400">{formatMs(job.transcodingDurationMs)}</td>

                      <td className="py-3 px-4 font-bold text-white">
                        {formatMs(job.totalDurationMs || job.elapsedTotalMs)}
                      </td>

                      <td className="py-3 px-4 text-zinc-500 text-[11px]">{formatTime(job.createdAt)}</td>

                      <td className="py-3 px-4 text-right font-sans">
                        <div className="flex items-center justify-end gap-2">
                          {job.status === "FAILED" && (
                            <>
                              <button
                                onClick={(e) => onOpenRecoverModal(job, e)}
                                className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-600 hover:text-white border border-emerald-500/30 font-bold text-[11px] rounded-lg transition-all flex items-center gap-1 shadow-sm cursor-pointer"
                                title="Upload replacement audio/video and recover job"
                              >
                                <UploadCloud className="w-3 h-3" />
                                Recover
                              </button>
                              <button
                                onClick={(e) => onRetryJob(job.id, e)}
                                disabled={retryingJobId === job.id}
                                className="px-2.5 py-1 bg-amber-500/10 text-amber-400 hover:bg-amber-600 hover:text-white border border-amber-500/30 font-bold text-[11px] rounded-lg transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                title="1-Click Retry Ingestion"
                              >
                                <RotateCcw
                                  className={`w-3 h-3 ${retryingJobId === job.id ? "animate-spin" : ""}`}
                                />
                                Retry
                              </button>
                            </>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectJob(job);
                            }}
                            className="px-3 py-1 bg-black/60 hover:bg-white hover:text-black border border-[#282828] text-zinc-300 font-bold text-[11px] rounded-lg transition-all cursor-pointer"
                          >
                            View Stages
                          </button>
                          <button
                            onClick={(e) => onDeleteJob(job.id, e)}
                            disabled={deletingJobId === job.id}
                            className="p-1.5 bg-rose-500/10 text-rose-400 hover:bg-rose-600 hover:text-white border border-rose-500/20 rounded-lg transition-all cursor-pointer disabled:opacity-50"
                            title="Delete Job & Purge Cloud Artifacts"
                          >
                            <Trash2 className={`w-3.5 h-3.5 ${deletingJobId === job.id ? "animate-spin" : ""}`} />
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
          itemLabel="jobs"
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
          loading={loading}
        />
      </div>
    </div>
  );
}
