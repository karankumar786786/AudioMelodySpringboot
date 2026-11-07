"use client";

import React from "react";
import Image from "next/image";
import { JobProgress } from "@/lib/api";
import { getImageUrl } from "@/lib/image-utils";
import { ChevronRight, Cpu } from "lucide-react";
import { formatMs, getStageBadge } from "./jobHelpers";

export interface ActiveJobsLiveMonitorProps {
  activeJobs: JobProgress[];
  onSelectJob: (job: JobProgress) => void;
}

export function ActiveJobsLiveMonitor({
  activeJobs,
  onSelectJob,
}: ActiveJobsLiveMonitorProps) {
  if (activeJobs.length === 0) return null;

  return (
    <div className="p-6 rounded-2xl bg-[#0f0f13] border border-indigo-500/25 shadow-lg shadow-indigo-950/20 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500" />
          </span>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            Actively In Flight ({activeJobs.length})
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              Live Workers
            </span>
          </h3>
        </div>
        <span className="text-xs text-zinc-400 font-mono">
          Real-time cluster telemetry
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {activeJobs.map((job) => {
          const stageBadge = getStageBadge(job.currentStage);
          return (
            <div
              key={job.id}
              onClick={() => onSelectJob(job)}
              className="p-4 rounded-xl bg-[#141418] border border-white/8 shadow-sm cursor-pointer hover:border-indigo-500/40 hover:bg-[#191920] transition-all space-y-3 group"
            >
              <div className="flex items-center gap-3">
                <div className="relative w-11 h-11 rounded-xl overflow-hidden bg-black shrink-0 border border-white/10">
                  {job.imageKey ? (
                    <Image
                      src={getImageUrl(job.imageKey, { width: 100, height: 100 })}
                      alt={job.title}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs font-bold text-zinc-500">
                      IMG
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="font-bold text-xs text-white truncate group-hover:text-indigo-300 transition-colors">
                    {job.title}
                  </h4>
                  <p className="text-[11px] text-zinc-400 truncate">
                    {job.artistName}
                  </p>
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${stageBadge.bg}`}
                >
                  {stageBadge.label}
                </span>
              </div>

              <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono pt-2 border-t border-white/6">
                <span className="flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-zinc-500" />
                  <span>{formatMs(job.elapsedTotalMs)}</span>
                </span>
                {job.transcodingAttempt > 1 && (
                  <span className="text-amber-400 font-bold">
                    Attempt #{job.transcodingAttempt}
                  </span>
                )}
                <ChevronRight className="w-3.5 h-3.5 text-zinc-600 group-hover:text-white transition-colors" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
