"use client";

import { Database, RotateCcw, Trash2, Workflow, Zap } from "lucide-react";
import { JOBS_REFRESH_MS } from "@/lib/queries/jobs";

export type JobsTab = "INGESTION" | "DELETION";

const tabBtn = (active: boolean) =>
  `flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
    active
      ? "bg-white text-black font-bold shadow-sm"
      : "text-zinc-400 hover:text-white"
  }`;

export function JobsHeader({
  tab,
  onTabChange,
  activeCount,
  live,
  onLiveChange,
  refreshing,
  onRefresh,
  onSyncMetadata,
  syncing,
}: {
  tab: JobsTab;
  onTabChange: (tab: JobsTab) => void;
  activeCount: number;
  live: boolean;
  onLiveChange: (live: boolean) => void;
  refreshing: boolean;
  onRefresh: () => void;
  /** Left out when the current role may not sync metadata. */
  onSyncMetadata?: () => void;
  syncing: boolean;
}) {
  const ingestion = tab === "INGESTION";
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-white/8">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            {ingestion ? (
              <div className="w-8 h-8 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <Zap className="w-4 h-4 fill-indigo-400" />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
                <Trash2 className="w-4 h-4" />
              </div>
            )}
            {ingestion ? "Song Ingestion Pipeline" : "Cascade Delete Pipeline"}
          </h1>
          {activeCount > 0 && (
            <span
              className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border animate-pulse ${
                ingestion
                  ? "bg-indigo-500/15 text-indigo-300 border-indigo-500/30"
                  : "bg-rose-500/15 text-rose-300 border-rose-500/30"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${ingestion ? "bg-indigo-400" : "bg-rose-400"}`}
              />
              {activeCount} active
            </span>
          )}
        </div>
        <p className="text-zinc-400 text-xs mt-1.5 leading-relaxed">
          {ingestion
            ? "Real-time telemetry, stage execution latency, DAG transitions, and webhook logs for audio & canvas transcoding."
            : "End-to-end cascade deletion tracking across Algolia, Recombee, ImageKit CDN, AWS S3, and PostgreSQL with 1-click retry."}
        </p>
      </div>

      <div className="flex items-center gap-2.5 flex-wrap">
        <div
          className="flex bg-[#121215] p-1 rounded-xl border border-white/8"
          role="tablist"
        >
          <button
            type="button"
            role="tab"
            aria-selected={ingestion}
            onClick={() => onTabChange("INGESTION")}
            className={tabBtn(ingestion)}
          >
            <Workflow className="w-3.5 h-3.5" />
            <span>Ingestion</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={!ingestion}
            onClick={() => onTabChange("DELETION")}
            className={tabBtn(!ingestion)}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Cascade Delete</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => onLiveChange(!live)}
          aria-pressed={live}
          title="Refreshes while this tab is visible and pauses when it is hidden"
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 border cursor-pointer ${
            live
              ? "bg-white/10 text-white border-white/20"
              : "bg-[#141418] text-zinc-400 border-white/8"
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${live ? "bg-white animate-ping" : "bg-zinc-600"}`}
          />
          <span>{live ? `Live ${JOBS_REFRESH_MS / 1000}s` : "Paused"}</span>
        </button>

        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          aria-label="Refresh metrics now"
          title="Refresh metrics now"
          className="p-2 rounded-xl bg-[#141418] hover:bg-[#1a1a20] border border-white/8 hover:border-white/14 text-zinc-400 hover:text-white transition-all disabled:opacity-50 cursor-pointer"
        >
          <RotateCcw
            className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-white" : ""}`}
          />
        </button>

        {onSyncMetadata && (
          <button
            type="button"
            onClick={onSyncMetadata}
            disabled={syncing || refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#141418] hover:bg-[#1a1a20] border border-white/8 hover:border-white/14 text-zinc-300 hover:text-white transition-all disabled:opacity-50 cursor-pointer"
            title="Reconcile pagination metadata with actual PostgreSQL rows and flush caches"
          >
            <Database
              className={`w-3.5 h-3.5 text-zinc-400 ${syncing ? "animate-spin text-white" : ""}`}
            />
            <span>{syncing ? "Syncing..." : "Sync DB"}</span>
          </button>
        )}
      </div>
    </div>
  );
}
