"use client";

import React from "react";
import { JobSummaryMetrics, DeleteJobSummaryMetrics } from "@/lib/api";
import {
  Activity,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Trash2,
  Cpu,
  Sparkles,
  Search,
  Database,
  Radio,
  CloudLightning,
  HardDrive,
  Workflow,
} from "lucide-react";
import { formatMs } from "./jobHelpers";

interface IngestionMetricsCardsProps {
  type: "INGESTION";
  metrics: JobSummaryMetrics | null;
  loading: boolean;
  onRefresh: () => void;
  isRefreshing: boolean;
}

interface DeletionMetricsCardsProps {
  type: "DELETION";
  metrics: DeleteJobSummaryMetrics | null;
  loading: boolean;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export type JobMetricsCardsProps = IngestionMetricsCardsProps | DeletionMetricsCardsProps;

export function JobMetricsCards(props: JobMetricsCardsProps) {
  const { type, metrics, loading } = props;

  // Render skeleton when loading without metrics yet
  if (loading && !metrics) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, idx) => (
            <div
              key={idx}
              className="animate-pulse p-5 rounded-2xl bg-[#121215] border border-white/[0.08] space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="h-3 w-16 bg-zinc-800 rounded" />
                <div className="w-8 h-8 rounded-xl bg-zinc-800" />
              </div>
              <div className="h-8 w-14 bg-zinc-800 rounded" />
              <div className="h-2.5 w-24 bg-zinc-800/60 rounded" />
            </div>
          ))}
        </div>
        <div className="animate-pulse p-6 rounded-2xl bg-[#121215] border border-white/[0.08] h-36" />
      </div>
    );
  }

  if (type === "INGESTION") {
    const ingMetrics = metrics as JobSummaryMetrics | null;
    return (
      <div className="space-y-4">
        {/* KPI Cards Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {/* Currently Processing */}
          <div className="p-5 rounded-2xl bg-[#121215] border border-white/[0.08] shadow-sm relative overflow-hidden group hover:border-indigo-500/40 hover:bg-[#16161c] transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                Processing
              </span>
              <div className="w-8 h-8 rounded-xl bg-black border border-white/[0.1] text-indigo-400 flex items-center justify-center">
                <Activity className="w-4 h-4 animate-pulse" />
              </div>
            </div>
            <div className="text-3xl font-bold text-white tabular-nums">
              {ingMetrics?.currentlyProcessing ?? 0}
            </div>
            <p className="text-[11px] text-zinc-400 mt-1">Active transcode &amp; sync</p>
          </div>

          {/* Queued / Pending */}
          <div className="p-5 rounded-2xl bg-[#121215] border border-white/[0.08] shadow-sm relative overflow-hidden hover:border-amber-500/40 hover:bg-[#16161c] transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                In Queue
              </span>
              <div className="w-8 h-8 rounded-xl bg-black border border-white/[0.1] text-amber-400 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-bold text-white tabular-nums">
              {ingMetrics?.pendingQueued ?? 0}
            </div>
            <p className="text-[11px] text-zinc-400 mt-1">Waiting for worker pick</p>
          </div>

          {/* Completed Successfully */}
          <div className="p-5 rounded-2xl bg-[#121215] border border-white/[0.08] shadow-sm relative overflow-hidden hover:border-emerald-500/40 hover:bg-[#16161c] transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                Completed
              </span>
              <div className="w-8 h-8 rounded-xl bg-black border border-white/[0.1] text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-bold text-white tabular-nums">
              {ingMetrics?.completed ?? 0}
            </div>
            <p className="text-[11px] text-zinc-400 mt-1">Finished &amp; indexed</p>
          </div>

          {/* Failed / Needs Attention */}
          <div
            className={`p-5 rounded-2xl border shadow-sm relative overflow-hidden transition-all ${
              (ingMetrics?.failed ?? 0) > 0
                ? "bg-rose-500/10 border-rose-500/25 text-rose-300"
                : "bg-[#121215] border-white/[0.08] text-zinc-300 hover:border-white/[0.14]"
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                Failed
              </span>
              <div
                className={`w-8 h-8 rounded-xl border flex items-center justify-center ${
                  (ingMetrics?.failed ?? 0) > 0
                    ? "bg-rose-500/20 border-rose-500/40 text-rose-400"
                    : "bg-black border-white/[0.1] text-zinc-500"
                }`}
              >
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-bold tabular-nums">
              {ingMetrics?.failed ?? 0}
            </div>
            <p className="text-[11px] text-zinc-400 mt-1">
              {(ingMetrics?.failed ?? 0) > 0
                ? "Requires retry or fix"
                : "Zero pipeline errors"}
            </p>
          </div>

          {/* Total Ingested Lifetime */}
          <div className="p-5 rounded-2xl bg-[#121215] border border-white/[0.08] shadow-sm relative overflow-hidden hover:border-white/[0.14] hover:bg-[#16161c] transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                Total Ingested
              </span>
              <div className="w-8 h-8 rounded-xl bg-black border border-white/[0.1] text-white flex items-center justify-center">
                <Layers className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-bold text-white tabular-nums">
              {ingMetrics?.totalJobs ?? 0}
            </div>
            <p className="text-[11px] text-zinc-400 mt-1">Catalog pipelines</p>
          </div>
        </div>

        {/* Latency & Stage Watermark Banner */}
        <div className="p-5 rounded-2xl bg-[#121215] border border-white/[0.08] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <div>
              <span className="text-[10px] text-zinc-500 uppercase font-mono tracking-wider">
                Avg Transcode Latency
              </span>
              <div className="text-xl font-bold text-white font-mono mt-0.5 tabular-nums">
                {formatMs(ingMetrics?.avgTranscodingMs)}
              </div>
            </div>
            <div className="h-8 w-px bg-white/[0.08]" />
            <div>
              <span className="text-[10px] text-zinc-500 uppercase font-mono tracking-wider">
                Avg Full Turnaround
              </span>
              <div className="text-xl font-bold text-white font-mono mt-0.5 tabular-nums">
                {formatMs(ingMetrics?.avgTotalMs)}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Worker Concurrency: Max 2 Parallel</span>
          </div>
        </div>
      </div>
    );
  }

  // Deletion Pipeline Metrics
  const delMetrics = metrics as DeleteJobSummaryMetrics | null;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {/* Processing Deletions */}
        <div className="p-5 rounded-2xl bg-[#121215] border border-white/[0.08] shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
              In Flight
            </span>
            <div className="w-8 h-8 rounded-xl bg-black border border-white/[0.1] text-indigo-400 flex items-center justify-center">
              <Activity className="w-4 h-4 animate-pulse" />
            </div>
          </div>
          <div className="text-3xl font-bold text-white tabular-nums">
            {delMetrics?.currentlyProcessing ?? 0}
          </div>
          <p className="text-[11px] text-zinc-400 mt-1">Cascading cleanup</p>
        </div>

        {/* Queued */}
        <div className="p-5 rounded-2xl bg-[#121215] border border-white/[0.08] shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
              Queued
            </span>
            <div className="w-8 h-8 rounded-xl bg-black border border-white/[0.1] text-amber-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold text-white tabular-nums">
            {delMetrics?.pendingQueued ?? 0}
          </div>
          <p className="text-[11px] text-zinc-400 mt-1">Waiting in deletion queue</p>
        </div>

        {/* Completed */}
        <div className="p-5 rounded-2xl bg-[#121215] border border-white/[0.08] shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
              Completed
            </span>
            <div className="w-8 h-8 rounded-xl bg-black border border-white/[0.1] text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold text-white tabular-nums">
            {delMetrics?.completed ?? 0}
          </div>
          <p className="text-[11px] text-zinc-400 mt-1">Hard deleted across all tiers</p>
        </div>

        {/* Failed */}
        <div
          className={`p-5 rounded-2xl border shadow-sm ${
            (delMetrics?.failed ?? 0) > 0
              ? "bg-rose-500/10 border-rose-500/25 text-rose-300"
              : "bg-[#121215] border-white/[0.08] text-zinc-300"
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              Failed
            </span>
            <div className="w-8 h-8 rounded-xl bg-black border border-white/[0.1] text-rose-400 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold tabular-nums">
            {delMetrics?.failed ?? 0}
          </div>
          <p className="text-[11px] text-zinc-400 mt-1">Orphaned cleanup jobs</p>
        </div>

        {/* Total Deletions */}
        <div className="p-5 rounded-2xl bg-[#121215] border border-white/[0.08] shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
              Total Purged
            </span>
            <div className="w-8 h-8 rounded-xl bg-black border border-white/[0.1] text-white flex items-center justify-center">
              <Trash2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold text-white tabular-nums">
            {delMetrics?.totalJobs ?? 0}
          </div>
          <p className="text-[11px] text-zinc-400 mt-1">Entities wiped</p>
        </div>
      </div>
    </div>
  );
}
