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
    <div className="bg-[#121215] rounded-2xl border border-white/[0.08] p-6 shadow-sm">
      <div className="flex items-center justify-between mb-5 pb-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-black border border-white/[0.1] text-white">
            <Cpu className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Pipeline Jobs</h2>
            <p className="text-xs text-zinc-400">Audio transcoding &amp; analysis status</p>
          </div>
        </div>
        <Link
          href="/jobs"
          className="text-xs font-bold text-zinc-300 hover:text-white flex items-center gap-1 transition-colors"
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
        <div className="space-y-2">
          {jobs.map((job) => {
            const statusConfig = {
              COMPLETED: {
                badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/25",
                dot: "bg-emerald-400",
                label: "Completed",
              },
              PROCESSING: {
                badge: "bg-indigo-500/10 text-indigo-400 border-indigo-500/25",
                dot: "bg-indigo-400 animate-pulse",
                label: "Processing",
              },
              PENDING: {
                badge: "bg-amber-500/10 text-amber-400 border-amber-500/25",
                dot: "bg-amber-400",
                label: "Queued",
              },
              FAILED: {
                badge: "bg-rose-500/10 text-rose-400 border-rose-500/25",
                dot: "bg-rose-400",
                label: "Failed",
              },
            }[job.status] || {
              badge: "bg-zinc-800/40 text-zinc-400 border-zinc-700/40",
              dot: "bg-zinc-500",
              label: job.status,
            };

            return (
              <Link
                key={job.id}
                href="/jobs"
                className="flex items-center justify-between p-2.5 rounded-xl bg-[#141418] hover:bg-[#1a1a20] border border-white/[0.06] hover:border-white/[0.14] transition-all group"
              >
                <div className="min-w-0 pr-3">
                  <p className="font-bold text-white text-xs truncate group-hover:text-indigo-300 transition-colors">
                    {job.title}
                  </p>
                  <p className="text-[11px] text-zinc-400 truncate flex items-center gap-1.5 mt-0.5">
                    <span>
                      {job.artistName} {job.isVideoReprocess ? "• Canvas Reprocess" : ""}
                    </span>
                    {job.currentStage && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-white/[0.06] border border-white/[0.08] font-mono font-semibold text-zinc-300">
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
                  className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${statusConfig.badge}`}
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
