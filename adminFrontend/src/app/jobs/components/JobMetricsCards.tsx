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
import { QueueBackpressureWidget } from "@/components/QueueBackpressureWidget";

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
              className="animate-pulse p-5 rounded-2xl bg-[#121212] border border-[#282828] space-y-3"
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
        <div className="animate-pulse p-6 rounded-2xl bg-[#121212] border border-[#282828] h-36" />
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
          <div className="p-5 rounded-2xl bg-[#121212] border border-[#282828] shadow-sm relative overflow-hidden group hover:border-zinc-700 hover:bg-[#181818] transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Processing</span>
              <div className="w-8 h-8 rounded-xl bg-black border border-[#282828] text-white flex items-center justify-center">
                <Activity className="w-4 h-4 animate-pulse" />
              </div>
            </div>
            <div className="text-3xl font-bold text-white">
              {ingMetrics?.currentlyProcessing ?? 0}
            </div>
            <p className="text-[11px] text-zinc-400 mt-1">Active transcode &amp; sync</p>
          </div>

          {/* Queued / Pending */}
          <div className="p-5 rounded-2xl bg-[#121212] border border-[#282828] shadow-sm relative overflow-hidden hover:border-zinc-700 hover:bg-[#181818] transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">In Queue</span>
              <div className="w-8 h-8 rounded-xl bg-black border border-[#282828] text-amber-400 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-bold text-white">
              {ingMetrics?.pendingQueued ?? 0}
            </div>
            <p className="text-[11px] text-zinc-400 mt-1">Waiting for worker pick</p>
          </div>

          {/* Successfully Completed */}
          <div className="p-5 rounded-2xl bg-[#121212] border border-[#282828] shadow-sm relative overflow-hidden hover:border-zinc-700 hover:bg-[#181818] transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Completed</span>
              <div className="w-8 h-8 rounded-xl bg-black border border-[#282828] text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-bold text-white">
              {ingMetrics?.completed ?? 0}
            </div>
            <p className="text-[11px] text-zinc-400 mt-1">Ingested successfully</p>
          </div>

          {/* Failed */}
          <div className="p-5 rounded-2xl bg-[#121212] border border-[#282828] shadow-sm relative overflow-hidden hover:border-zinc-700 hover:bg-[#181818] transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Failed</span>
              <div className="w-8 h-8 rounded-xl bg-black border border-[#282828] text-rose-400 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-bold text-white">
              {ingMetrics?.failed ?? 0}
            </div>
            <p className="text-[11px] text-zinc-400 mt-1">Errors requiring inspection</p>
          </div>

          {/* Total Jobs */}
          <div className="p-5 rounded-2xl bg-[#121212] border border-[#282828] shadow-sm relative overflow-hidden col-span-2 md:col-span-1 hover:border-zinc-700 hover:bg-[#181818] transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Total Lifetime</span>
              <div className="w-8 h-8 rounded-xl bg-black border border-[#282828] text-zinc-300 flex items-center justify-center">
                <Layers className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-bold text-white">
              {ingMetrics?.totalJobs ?? 0}
            </div>
            <p className="text-[11px] text-zinc-400 mt-1">All pipeline executions</p>
          </div>
        </div>

        {/* Queue Backpressure Widget */}
        {ingMetrics?.queueBackpressure && (
          <QueueBackpressureWidget
            queueData={ingMetrics.queueBackpressure}
            onRefresh={props.onRefresh}
            isRefreshing={props.isRefreshing}
          />
        )}

        {/* Pipeline Flowchart Visualizer */}
        <div className="p-6 rounded-2xl bg-[#121212] border border-[#282828] shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Cpu className="w-4 h-4 text-white" />
                Song Ingestion Pipeline Architecture &amp; Latency
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Live state machine executing across workers, GPU accelerated transcoding, and cloud search indices.
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-zinc-300 bg-black/60 border border-[#282828] px-3 py-1 rounded-full">
              Avg Total: {formatMs(ingMetrics?.avgTotalMs)}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-2">
            <div className="p-4 rounded-xl bg-black/50 border border-[#282828]">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-bold text-amber-400">1. Pickup &amp; Download</span>
                <Radio className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <div className="text-lg font-bold text-white">
                {ingMetrics?.stageBreakdown?.["QUEUED"] ?? 0}
              </div>
              <div className="text-[11px] text-zinc-400 mt-1">Pending worker pickup</div>
            </div>

            <div className="p-4 rounded-xl bg-black/50 border border-[#282828]">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-bold text-white">2. Transcoding (DASH/HLS)</span>
                <Cpu className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="text-lg font-bold text-white">
                {ingMetrics?.stageBreakdown?.["TRANSCODING"] ?? 0}
              </div>
              <div className="text-[11px] text-zinc-400 mt-1">Avg: {formatMs(ingMetrics?.avgTranscodingMs)}</div>
            </div>

            <div className="p-4 rounded-xl bg-black/50 border border-[#282828]">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-bold text-zinc-200">3. Recombee AI</span>
                <Sparkles className="w-3.5 h-3.5 text-zinc-200" />
              </div>
              <div className="text-lg font-bold text-white">
                {ingMetrics?.stageBreakdown?.["RECOMMENDATION_INDEXING"] ?? 0}
              </div>
              <div className="text-[11px] text-zinc-400 mt-1">Avg: {formatMs(ingMetrics?.avgRecommendationMs)}</div>
            </div>

            <div className="p-4 rounded-xl bg-black/50 border border-[#282828]">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-bold text-zinc-200">4. Algolia Search</span>
                <Search className="w-3.5 h-3.5 text-zinc-200" />
              </div>
              <div className="text-lg font-bold text-white">
                {ingMetrics?.stageBreakdown?.["SEARCH_INDEXING"] ?? 0}
              </div>
              <div className="text-[11px] text-zinc-400 mt-1">Avg: {formatMs(ingMetrics?.avgSearchMs)}</div>
            </div>

            <div className="p-4 rounded-xl bg-black/50 border border-[#282828]">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-bold text-emerald-400">5. Finalize Song</span>
                <Database className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="text-lg font-bold text-white">
                {ingMetrics?.stageBreakdown?.["FINALIZING"] ?? 0}
              </div>
              <div className="text-[11px] text-zinc-400 mt-1">Avg: {formatMs(ingMetrics?.avgFinalizeMs)}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // DELETION
  const delMetrics = metrics as DeleteJobSummaryMetrics | null;
  return (
    <div className="space-y-4">
      {/* Delete KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="p-5 rounded-2xl bg-[#121212] border border-[#282828] shadow-sm relative overflow-hidden group hover:border-zinc-700 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-rose-400 uppercase tracking-wider">In Progress</span>
            <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center">
              <Activity className="w-4 h-4 animate-pulse" />
            </div>
          </div>
          <div className="text-3xl font-black text-white">
            {delMetrics?.currentlyProcessing ?? 0}
          </div>
          <p className="text-[11px] text-zinc-500 mt-1">Purging cloud assets</p>
        </div>

        <div className="p-5 rounded-2xl bg-[#121212] border border-[#282828] shadow-sm relative overflow-hidden group hover:border-zinc-700 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">In Queue</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-white">
            {delMetrics?.pendingQueued ?? 0}
          </div>
          <p className="text-[11px] text-zinc-500 mt-1">Redis queue: {delMetrics?.deleteQueueDepth ?? 0}</p>
        </div>

        <div className="p-5 rounded-2xl bg-[#121212] border border-[#282828] shadow-sm relative overflow-hidden group hover:border-zinc-700 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Purged &amp; Deleted</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-white">
            {delMetrics?.completed ?? 0}
          </div>
          <p className="text-[11px] text-zinc-500 mt-1">Zero orphaned assets</p>
        </div>

        <div className="p-5 rounded-2xl bg-[#121212] border border-[#282828] shadow-sm relative overflow-hidden group hover:border-zinc-700 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-rose-400 uppercase tracking-wider">Failed</span>
            <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-white">
            {delMetrics?.failed ?? 0}
          </div>
          <p className="text-[11px] text-zinc-500 mt-1">Actionable retry available</p>
        </div>

        <div className="p-5 rounded-2xl bg-[#121212] border border-[#282828] shadow-sm relative overflow-hidden col-span-2 md:col-span-1 group hover:border-zinc-700 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Total Lifetime</span>
            <div className="w-8 h-8 rounded-xl bg-black/60 text-zinc-300 border border-[#282828] flex items-center justify-center">
              <Trash2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-white">
            {delMetrics?.totalJobs ?? 0}
          </div>
          <p className="text-[11px] text-zinc-500 mt-1">All cascade operations</p>
        </div>
      </div>

      {/* Delete Cascade Architecture Flowchart */}
      <div className="p-6 rounded-2xl bg-[#121212] border border-[#282828] shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <CloudLightning className="w-4 h-4 text-rose-400" />
              Cascade Delete Architecture &amp; Cleanup Flow
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Strict multi-tier distributed purge removing artifacts from indices, CDNs, object storage, and relational DB.
            </p>
          </div>
          <span className="text-xs font-mono font-bold text-zinc-300 bg-black/60 border border-[#282828] px-3 py-1 rounded-full">
            Avg Total: {formatMs(delMetrics?.avgTotalMs)}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-2">
          <div className="p-4 rounded-xl bg-black/50 border border-[#282828]">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-bold text-cyan-400">1. Algolia Purge</span>
              <Search className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <div className="text-lg font-bold text-white">{delMetrics?.stageBreakdown?.["SEARCH_DELETED"] ?? 0}</div>
            <div className="text-[11px] text-zinc-400 mt-1">Avg: {formatMs(delMetrics?.avgSearchMs)}</div>
          </div>

          <div className="p-4 rounded-xl bg-black/50 border border-[#282828]">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-bold text-purple-400">2. Recombee Purge</span>
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <div className="text-lg font-bold text-white">{delMetrics?.stageBreakdown?.["RECOMMENDATION_DELETED"] ?? 0}</div>
            <div className="text-[11px] text-zinc-400 mt-1">Avg: {formatMs(delMetrics?.avgRecommendationMs)}</div>
          </div>

          <div className="p-4 rounded-xl bg-black/50 border border-[#282828]">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-bold text-pink-400">3. ImageKit Purge</span>
              <Workflow className="w-3.5 h-3.5 text-pink-400" />
            </div>
            <div className="text-lg font-bold text-white">{delMetrics?.stageBreakdown?.["IMAGEKIT_DELETED"] ?? 0}</div>
            <div className="text-[11px] text-zinc-400 mt-1">Avg: {formatMs(delMetrics?.avgImageKitMs)}</div>
          </div>

          <div className="p-4 rounded-xl bg-black/50 border border-[#282828]">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-bold text-indigo-400">4. S3 Storage Purge</span>
              <HardDrive className="w-3.5 h-3.5 text-indigo-400" />
            </div>
            <div className="text-lg font-bold text-white">{delMetrics?.stageBreakdown?.["S3_DELETED"] ?? 0}</div>
            <div className="text-[11px] text-zinc-400 mt-1">Avg: {formatMs(delMetrics?.avgS3Ms)}</div>
          </div>

          <div className="p-4 rounded-xl bg-black/50 border border-[#282828]">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-bold text-emerald-400">5. DB Hard Delete</span>
              <Database className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-lg font-bold text-white">{delMetrics?.stageBreakdown?.["COMPLETED"] ?? 0}</div>
            <div className="text-[11px] text-zinc-400 mt-1">Zero orphans</div>
          </div>
        </div>
      </div>
    </div>
  );
}
