"use client";

import { RefreshCw } from "lucide-react";

interface DashboardHeaderProps {
  onRefresh: () => void;
  loading: boolean;
  refreshing: boolean;
}

export function DashboardHeader({ onRefresh, loading, refreshing }: DashboardHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#282828]">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-white">
            System Overview
          </h1>
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live
          </span>
        </div>
        <p className="text-zinc-400 mt-1 text-sm md:text-base">
          Real-time analytics and management across your entire audio infrastructure.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={onRefresh}
          disabled={loading || refreshing}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold text-black bg-white hover:bg-zinc-200 transition-all active:scale-[0.98] shadow-sm disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          <span>{refreshing ? "Refreshing..." : "Refresh"}</span>
        </button>
      </div>
    </div>
  );
}
