"use client";

import { RefreshCw, Activity } from "lucide-react";

interface DashboardHeaderProps {
  onRefresh: () => void;
  loading: boolean;
  refreshing: boolean;
}

export function DashboardHeader({ onRefresh, loading, refreshing }: DashboardHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white flex items-center gap-2.5">
            Mission Control HUD
          </h1>
          <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Live Cluster</span>
          </span>
        </div>
        <p className="text-zinc-400 mt-1 text-xs md:text-sm leading-relaxed">
          Real-time catalog telemetry, media transcoding pipeline flow &amp; distributed system health.
        </p>
      </div>

      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading || refreshing}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-black bg-white hover:bg-zinc-200 transition-all active:scale-[0.98] shadow-sm disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          <span>{refreshing ? "Refreshing..." : "Sync Metrics"}</span>
        </button>
      </div>
    </div>
  );
}
