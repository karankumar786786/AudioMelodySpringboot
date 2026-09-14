"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Image from "next/image";
import { adminFetch } from "@/lib/adminFetch";
import { JobProgress, JobSummaryMetrics, JobStage, JobStageDetail } from "@/lib/api";
import { getImageUrl } from "@/lib/image-utils";
import {
  Activity,
  Cpu,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  Filter,
  ArrowRight,
  Sparkles,
  Layers,
  FileText,
  X,
  Play,
  RotateCcw,
  Zap,
  ChevronRight,
  Database,
  Radio,
  ExternalLink,
} from "lucide-react";

export default function JobMonitoringPage() {
  const [metrics, setMetrics] = useState<JobSummaryMetrics | null>(null);
  const [activeJobs, setActiveJobs] = useState<JobProgress[]>([]);
  const [allJobs, setAllJobs] = useState<JobProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedJob, setSelectedJob] = useState<JobProgress | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchData = useCallback(async (showLoader = false) => {
    if (showLoader) setRefreshing(true);
    try {
      const [summaryRes, activeRes, allJobsRes] = await Promise.all([
        adminFetch("/admin/jobs/summary"),
        adminFetch("/admin/jobs/active"),
        adminFetch("/admin/jobs?page=0&size=50"),
      ]);

      if (summaryRes.ok) {
        const summaryData = await summaryRes.json();
        setMetrics(summaryData);
      }

      if (activeRes.ok) {
        const activeData = await activeRes.json();
        setActiveJobs(activeData);
      }

      if (allJobsRes.ok) {
        const jobsData = await allJobsRes.json();
        setAllJobs(jobsData.content || jobsData.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch job monitoring metrics:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData(true);
  }, [fetchData]);

  // Live Auto-Refresh (every 4 seconds)
  useEffect(() => {
    if (!autoRefresh) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      fetchData(false);
    }, 4000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [autoRefresh, fetchData]);

  const formatMs = (ms?: number | null) => {
    if (ms == null) return "-";
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatTime = (isoString?: string | null) => {
    if (!isoString) return "-";
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    } catch {
      return isoString;
    }
  };

  const getStageBadge = (stage: JobStage) => {
    switch (stage) {
      case "QUEUED":
        return { label: "Queued", bg: "bg-amber-500/10 text-amber-500 border-amber-500/20" };
      case "TRANSCODING":
        return { label: "Transcoding", bg: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20 animate-pulse" };
      case "RECOMMENDATION_INDEXING":
        return { label: "Recombee Sync", bg: "bg-purple-500/10 text-purple-500 border-purple-500/20" };
      case "SEARCH_INDEXING":
        return { label: "Algolia Sync", bg: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20" };
      case "FINALIZING":
        return { label: "Finalizing", bg: "bg-blue-500/10 text-blue-500 border-blue-500/20" };
      case "COMPLETED":
        return { label: "Completed", bg: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" };
      case "FAILED":
        return { label: "Failed", bg: "bg-rose-500/10 text-rose-500 border-rose-500/20" };
      default:
        return { label: stage, bg: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20" };
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return { label: "Completed", dot: "bg-emerald-500", text: "text-emerald-500", bg: "bg-emerald-500/10 border-emerald-500/20" };
      case "PROCESSING":
        return { label: "Processing", dot: "bg-indigo-500 animate-ping", text: "text-indigo-500", bg: "bg-indigo-500/10 border-indigo-500/20" };
      case "PENDING":
        return { label: "Queued", dot: "bg-amber-500", text: "text-amber-500", bg: "bg-amber-500/10 border-amber-500/20" };
      case "FAILED":
        return { label: "Failed", dot: "bg-rose-500", text: "text-rose-500", bg: "bg-rose-500/10 border-rose-500/20" };
      default:
        return { label: status, dot: "bg-zinc-500", text: "text-zinc-500", bg: "bg-zinc-500/10 border-zinc-500/20" };
    }
  };

  const filteredJobs = allJobs.filter((job) => {
    if (statusFilter !== "ALL" && job.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchTitle = job.title?.toLowerCase().includes(q);
      const matchArtist = job.artistName?.toLowerCase().includes(q);
      const matchId = job.id?.toLowerCase().includes(q);
      return matchTitle || matchArtist || matchId;
    }
    return true;
  });

  return (
    <div className="p-6 md:p-8 max-w-[1600px] mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight flex items-center gap-2">
              <Zap className="w-6 h-6 text-indigo-500 fill-indigo-500" />
              Processing Pipeline &amp; Queue
            </h1>
            {activeJobs.length > 0 && (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-indigo-500" />
                {activeJobs.length} active
              </span>
            )}
          </div>
          <p className="text-zinc-500 text-sm mt-1">
            Real-time telemetry, stage execution time, retry tracking, and webhook lifecycle logs.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Auto-Refresh Toggle */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${
              autoRefresh
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700"
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${autoRefresh ? "bg-emerald-500 animate-ping" : "bg-zinc-400"}`} />
            {autoRefresh ? "Live 4s" : "Paused"}
          </button>

          {/* Refresh Button */}
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="p-2.5 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-xl transition-all active:scale-95 disabled:opacity-50"
            title="Refresh now"
          >
            <RefreshCw className={`w-4 h-4 text-zinc-600 dark:text-zinc-300 ${refreshing ? "animate-spin text-indigo-500" : ""}`} />
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {/* Currently Processing */}
        <div className="p-5 rounded-3xl bg-white dark:bg-zinc-900 border border-indigo-100 dark:border-indigo-950/60 shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Processing</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
              <Activity className="w-4 h-4 animate-pulse" />
            </div>
          </div>
          <div className="text-3xl font-black text-zinc-900 dark:text-white">
            {metrics?.currentlyProcessing ?? 0}
          </div>
          <p className="text-[11px] text-zinc-500 mt-1">Active transcode &amp; sync</p>
        </div>

        {/* Queued / Pending */}
        <div className="p-5 rounded-3xl bg-white dark:bg-zinc-900 border border-amber-100 dark:border-amber-950/60 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">In Queue</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-zinc-900 dark:text-white">
            {metrics?.pendingQueued ?? 0}
          </div>
          <p className="text-[11px] text-zinc-500 mt-1">Waiting for worker pick</p>
        </div>

        {/* Successfully Completed */}
        <div className="p-5 rounded-3xl bg-white dark:bg-zinc-900 border border-emerald-100 dark:border-emerald-950/60 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Completed</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-zinc-900 dark:text-white">
            {metrics?.completed ?? 0}
          </div>
          <p className="text-[11px] text-zinc-500 mt-1">Fully transcoded &amp; indexed</p>
        </div>

        {/* Failed */}
        <div className="p-5 rounded-3xl bg-white dark:bg-zinc-900 border border-rose-100 dark:border-rose-950/60 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">Failed</span>
            <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-zinc-900 dark:text-white">
            {metrics?.failed ?? 0}
          </div>
          <p className="text-[11px] text-zinc-500 mt-1">Exceeded max retries</p>
        </div>

        {/* Average Pipeline Time */}
        <div className="col-span-2 md:col-span-1 p-5 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Avg Pipeline</span>
            <div className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-500 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-indigo-500" />
            </div>
          </div>
          <div className="text-3xl font-black text-zinc-900 dark:text-white">
            {formatMs(metrics?.avgTotalMs)}
          </div>
          <p className="text-[11px] text-zinc-500 mt-1">
            Transcode: ~{formatMs(metrics?.avgTranscodingMs)}
          </p>
        </div>
      </div>

      {/* Visual Pipeline Architecture / Stage Telemetry */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-6 md:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
          <div>
            <h2 className="text-base font-bold text-zinc-900 dark:text-white">Pipeline Execution Lifecycle</h2>
            <p className="text-xs text-zinc-500">Each webhook transition automatically records execution timing and state progression</p>
          </div>
          <div className="text-xs font-mono text-zinc-400">
            Total lifetime jobs: <span className="font-bold text-zinc-900 dark:text-white">{metrics?.totalJobs ?? 0}</span>
          </div>
        </div>

        {/* 5 Stages Flow */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {/* Stage 1: Queued */}
          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700/60 relative">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase text-amber-500 tracking-wider">Stage 1</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
                {metrics?.stageBreakdown?.QUEUED ?? 0} in queue
              </span>
            </div>
            <h3 className="font-bold text-sm text-zinc-900 dark:text-white">Queue &amp; Pickup</h3>
            <p className="text-[11px] text-zinc-500 mt-0.5">Redis ingestion queue</p>
            <div className="mt-3 pt-3 border-t border-zinc-200/60 dark:border-zinc-700/40 text-[11px] text-zinc-400 flex items-center justify-between">
              <span>Webhook</span>
              <span className="font-mono text-zinc-600 dark:text-zinc-300">redis dispatch</span>
            </div>
          </div>

          {/* Stage 2: Transcoding */}
          <div className="p-4 rounded-2xl bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800/60 relative">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase text-indigo-500 tracking-wider">Stage 2</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                {metrics?.stageBreakdown?.TRANSCODING ?? 0} active
              </span>
            </div>
            <h3 className="font-bold text-sm text-zinc-900 dark:text-white">Media Transcoding</h3>
            <p className="text-[11px] text-zinc-500 mt-0.5">Shaka HLS &amp; FFmpeg</p>
            <div className="mt-3 pt-3 border-t border-indigo-200/60 dark:border-indigo-800/40 text-[11px] text-zinc-400 flex items-center justify-between">
              <span>Avg Time</span>
              <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">~{formatMs(metrics?.avgTranscodingMs)}</span>
            </div>
          </div>

          {/* Stage 3: Recombee */}
          <div className="p-4 rounded-2xl bg-purple-50/40 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800/60 relative">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase text-purple-500 tracking-wider">Stage 3</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400">
                {metrics?.stageBreakdown?.RECOMMENDATION_INDEXING ?? 0} active
              </span>
            </div>
            <h3 className="font-bold text-sm text-zinc-900 dark:text-white">Recombee Indexing</h3>
            <p className="text-[11px] text-zinc-500 mt-0.5">Recommendation model</p>
            <div className="mt-3 pt-3 border-t border-purple-200/60 dark:border-purple-800/40 text-[11px] text-zinc-400 flex items-center justify-between">
              <span>Avg Time</span>
              <span className="font-mono font-bold text-purple-600 dark:text-purple-400">~{formatMs(metrics?.avgRecommendationMs)}</span>
            </div>
          </div>

          {/* Stage 4: Algolia */}
          <div className="p-4 rounded-2xl bg-cyan-50/40 dark:bg-cyan-950/20 border border-cyan-200 dark:border-cyan-800/60 relative">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase text-cyan-500 tracking-wider">Stage 4</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                {metrics?.stageBreakdown?.SEARCH_INDEXING ?? 0} active
              </span>
            </div>
            <h3 className="font-bold text-sm text-zinc-900 dark:text-white">Algolia Search Sync</h3>
            <p className="text-[11px] text-zinc-500 mt-0.5">Instant search vectors</p>
            <div className="mt-3 pt-3 border-t border-cyan-200/60 dark:border-cyan-800/40 text-[11px] text-zinc-400 flex items-center justify-between">
              <span>Avg Time</span>
              <span className="font-mono font-bold text-cyan-600 dark:text-cyan-400">~{formatMs(metrics?.avgSearchMs)}</span>
            </div>
          </div>

          {/* Stage 5: Finalize */}
          <div className="p-4 rounded-2xl bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60 relative">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase text-emerald-500 tracking-wider">Stage 5</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                {metrics?.stageBreakdown?.FINALIZING ?? 0} active
              </span>
            </div>
            <h3 className="font-bold text-sm text-zinc-900 dark:text-white">Finalize &amp; Publish</h3>
            <p className="text-[11px] text-zinc-500 mt-0.5">Song table insertion</p>
            <div className="mt-3 pt-3 border-t border-emerald-200/60 dark:border-emerald-800/40 text-[11px] text-zinc-400 flex items-center justify-between">
              <span>Avg Time</span>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">~{formatMs(metrics?.avgFinalizeMs)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Active In-Flight Processing Board */}
      {activeJobs.length > 0 && (
        <div className="bg-gradient-to-b from-indigo-500/5 to-transparent dark:from-indigo-950/30 p-6 md:p-8 rounded-3xl border border-indigo-200/80 dark:border-indigo-800/40 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
              </span>
              <h2 className="text-base font-bold text-zinc-900 dark:text-white">
                Currently In-Flight Tracks ({activeJobs.length})
              </h2>
            </div>
            <span className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold">
              Live updates every 4s
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeJobs.map((job) => {
              const stageBadge = getStageBadge(job.currentStage);
              return (
                <div
                  key={job.id}
                  onClick={() => setSelectedJob(job)}
                  className="bg-white dark:bg-zinc-900/90 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-md hover:border-indigo-400 dark:hover:border-indigo-600 cursor-pointer transition-all group"
                >
                  <div className="flex items-start gap-4">
                    {job.imageKey ? (
                      <img
                        src={getImageUrl(job.imageKey, { width: 120, height: 120, focus: "auto", aspectRatio: "1-1" })}
                        alt=""
                        className="w-14 h-14 rounded-xl object-cover shrink-0 border border-zinc-200 dark:border-zinc-800"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center font-bold">
                        🎵
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="font-bold text-sm text-zinc-900 dark:text-white truncate">
                          {job.title}
                        </h4>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${stageBadge.bg}`}>
                          {stageBadge.label}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 truncate mt-0.5">
                        {job.artistName} {job.isVideoReprocess ? "· Video Reprocess" : ""}
                      </p>

                      <div className="flex items-center gap-3 mt-3 text-xs text-zinc-400">
                        <span className="flex items-center gap-1 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          <Clock className="w-3.5 h-3.5 animate-spin" />
                          Running: {formatMs(job.elapsedTotalMs)}
                        </span>
                        <span>·</span>
                        <span className="font-semibold text-zinc-600 dark:text-zinc-300">
                          Attempt #{job.transcodingAttempt || 1}
                        </span>
                        {job.currentStageElapsedMs != null && (
                          <>
                            <span>·</span>
                            <span className="text-zinc-500">
                              In stage: {formatMs(job.currentStageElapsedMs)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Micro Stepper */}
                  <div className="grid grid-cols-5 gap-1.5 mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800/60">
                    {job.stages?.map((stg, i) => {
                      const isDone = stg.status === "COMPLETED";
                      const isInProgress = stg.status === "IN_PROGRESS";
                      const isSkipped = stg.status === "SKIPPED";
                      return (
                        <div key={i} className="text-center">
                          <div
                            className={`h-1.5 rounded-full mb-1 transition-all ${
                              isDone
                                ? "bg-emerald-500"
                                : isInProgress
                                ? "bg-indigo-500 animate-pulse"
                                : isSkipped
                                ? "bg-zinc-300 dark:bg-zinc-700"
                                : "bg-zinc-200 dark:bg-zinc-800"
                            }`}
                          />
                          <span className={`text-[9px] block truncate font-mono ${
                            isInProgress ? "font-bold text-indigo-500" : "text-zinc-400"
                          }`}>
                            {stg.stageName.split("_")[0]}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* All Jobs Telemetry Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
        {/* Table Filter Bar */}
        <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            {["ALL", "PROCESSING", "PENDING", "COMPLETED", "FAILED"].map((tab) => (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
                  statusFilter === tab
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                }`}
              >
                {tab === "ALL" ? "All Jobs" : tab.charAt(0) + tab.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by title, artist, or job ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 text-zinc-900 dark:text-white"
            />
          </div>
        </div>

        {/* Jobs Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 uppercase tracking-wider font-bold text-[11px] border-b border-zinc-200 dark:border-zinc-800">
              <tr>
                <th className="px-6 py-4">Song Details</th>
                <th className="px-4 py-4">Current Stage</th>
                <th className="px-4 py-4">Attempts</th>
                <th className="px-4 py-4">Stage Durations</th>
                <th className="px-4 py-4">Total Time</th>
                <th className="px-4 py-4">Status</th>
                <th className="px-4 py-4">Submitted</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={8} className="px-6 py-4">
                      <div className="h-6 bg-zinc-200 dark:bg-zinc-800 rounded-lg" />
                    </td>
                  </tr>
                ))
              ) : filteredJobs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-zinc-400">
                    No processing jobs found matching your filters.
                  </td>
                </tr>
              ) : (
                filteredJobs.map((job) => {
                  const statusBadge = getStatusBadge(job.status);
                  const stageBadge = getStageBadge(job.currentStage);
                  return (
                    <tr
                      key={job.id}
                      onClick={() => setSelectedJob(job)}
                      className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 cursor-pointer transition-colors"
                    >
                      {/* Song Details */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {job.imageKey ? (
                            <img
                              src={getImageUrl(job.imageKey, { width: 80, height: 80, focus: "auto", aspectRatio: "1-1" })}
                              alt=""
                              className="w-10 h-10 rounded-lg object-cover shrink-0 border border-zinc-200 dark:border-zinc-800"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center font-bold text-zinc-400 shrink-0">
                              🎵
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="font-bold text-zinc-900 dark:text-white truncate max-w-[200px]">
                              {job.title}
                            </div>
                            <div className="text-[11px] text-zinc-500 truncate max-w-[180px]">
                              {job.artistName} {job.isVideoReprocess ? "· Video Reprocess" : ""}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Current Stage */}
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${stageBadge.bg}`}>
                          {job.status === "PROCESSING" && (
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping" />
                          )}
                          {stageBadge.label}
                        </span>
                      </td>

                      {/* Attempts */}
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md font-mono text-[11px] font-bold ${
                            job.transcodingAttempt > 1
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                              : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300"
                          }`}
                        >
                          {job.transcodingAttempt > 1 ? `⚠️ #${job.transcodingAttempt}` : `#${job.transcodingAttempt || 1}`}
                        </span>
                      </td>

                      {/* Stage Durations (Mini Breakdown Pills) */}
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-1.5 text-[10px] font-mono">
                          {job.transcodingDurationMs != null && (
                            <span className="px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/40 font-bold" title="Transcode Time">
                              T: {formatMs(job.transcodingDurationMs)}
                            </span>
                          )}
                          {job.recommendationDurationMs != null && (
                            <span className="px-1.5 py-0.5 rounded bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800/40 font-bold" title="Recombee Time">
                              R: {formatMs(job.recommendationDurationMs)}
                            </span>
                          )}
                          {job.searchDurationMs != null && (
                            <span className="px-1.5 py-0.5 rounded bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-800/40 font-bold" title="Algolia Time">
                              A: {formatMs(job.searchDurationMs)}
                            </span>
                          )}
                          {job.transcodingDurationMs == null && job.recommendationDurationMs == null && (
                            <span className="text-zinc-400">-</span>
                          )}
                        </div>
                      </td>

                      {/* Total Duration */}
                      <td className="px-4 py-4 font-mono font-bold text-zinc-900 dark:text-white">
                        {formatMs(job.totalDurationMs || job.elapsedTotalMs)}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${statusBadge.bg}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${statusBadge.dot}`} />
                          {statusBadge.label}
                        </span>
                      </td>

                      {/* Submitted At */}
                      <td className="px-4 py-4 text-zinc-500 font-mono text-[11px]">
                        {formatTime(job.createdAt)}
                      </td>

                      {/* Action */}
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedJob(job);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-zinc-600 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 font-bold text-xs transition-colors"
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Inspection Modal */}
      {selectedJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-2xl rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-4">
                {selectedJob.imageKey && (
                  <img
                    src={getImageUrl(selectedJob.imageKey, { width: 100, height: 100, focus: "auto", aspectRatio: "1-1" })}
                    alt=""
                    className="w-12 h-12 rounded-xl object-cover border border-zinc-200 dark:border-zinc-800"
                  />
                )}
                <div>
                  <h3 className="font-bold text-base text-zinc-900 dark:text-white">
                    {selectedJob.title}
                  </h3>
                  <p className="text-xs text-zinc-500">
                    {selectedJob.artistName} · Job ID: <span className="font-mono text-[11px]">{selectedJob.id.slice(0, 8)}...</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedJob(null)}
                className="p-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              {/* Failure Alert Banner */}
              {selectedJob.status === "FAILED" && (
                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400">
                  <div className="flex items-center gap-2 font-bold text-xs mb-1">
                    <AlertTriangle className="w-4 h-4" />
                    Job Execution Failed
                  </div>
                  <p className="text-xs font-mono break-all">
                    {selectedJob.failureReason || "Worker process encountered an unhandled exception."}
                  </p>
                </div>
              )}

              {/* Timing Overview Grid */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800">
                  <span className="text-[10px] uppercase font-bold text-zinc-400 block mb-0.5">Total Pipeline Time</span>
                  <span className="text-lg font-black text-zinc-900 dark:text-white font-mono">
                    {formatMs(selectedJob.totalDurationMs || selectedJob.elapsedTotalMs)}
                  </span>
                </div>
                <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800">
                  <span className="text-[10px] uppercase font-bold text-zinc-400 block mb-0.5">Attempts Taken</span>
                  <span className="text-lg font-black text-zinc-900 dark:text-white font-mono">
                    {selectedJob.transcodingAttempt || 1}
                  </span>
                </div>
                <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800">
                  <span className="text-[10px] uppercase font-bold text-zinc-400 block mb-0.5">Current Status</span>
                  <span className="text-sm font-bold text-indigo-500 block mt-1">
                    {selectedJob.currentStage}
                  </span>
                </div>
              </div>

              {/* Stage-by-Stage Timeline Stepper */}
              <div>
                <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-4">
                  Webhook Execution &amp; Stage Timeline
                </h4>

                <div className="space-y-3">
                  {selectedJob.stages?.map((stage, idx) => {
                    const isDone = stage.status === "COMPLETED";
                    const isInProgress = stage.status === "IN_PROGRESS";
                    const isFailed = stage.status === "FAILED";
                    const isSkipped = stage.status === "SKIPPED";

                    return (
                      <div
                        key={idx}
                        className={`p-4 rounded-2xl border flex items-center justify-between transition-all ${
                          isDone
                            ? "bg-emerald-500/5 border-emerald-500/20"
                            : isInProgress
                            ? "bg-indigo-500/10 border-indigo-500/30 animate-pulse"
                            : isFailed
                            ? "bg-rose-500/10 border-rose-500/30"
                            : isSkipped
                            ? "bg-zinc-100/50 dark:bg-zinc-800/30 border-zinc-200 dark:border-zinc-800 opacity-60"
                            : "bg-zinc-50 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-800"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                              isDone
                                ? "bg-emerald-500 text-white"
                                : isInProgress
                                ? "bg-indigo-600 text-white animate-spin"
                                : isFailed
                                ? "bg-rose-500 text-white"
                                : isSkipped
                                ? "bg-zinc-400 text-white"
                                : "bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300"
                            }`}
                          >
                            {isDone ? "✓" : isFailed ? "✕" : isSkipped ? "-" : idx + 1}
                          </div>
                          <div>
                            <div className="font-bold text-xs text-zinc-900 dark:text-white flex items-center gap-2">
                              {stage.label}
                              {isSkipped && <span className="text-[10px] text-zinc-400">(Skipped)</span>}
                            </div>
                            <div className="text-[11px] text-zinc-400 font-mono">
                              {stage.startedAt ? formatTime(stage.startedAt) : "Pending"}
                              {stage.completedAt && ` → ${formatTime(stage.completedAt)}`}
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <span
                            className={`font-mono font-bold text-xs ${
                              isDone
                                ? "text-emerald-600 dark:text-emerald-400"
                                : isInProgress
                                ? "text-indigo-600 dark:text-indigo-400"
                                : "text-zinc-400"
                            }`}
                          >
                            {stage.formattedDuration}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* S3 & Key Artifacts */}
              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 space-y-2 text-xs font-mono">
                <div className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider mb-2">Media Artifacts</div>
                <div className="flex justify-between truncate">
                  <span className="text-zinc-500">Song Key:</span>
                  <span className="text-zinc-800 dark:text-zinc-200 font-semibold truncate max-w-[280px]">
                    {selectedJob.songId ? `audios/${selectedJob.songId}` : "-"}
                  </span>
                </div>
                {selectedJob.videoKey && (
                  <div className="flex justify-between truncate">
                    <span className="text-zinc-500">Video Canvas:</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold truncate max-w-[280px]">
                      {selectedJob.videoKey}
                    </span>
                  </div>
                )}
                {selectedJob.fullVideoKey && (
                  <div className="flex justify-between truncate">
                    <span className="text-zinc-500">Full Video:</span>
                    <span className="text-indigo-600 dark:text-indigo-400 font-semibold truncate max-w-[280px]">
                      {selectedJob.fullVideoKey}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-zinc-200 dark:border-zinc-800 flex justify-end">
              <button
                onClick={() => setSelectedJob(null)}
                className="px-6 py-2.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 font-bold text-xs rounded-xl transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
