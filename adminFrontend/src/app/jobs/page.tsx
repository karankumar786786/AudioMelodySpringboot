"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Image from "next/image";
import { adminFetch } from "@/lib/adminFetch";
import {
  JobProgress,
  JobSummaryMetrics,
  JobStage,
  JobStageDetail,
  DeleteJobProgress,
  DeleteJobSummaryMetrics,
  DeleteJobStage,
  DeleteJobStageDetail,
} from "@/lib/api";
import { getImageUrl } from "@/lib/image-utils";
import { QueueBackpressureWidget } from "@/components/QueueBackpressureWidget";
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
  Trash2,
  HardDrive,
  CloudLightning,
  Workflow,
} from "lucide-react";

export default function JobMonitoringPage() {
  // Tab State: "INGESTION" | "DELETION"
  const [activeTab, setActiveTab] = useState<"INGESTION" | "DELETION">("INGESTION");

  // Ingestion Pipeline State
  const [metrics, setMetrics] = useState<JobSummaryMetrics | null>(null);
  const [activeJobs, setActiveJobs] = useState<JobProgress[]>([]);
  const [allJobs, setAllJobs] = useState<JobProgress[]>([]);
  const [selectedJob, setSelectedJob] = useState<JobProgress | null>(null);

  // Deletion Pipeline State
  const [deleteMetrics, setDeleteMetrics] = useState<DeleteJobSummaryMetrics | null>(null);
  const [activeDeleteJobs, setActiveDeleteJobs] = useState<DeleteJobProgress[]>([]);
  const [allDeleteJobs, setAllDeleteJobs] = useState<DeleteJobProgress[]>([]);
  const [selectedDeleteJob, setSelectedDeleteJob] = useState<DeleteJobProgress | null>(null);
  const [deleteStatusFilter, setDeleteStatusFilter] = useState<string>("ALL");
  const [deleteTypeFilter, setDeleteTypeFilter] = useState<string>("ALL");
  const [deleteSearchQuery, setDeleteSearchQuery] = useState("");
  const [retryingJobId, setRetryingJobId] = useState<string | null>(null);

  // General Page State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Ingestion Filters
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchData = useCallback(async (showLoader = false) => {
    if (showLoader) setRefreshing(true);
    try {
      if (activeTab === "INGESTION") {
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
      } else {
        const [delSummaryRes, delActiveRes, delAllRes] = await Promise.all([
          adminFetch("/admin/delete-jobs/summary"),
          adminFetch("/admin/delete-jobs/active"),
          adminFetch("/admin/delete-jobs?page=0&size=50"),
        ]);

        if (delSummaryRes.ok) {
          const delSummaryData = await delSummaryRes.json();
          setDeleteMetrics(delSummaryData);
        }

        if (delActiveRes.ok) {
          const delActiveData = await delActiveRes.json();
          setActiveDeleteJobs(delActiveData);
        }

        if (delAllRes.ok) {
          const delAllData = await delAllRes.json();
          setAllDeleteJobs(delAllData.content || delAllData.data || []);
        }
      }
    } catch (err) {
      console.error("Failed to fetch job monitoring metrics:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab]);

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

  const handleRetryDeleteJob = async (jobId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      setRetryingJobId(jobId);
      const res = await adminFetch(`/admin/delete-jobs/${jobId}/retry`, {
        method: "POST",
      });
      if (res.ok) {
        const updated = await res.json();
        setAllDeleteJobs((prev) => prev.map((j) => (j.id === jobId ? updated : j)));
        if (selectedDeleteJob?.id === jobId) {
          setSelectedDeleteJob(updated);
        }
        fetchData(false);
      } else {
        alert("Failed to retry delete job.");
      }
    } catch (err) {
      console.error("Failed to retry delete job:", err);
      alert("Error retrying delete job");
    } finally {
      setRetryingJobId(null);
    }
  };

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

  const getDeleteStageBadge = (stage: DeleteJobStage) => {
    switch (stage) {
      case "QUEUED":
        return { label: "Queued", bg: "bg-amber-500/10 text-amber-500 border-amber-500/20" };
      case "SEARCH_DELETED":
        return { label: "Algolia Purged", bg: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20" };
      case "RECOMMENDATION_DELETED":
        return { label: "Recombee Purged", bg: "bg-purple-500/10 text-purple-500 border-purple-500/20" };
      case "IMAGEKIT_DELETED":
        return { label: "ImageKit Purged", bg: "bg-pink-500/10 text-pink-500 border-pink-500/20" };
      case "S3_DELETED":
        return { label: "S3 Purged", bg: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20" };
      case "COMPLETED":
        return { label: "Hard Deleted", bg: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" };
      case "FAILED":
        return { label: "Delete Failed", bg: "bg-rose-500/10 text-rose-500 border-rose-500/20" };
      default:
        return { label: stage, bg: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20" };
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return { label: "Completed", dot: "bg-emerald-500", text: "text-emerald-500", bg: "bg-emerald-500/10 border-emerald-500/20" };
      case "PROCESSING":
      case "IN_PROGRESS":
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

  const filteredDeleteJobs = allDeleteJobs.filter((job) => {
    if (deleteStatusFilter !== "ALL" && job.status !== deleteStatusFilter) return false;
    if (deleteTypeFilter !== "ALL" && job.entityType !== deleteTypeFilter) return false;
    if (deleteSearchQuery) {
      const q = deleteSearchQuery.toLowerCase();
      const matchTitle = job.entityTitle?.toLowerCase().includes(q);
      const matchEntityId = job.entityId?.toLowerCase().includes(q);
      const matchId = job.id?.toLowerCase().includes(q);
      return matchTitle || matchEntityId || matchId;
    }
    return true;
  });

  return (
    <div className="p-6 md:p-8 max-w-[1600px] mx-auto space-y-8">
      {/* Header & Tab Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight flex items-center gap-2">
              {activeTab === "INGESTION" ? (
                <Zap className="w-6 h-6 text-indigo-500 fill-indigo-500" />
              ) : (
                <Trash2 className="w-6 h-6 text-rose-500 fill-rose-500/20" />
              )}
              {activeTab === "INGESTION" ? "Song Ingestion Pipeline" : "Cascade Delete Pipeline"}
            </h1>
            {activeTab === "INGESTION" && activeJobs.length > 0 && (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-indigo-500" />
                {activeJobs.length} active
              </span>
            )}
            {activeTab === "DELETION" && activeDeleteJobs.length > 0 && (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                {activeDeleteJobs.length} active
              </span>
            )}
          </div>
          <p className="text-zinc-500 text-sm mt-1">
            {activeTab === "INGESTION"
              ? "Real-time telemetry, stage execution time, retry tracking, and webhook lifecycle logs for audio & canvas transcoding."
              : "End-to-end cascade deletion tracking across Algolia, Recombee, ImageKit CDN, AWS S3, and PostgreSQL with 1-click retry."}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Tab Selector */}
          <div className="flex bg-zinc-100 dark:bg-zinc-800/80 p-1 rounded-2xl border border-zinc-200 dark:border-zinc-700/60">
            <button
              onClick={() => setActiveTab("INGESTION")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === "INGESTION"
                  ? "bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-sm border border-indigo-100 dark:border-indigo-900/40"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
              }`}
            >
              <Workflow className="w-3.5 h-3.5" />
              Ingestion Pipeline
            </button>
            <button
              onClick={() => setActiveTab("DELETION")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === "DELETION"
                  ? "bg-white dark:bg-zinc-900 text-rose-600 dark:text-rose-400 shadow-sm border border-rose-100 dark:border-rose-900/40"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
              }`}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Cascade Delete
            </button>
          </div>

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

      {/* ========================================================================= */}
      {/* INGESTION PIPELINE VIEW                                                  */}
      {/* ========================================================================= */}
      {activeTab === "INGESTION" && (
        <>
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
              <p className="text-[11px] text-zinc-500 mt-1">Ingested successfully</p>
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
              <p className="text-[11px] text-zinc-500 mt-1">Errors requiring inspection</p>
            </div>

            {/* Total Jobs */}
            <div className="p-5 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm relative overflow-hidden col-span-2 md:col-span-1">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Total Lifetime</span>
                <div className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 flex items-center justify-center">
                  <Layers className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl font-black text-zinc-900 dark:text-white">
                {metrics?.totalJobs ?? 0}
              </div>
              <p className="text-[11px] text-zinc-500 mt-1">All pipeline executions</p>
            </div>
          </div>

          {/* Queue Backpressure Widget */}
          {metrics?.queueBackpressure && (
            <QueueBackpressureWidget
              queueData={metrics.queueBackpressure}
              onRefresh={() => fetchData(true)}
              isRefreshing={refreshing}
            />
          )}

          {/* Pipeline Flowchart Visualizer */}
          <div className="p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-indigo-500" />
                  Song Ingestion Pipeline Architecture &amp; Latency
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Live state machine executing across workers, GPU accelerated transcoding, and cloud search indices.
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-3 py-1 rounded-full">
                Avg Total: {formatMs(metrics?.avgTotalMs)}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-2">
              {/* Stage 1: Queued */}
              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/50 relative group">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-bold text-amber-500">1. Pickup &amp; Download</span>
                  <Radio className="w-3.5 h-3.5 text-amber-500" />
                </div>
                <div className="text-lg font-black text-zinc-900 dark:text-white">
                  {metrics?.stageBreakdown?.["QUEUED"] ?? 0}
                </div>
                <div className="text-[11px] text-zinc-400 mt-1">Pending worker pickup</div>
              </div>

              {/* Stage 2: Transcoding */}
              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/50 relative group">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-bold text-indigo-500">2. Transcoding (DASH/HLS)</span>
                  <Cpu className="w-3.5 h-3.5 text-indigo-500" />
                </div>
                <div className="text-lg font-black text-zinc-900 dark:text-white">
                  {metrics?.stageBreakdown?.["TRANSCODING"] ?? 0}
                </div>
                <div className="text-[11px] text-zinc-400 mt-1">
                  Avg: {formatMs(metrics?.avgTranscodingMs)}
                </div>
              </div>

              {/* Stage 3: Recombee */}
              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/50 relative group">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-bold text-purple-500">3. Recombee AI</span>
                  <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                </div>
                <div className="text-lg font-black text-zinc-900 dark:text-white">
                  {metrics?.stageBreakdown?.["RECOMMENDATION_INDEXING"] ?? 0}
                </div>
                <div className="text-[11px] text-zinc-400 mt-1">
                  Avg: {formatMs(metrics?.avgRecommendationMs)}
                </div>
              </div>

              {/* Stage 4: Algolia */}
              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/50 relative group">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-bold text-cyan-500">4. Algolia Search</span>
                  <Search className="w-3.5 h-3.5 text-cyan-500" />
                </div>
                <div className="text-lg font-black text-zinc-900 dark:text-white">
                  {metrics?.stageBreakdown?.["SEARCH_INDEXING"] ?? 0}
                </div>
                <div className="text-[11px] text-zinc-400 mt-1">
                  Avg: {formatMs(metrics?.avgSearchMs)}
                </div>
              </div>

              {/* Stage 5: Finalizing */}
              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/50 relative group">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-bold text-emerald-500">5. Finalize Song</span>
                  <Database className="w-3.5 h-3.5 text-emerald-500" />
                </div>
                <div className="text-lg font-black text-zinc-900 dark:text-white">
                  {metrics?.stageBreakdown?.["FINALIZING"] ?? 0}
                </div>
                <div className="text-[11px] text-zinc-400 mt-1">
                  Avg: {formatMs(metrics?.avgFinalizeMs)}
                </div>
              </div>
            </div>
          </div>

          {/* Active Processing Live Monitor */}
          {activeJobs.length > 0 && (
            <div className="p-6 rounded-3xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-900/40 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
                  </span>
                  <h3 className="text-sm font-bold text-indigo-950 dark:text-indigo-200">
                    Actively In Flight ({activeJobs.length})
                  </h3>
                </div>
                <span className="text-xs text-indigo-600 dark:text-indigo-400 font-mono">
                  Real-time worker telemetry
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {activeJobs.map((job) => {
                  const stageBadge = getStageBadge(job.currentStage);
                  return (
                    <div
                      key={job.id}
                      onClick={() => setSelectedJob(job)}
                      className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-indigo-100 dark:border-indigo-900/40 shadow-sm cursor-pointer hover:border-indigo-400 transition-all space-y-3 group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative w-11 h-11 rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-800 shrink-0 border border-zinc-200 dark:border-zinc-700">
                          {job.imageKey ? (
                            <Image
                              src={getImageUrl(job.imageKey, { width: 100, height: 100 })}
                              alt={job.title}
                              fill
                              className="object-cover"
                              unoptimized
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs font-bold text-zinc-400">
                              IMG
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-xs text-zinc-900 dark:text-white truncate group-hover:text-indigo-600 transition-colors">
                            {job.title}
                          </h4>
                          <p className="text-[11px] text-zinc-500 truncate">{job.artistName}</p>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${stageBadge.bg}`}>
                          {stageBadge.label}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-zinc-500 font-mono pt-2 border-t border-zinc-100 dark:border-zinc-800">
                        <span>Elapsed: {formatMs(job.elapsedTotalMs)}</span>
                        {job.transcodingAttempt > 1 && (
                          <span className="text-amber-500 font-bold">
                            Attempt #{job.transcodingAttempt}
                          </span>
                        )}
                        <span className="text-indigo-600 dark:text-indigo-400 flex items-center gap-1 font-bold">
                          Inspect <ChevronRight className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Jobs Table & Filter */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Filter Status:</span>
                {["ALL", "PROCESSING", "PENDING", "COMPLETED", "FAILED"].map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                      statusFilter === s
                        ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 border-zinc-900 dark:border-white shadow-sm"
                        : "bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Search song, artist, job ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              </div>
            </div>

            {/* Ingestion Jobs Table */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-50 dark:bg-zinc-800/40 border-b border-zinc-200 dark:border-zinc-800 text-zinc-400 uppercase font-bold tracking-wider text-[10px]">
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
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 font-mono">
                    {filteredJobs.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-zinc-500 font-sans">
                          No ingestion jobs found matching filter criteria.
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
                            className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors cursor-pointer group"
                          >
                            <td className="py-3 px-4 font-sans">
                              <div className="flex items-center gap-3">
                                <div className="relative w-8 h-8 rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800 shrink-0 border border-zinc-200 dark:border-zinc-700">
                                  {job.imageKey ? (
                                    <Image
                                      src={getImageUrl(job.imageKey, { width: 80, height: 80 })}
                                      alt={job.title}
                                      fill
                                      className="object-cover"
                                      unoptimized
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-[9px] text-zinc-400">
                                      IMG
                                    </div>
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-bold text-zinc-900 dark:text-white truncate max-w-[200px] group-hover:text-indigo-600 transition-colors">
                                    {job.title}
                                  </div>
                                  <div className="text-[11px] text-zinc-500 truncate max-w-[200px]">
                                    {job.artistName}
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td className="py-3 px-4">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-sans font-bold border ${statusBadge.bg} ${statusBadge.text}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${statusBadge.dot}`} />
                                {statusBadge.label}
                              </span>
                            </td>

                            <td className="py-3 px-4">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-sans font-bold border ${stageBadge.bg}`}>
                                {stageBadge.label}
                              </span>
                            </td>

                            <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400">
                              {job.transcodingAttempt > 1 ? (
                                <span className="font-bold text-amber-500">#{job.transcodingAttempt}</span>
                              ) : (
                                "#1"
                              )}
                            </td>

                            <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400">
                              {formatMs(job.transcodingDurationMs)}
                            </td>

                            <td className="py-3 px-4 font-bold text-zinc-900 dark:text-white">
                              {formatMs(job.totalDurationMs || job.elapsedTotalMs)}
                            </td>

                            <td className="py-3 px-4 text-zinc-400 text-[11px]">
                              {formatTime(job.createdAt)}
                            </td>

                            <td className="py-3 px-4 text-right">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedJob(job);
                                }}
                                className="px-3 py-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-900/30 dark:hover:text-indigo-300 font-sans font-bold text-[11px] rounded-lg transition-all"
                              >
                                View Stages
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
          </div>
        </>
      )}

      {/* ========================================================================= */}
      {/* CASCADE DELETE PIPELINE VIEW                                             */}
      {/* ========================================================================= */}
      {activeTab === "DELETION" && (
        <>
          {/* Delete KPI Cards Grid */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {/* Processing / In Progress */}
            <div className="p-5 rounded-3xl bg-white dark:bg-zinc-900 border border-rose-100 dark:border-rose-950/60 shadow-sm relative overflow-hidden group">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">In Progress</span>
                <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center">
                  <Activity className="w-4 h-4 animate-pulse" />
                </div>
              </div>
              <div className="text-3xl font-black text-zinc-900 dark:text-white">
                {deleteMetrics?.currentlyProcessing ?? 0}
              </div>
              <p className="text-[11px] text-zinc-500 mt-1">Purging cloud assets</p>
            </div>

            {/* In Queue (delete_event_queue) */}
            <div className="p-5 rounded-3xl bg-white dark:bg-zinc-900 border border-amber-100 dark:border-amber-950/60 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">In Queue</span>
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl font-black text-zinc-900 dark:text-white">
                {deleteMetrics?.pendingQueued ?? 0}
              </div>
              <p className="text-[11px] text-zinc-500 mt-1">Redis queue: {deleteMetrics?.deleteQueueDepth ?? 0}</p>
            </div>

            {/* Successfully Completed */}
            <div className="p-5 rounded-3xl bg-white dark:bg-zinc-900 border border-emerald-100 dark:border-emerald-950/60 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Purged &amp; Deleted</span>
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl font-black text-zinc-900 dark:text-white">
                {deleteMetrics?.completed ?? 0}
              </div>
              <p className="text-[11px] text-zinc-500 mt-1">Zero orphaned assets</p>
            </div>

            {/* Failed Deletes */}
            <div className="p-5 rounded-3xl bg-white dark:bg-zinc-900 border border-rose-100 dark:border-rose-950/60 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">Failed</span>
                <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl font-black text-zinc-900 dark:text-white">
                {deleteMetrics?.failed ?? 0}
              </div>
              <p className="text-[11px] text-zinc-500 mt-1">Actionable retry available</p>
            </div>

            {/* Total Delete Jobs */}
            <div className="p-5 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm relative overflow-hidden col-span-2 md:col-span-1">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Total Lifetime</span>
                <div className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 flex items-center justify-center">
                  <Trash2 className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl font-black text-zinc-900 dark:text-white">
                {deleteMetrics?.totalJobs ?? 0}
              </div>
              <p className="text-[11px] text-zinc-500 mt-1">All cascade operations</p>
            </div>
          </div>

          {/* Delete Cascade Architecture Flowchart */}
          <div className="p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <CloudLightning className="w-4 h-4 text-rose-500" />
                  Cascade Delete Architecture &amp; Cleanup Flow
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Sequential cloud teardown ensuring complete atomicity across search, AI recommendations, CDN, S3, and database.
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-3 py-1 rounded-full">
                Avg Cleanup: {formatMs(deleteMetrics?.avgTotalMs)}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-2">
              {/* Step 1: Algolia Purge */}
              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/50 relative group">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-bold text-cyan-500">1. Algolia Sync</span>
                  <Search className="w-3.5 h-3.5 text-cyan-500" />
                </div>
                <div className="text-lg font-black text-zinc-900 dark:text-white">
                  {deleteMetrics?.stageBreakdown?.["SEARCH_DELETED"] ?? 0}
                </div>
                <div className="text-[11px] text-zinc-400 mt-1">
                  Avg: {formatMs(deleteMetrics?.avgSearchMs)}
                </div>
              </div>

              {/* Step 2: Recombee Purge */}
              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/50 relative group">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-bold text-purple-500">2. Recombee AI</span>
                  <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                </div>
                <div className="text-lg font-black text-zinc-900 dark:text-white">
                  {deleteMetrics?.stageBreakdown?.["RECOMMENDATION_DELETED"] ?? 0}
                </div>
                <div className="text-[11px] text-zinc-400 mt-1">
                  Avg: {formatMs(deleteMetrics?.avgRecommendationMs)}
                </div>
              </div>

              {/* Step 3: ImageKit CDN Purge */}
              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/50 relative group">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-bold text-pink-500">3. ImageKit CDN</span>
                  <Activity className="w-3.5 h-3.5 text-pink-500" />
                </div>
                <div className="text-lg font-black text-zinc-900 dark:text-white">
                  {deleteMetrics?.stageBreakdown?.["IMAGEKIT_DELETED"] ?? 0}
                </div>
                <div className="text-[11px] text-zinc-400 mt-1">
                  Avg: {formatMs(deleteMetrics?.avgImageKitMs)}
                </div>
              </div>

              {/* Step 4: S3 Audio & Video Purge */}
              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/50 relative group">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-bold text-indigo-500">4. S3 Media Prefix</span>
                  <HardDrive className="w-3.5 h-3.5 text-indigo-500" />
                </div>
                <div className="text-lg font-black text-zinc-900 dark:text-white">
                  {deleteMetrics?.stageBreakdown?.["S3_DELETED"] ?? 0}
                </div>
                <div className="text-[11px] text-zinc-400 mt-1">
                  Avg: {formatMs(deleteMetrics?.avgS3Ms)}
                </div>
              </div>

              {/* Step 5: Database Hard Delete */}
              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/50 relative group">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-bold text-emerald-500">5. Hard Delete</span>
                  <Database className="w-3.5 h-3.5 text-emerald-500" />
                </div>
                <div className="text-lg font-black text-zinc-900 dark:text-white">
                  {deleteMetrics?.stageBreakdown?.["COMPLETED"] ?? 0}
                </div>
                <div className="text-[11px] text-zinc-400 mt-1">
                  Avg: {formatMs(deleteMetrics?.avgFinalizeMs)}
                </div>
              </div>
            </div>
          </div>

          {/* Active Delete Jobs Live Monitor */}
          {activeDeleteJobs.length > 0 && (
            <div className="p-6 rounded-3xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/40 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
                  </span>
                  <h3 className="text-sm font-bold text-rose-950 dark:text-rose-200">
                    Active Deletion Tasks ({activeDeleteJobs.length})
                  </h3>
                </div>
                <span className="text-xs text-rose-600 dark:text-rose-400 font-mono">
                  Live cloud teardown
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {activeDeleteJobs.map((job) => {
                  const stageBadge = getDeleteStageBadge(job.currentStage);
                  return (
                    <div
                      key={job.id}
                      onClick={() => setSelectedDeleteJob(job)}
                      className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-rose-100 dark:border-rose-900/40 shadow-sm cursor-pointer hover:border-rose-400 transition-all space-y-3 group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 uppercase">
                          {job.entityType}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${stageBadge.bg}`}>
                          {stageBadge.label}
                        </span>
                      </div>

                      <div>
                        <h4 className="font-bold text-xs text-zinc-900 dark:text-white truncate group-hover:text-rose-600 transition-colors">
                          {job.entityTitle || job.entityId}
                        </h4>
                        <p className="text-[11px] text-zinc-500 font-mono truncate">{job.entityId}</p>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-zinc-500 font-mono pt-2 border-t border-zinc-100 dark:border-zinc-800">
                        <span>Elapsed: {formatMs(job.elapsedTotalMs)}</span>
                        <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1 font-bold">
                          Inspect <ChevronRight className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Delete Jobs Filter & Table */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Status:</span>
                {["ALL", "IN_PROGRESS", "PENDING", "COMPLETED", "FAILED"].map((s) => (
                  <button
                    key={s}
                    onClick={() => setDeleteStatusFilter(s)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                      deleteStatusFilter === s
                        ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 border-zinc-900 dark:border-white shadow-sm"
                        : "bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300"
                    }`}
                  >
                    {s}
                  </button>
                ))}

                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 ml-3">Type:</span>
                {["ALL", "SONG", "PLAYLIST", "ARTIST"].map((t) => (
                  <button
                    key={t}
                    onClick={() => setDeleteTypeFilter(t)}
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                      deleteTypeFilter === t
                        ? "bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-900 border-zinc-800 dark:border-zinc-200 shadow-sm"
                        : "bg-white dark:bg-zinc-900 text-zinc-500 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Search title, entity ID, job ID..."
                  value={deleteSearchQuery}
                  onChange={(e) => setDeleteSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all"
                />
              </div>
            </div>

            {/* Delete Jobs Table */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-50 dark:bg-zinc-800/40 border-b border-zinc-200 dark:border-zinc-800 text-zinc-400 uppercase font-bold tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3.5 px-4">Entity</th>
                      <th className="py-3.5 px-4">Type</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4">Current Stage</th>
                      <th className="py-3.5 px-4">Attempts</th>
                      <th className="py-3.5 px-4">S3 Purge</th>
                      <th className="py-3.5 px-4">Total Time</th>
                      <th className="py-3.5 px-4">Created At</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 font-mono">
                    {filteredDeleteJobs.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-12 text-center text-zinc-500 font-sans">
                          No cascade delete jobs found matching filter criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredDeleteJobs.map((job) => {
                        const statusBadge = getStatusBadge(job.status);
                        const stageBadge = getDeleteStageBadge(job.currentStage);
                        const isRetrying = retryingJobId === job.id;

                        return (
                          <tr
                            key={job.id}
                            onClick={() => setSelectedDeleteJob(job)}
                            className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors cursor-pointer group"
                          >
                            <td className="py-3 px-4 font-sans">
                              <div className="min-w-0">
                                <div className="font-bold text-zinc-900 dark:text-white truncate max-w-[220px] group-hover:text-rose-600 transition-colors">
                                  {job.entityTitle || "Untitled Entity"}
                                </div>
                                <div className="text-[11px] text-zinc-500 font-mono truncate max-w-[220px]">
                                  {job.entityId}
                                </div>
                              </div>
                            </td>

                            <td className="py-3 px-4 font-sans">
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                                {job.entityType}
                              </span>
                            </td>

                            <td className="py-3 px-4">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-sans font-bold border ${statusBadge.bg} ${statusBadge.text}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${statusBadge.dot}`} />
                                {statusBadge.label}
                              </span>
                            </td>

                            <td className="py-3 px-4">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-sans font-bold border ${stageBadge.bg}`}>
                                {stageBadge.label}
                              </span>
                            </td>

                            <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400">
                              {job.attemptCount > 1 ? (
                                <span className="font-bold text-amber-500">#{job.attemptCount}</span>
                              ) : (
                                "#1"
                              )}
                              <span className="text-[10px] text-zinc-400"> / {job.maxAttempts}</span>
                            </td>

                            <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400">
                              {formatMs(job.s3DurationMs)}
                            </td>

                            <td className="py-3 px-4 font-bold text-zinc-900 dark:text-white">
                              {formatMs(job.totalDurationMs || job.elapsedTotalMs)}
                            </td>

                            <td className="py-3 px-4 text-zinc-400 text-[11px]">
                              {formatTime(job.createdAt)}
                            </td>

                            <td className="py-3 px-4 text-right font-sans">
                              <div className="flex items-center justify-end gap-2">
                                {job.status === "FAILED" && (
                                  <button
                                    onClick={(e) => handleRetryDeleteJob(job.id, e)}
                                    disabled={isRetrying}
                                    className="px-2.5 py-1 bg-rose-500/10 text-rose-600 hover:bg-rose-500 hover:text-white dark:bg-rose-950/40 dark:text-rose-400 border border-rose-500/20 font-bold text-[11px] rounded-lg transition-all flex items-center gap-1"
                                    title="1-Click Retry"
                                  >
                                    <RotateCcw className={`w-3 h-3 ${isRetrying ? "animate-spin" : ""}`} />
                                    Retry
                                  </button>
                                )}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedDeleteJob(job);
                                  }}
                                  className="px-3 py-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/30 dark:hover:text-rose-300 font-bold text-[11px] rounded-lg transition-all"
                                >
                                  Details
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
            </div>
          </div>
        </>
      )}

      {/* ========================================================================= */}
      {/* INGESTION DETAIL MODAL                                                    */}
      {/* ========================================================================= */}
      {selectedJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-800 shrink-0 border border-zinc-200 dark:border-zinc-700">
                  {selectedJob.imageKey ? (
                    <Image
                      src={getImageUrl(selectedJob.imageKey, { width: 120, height: 120 })}
                      alt={selectedJob.title}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs font-bold text-zinc-400">
                      IMG
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-base text-zinc-900 dark:text-white flex items-center gap-2">
                    {selectedJob.title}
                    {selectedJob.isVideoReprocess && (
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-500 font-bold border border-indigo-500/20">
                        Canvas Reprocess
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-zinc-500">{selectedJob.artistName} • Job ID: {selectedJob.id}</p>
                </div>
              </div>

              <button
                onClick={() => setSelectedJob(null)}
                className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Failure Banner if Failed */}
              {selectedJob.status === "FAILED" && (
                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider">Pipeline Failure Notice</h4>
                    <p className="text-xs mt-1 font-mono">{selectedJob.failureReason || "Execution halted during processing"}</p>
                  </div>
                </div>
              )}

              {/* Stage Progress Timeline */}
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

      {/* ========================================================================= */}
      {/* CASCADE DELETE DETAIL MODAL                                               */}
      {/* ========================================================================= */}
      {selectedDeleteJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0 border border-rose-500/20">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-zinc-900 dark:text-white flex items-center gap-2">
                    {selectedDeleteJob.entityTitle || "Untitled Entity"}
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-bold">
                      {selectedDeleteJob.entityType}
                    </span>
                  </h3>
                  <p className="text-xs text-zinc-500">Entity ID: {selectedDeleteJob.entityId} • Task: {selectedDeleteJob.id}</p>
                </div>
              </div>

              <button
                onClick={() => setSelectedDeleteJob(null)}
                className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Failure Banner with 1-Click Retry */}
              {selectedDeleteJob.status === "FAILED" && (
                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider">Cascade Delete Failed</h4>
                      <p className="text-xs mt-1 font-mono">{selectedDeleteJob.failureReason || "Teardown halted unexpectedly"}</p>
                      <p className="text-[11px] text-zinc-400 mt-1">Attempts made: {selectedDeleteJob.attemptCount} of {selectedDeleteJob.maxAttempts}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRetryDeleteJob(selectedDeleteJob.id)}
                    disabled={retryingJobId === selectedDeleteJob.id}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 shrink-0 shadow-sm"
                  >
                    <RotateCcw className={`w-3.5 h-3.5 ${retryingJobId === selectedDeleteJob.id ? "animate-spin" : ""}`} />
                    Retry Now
                  </button>
                </div>
              )}

              {/* Stage Progress Timeline */}
              <div>
                <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-4">
                  Cascade Teardown Stage Execution
                </h4>

                <div className="space-y-3">
                  {selectedDeleteJob.stages?.map((stage, idx) => {
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
                            ? "bg-rose-500/10 border-rose-500/30 animate-pulse"
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
                                ? "bg-rose-600 text-white animate-spin"
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
                                ? "text-rose-600 dark:text-rose-400"
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

              {/* Media & Key References */}
              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 space-y-2 text-xs font-mono">
                <div className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider mb-2">Cloud Keys &amp; Resources Purged</div>
                {selectedDeleteJob.songKey && (
                  <div className="flex justify-between truncate">
                    <span className="text-zinc-500">Audio S3 Prefix:</span>
                    <span className="text-zinc-800 dark:text-zinc-200 font-semibold truncate max-w-[280px]">
                      {selectedDeleteJob.songKey}
                    </span>
                  </div>
                )}
                {selectedDeleteJob.fullVideoKey && (
                  <div className="flex justify-between truncate">
                    <span className="text-zinc-500">Full Video Prefix:</span>
                    <span className="text-indigo-600 dark:text-indigo-400 font-semibold truncate max-w-[280px]">
                      {selectedDeleteJob.fullVideoKey}
                    </span>
                  </div>
                )}
                {selectedDeleteJob.videoKey && (
                  <div className="flex justify-between truncate">
                    <span className="text-zinc-500">Video Canvas:</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold truncate max-w-[280px]">
                      {selectedDeleteJob.videoKey}
                    </span>
                  </div>
                )}
                {selectedDeleteJob.imageKey && (
                  <div className="flex justify-between truncate">
                    <span className="text-zinc-500">Image Key:</span>
                    <span className="text-zinc-800 dark:text-zinc-200 font-semibold truncate max-w-[280px]">
                      {selectedDeleteJob.imageKey}
                    </span>
                  </div>
                )}
                {selectedDeleteJob.coverImageKey && (
                  <div className="flex justify-between truncate">
                    <span className="text-zinc-500">Cover Image Key:</span>
                    <span className="text-zinc-800 dark:text-zinc-200 font-semibold truncate max-w-[280px]">
                      {selectedDeleteJob.coverImageKey}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-zinc-200 dark:border-zinc-800 flex justify-end">
              <button
                onClick={() => setSelectedDeleteJob(null)}
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
