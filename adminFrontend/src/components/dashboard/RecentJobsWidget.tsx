"use client";

import Link from "next/link";
import { Cpu, ArrowUpRight } from "lucide-react";
import { Job } from "@/lib/api";
import { SkeletonCard } from "@/components/SkeletonCard";

interface RecentJobsWidgetProps {
  jobs: Job[] | undefined;
  loading: boolean;
}

export function RecentJobsWidget({ jobs, loading }: RecentJobsWidgetProps) {
  return (
    <div className="bg-[#121212] rounded-2xl border border-[#282828] p-6 shadow-sm">
      <div className="flex items-center justify-between mb-5 pb-4 border-b border-[#282828]">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-zinc-900 border border-[#282828] text-white">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Pipeline Jobs</h2>
            <p className="text-xs text-zinc-400">Audio transcoding & analysis status</p>
          </div>
        </div>
        <Link
          href="/jobs"
          className="text-xs font-bold text-white hover:underline flex items-center gap-1"
        >
          <span>View Telemetry</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {loading ? (
        <SkeletonCard variant="activity" count={5} />
      ) : !jobs || jobs.length === 0 ? (
        <div className="py-12 text-center text-zinc-500 text-sm">
          <Cpu className="w-8 h-8 mx-auto mb-2 opacity-40" />
          No background jobs active or recorded.
        </div>
      ) : (
        <div className="space-y-2.5">
          {jobs.map((job) => {
            const statusConfig = {
              COMPLETED: {
                badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
                dot: "bg-emerald-500",
                label: "Completed",
              },
              PROCESSING: {
                badge: "bg-blue-500/10 text-blue-400 border-blue-500/20",
                dot: "bg-blue-500 animate-pulse",
                label: "Processing",
              },
              PENDING: {
                badge: "bg-amber-500/10 text-amber-400 border-amber-500/20",
                dot: "bg-amber-500",
                label: "Pending",
              },
              FAILED: {
                badge: "bg-rose-500/10 text-rose-400 border-rose-500/20",
                dot: "bg-rose-500",
                label: "Failed",
              },
            }[job.status] || {
              badge: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
              dot: "bg-zinc-500",
              label: job.status,
            };

            return (
              <Link
                key={job.id}
                href="/jobs"
                className="flex items-center justify-between p-3 rounded-xl bg-black/50 border border-[#282828] hover:border-zinc-700 hover:bg-[#181818] transition-all"
              >
                <div className="min-w-0 pr-3">
                  <p className="font-semibold text-white text-sm truncate">
                    {job.title}
                  </p>
                  <p className="text-xs text-zinc-400 truncate flex items-center gap-1.5 mt-0.5">
                    <span>
                      {job.artistName} {job.isVideoReprocess ? "• Video Reprocess" : ""}
                    </span>
                    {job.currentStage && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 border border-[#282828] font-mono font-semibold text-zinc-300">
                        {job.currentStage}
                      </span>
                    )}
                    {job.transcodingAttempt != null && job.transcodingAttempt > 1 && (
                      <span className="text-[10px] text-amber-400 font-bold">
                        ⚠️ #{job.transcodingAttempt}
                      </span>
                    )}
                  </p>
                </div>

                <span
                  className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${statusConfig.badge}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`} />
                  {statusConfig.label}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
