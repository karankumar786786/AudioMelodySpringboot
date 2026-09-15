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
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronDown,
  ChevronUp,
  Database,
  Radio,
  ExternalLink,
  Trash2,
  HardDrive,
  CloudLightning,
  Workflow,
  UploadCloud,
  Music,
  Film,
  FileUp,
} from "lucide-react";
import { UploadProgressBar } from "@/components/UploadProgressBar";
import {
  uploadWithProgress,
  UploadError,
  getFriendlyUploadErrorMessage,
  isDeviceOnline,
} from "@/lib/upload-utils";

/**
 * Transforms raw system/CLI/Inngest exceptions into user-friendly, actionable failure descriptions.
 */
function formatFailureNotice(reason?: string | null): { title: string; explanation: string; raw?: string } {
  if (!reason) {
    return { title: "Pipeline Failure Notice", explanation: "Execution halted unexpectedly during processing." };
  }

  // 1. HTTP 413 / Inngest SDK Payload error
  if (/413|Payload Too Large|before the SDK responded/i.test(reason)) {
    return {
      title: "Worker Payload Limit Exceeded (HTTP 413)",
      explanation: "Express body parser limit was exceeded by large job logs. The server limit has been raised to 50MB; click Retry Now to resume.",
      raw: reason,
    };
  }

  // 2. Corrupted audio or video packets
  if (/Invalid data found|channel element.*not allocated|Reserved bit set|decode_pce|Input buffer exhausted|Error submitting packet|Prediction is not allowed|Gain control is not implemented|Corrupt/i.test(reason)) {
    return {
      title: "Corrupt Media Stream Detected",
      explanation: "The uploaded file contains damaged or non-standard audio/video packets. The worker has been updated to auto-discard bad packets; click Retry Now.",
      raw: reason,
    };
  }

  // 3. S3 Storage
  if (/NoSuchKey|The specified key does not exist|Missing tempSongKey|Missing tempVideoKey/i.test(reason)) {
    return {
      title: "Storage Key Missing or Expired",
      explanation: "The temporary uploaded media file could not be found in S3 (it may have expired or already been cleaned up).",
      raw: reason,
    };
  }

  // 4. Invalid Duration
  if (/Invalid (audio|video) duration/i.test(reason)) {
    return {
      title: "Invalid Media Duration",
      explanation: "The uploaded file has 0 seconds duration or an unreadable media container header.",
      raw: reason,
    };
  }

  // 5. Network Timeout
  if (/ECONNREFUSED|ETIMEDOUT|timeout/i.test(reason)) {
    return {
      title: "Internal Service Timeout",
      explanation: "The worker timed out while communicating with backend microservices or S3.",
      raw: reason,
    };
  }

  // 6. Generic FFmpeg command failure
  if (/Command failed:\s*ffmpeg/i.test(reason)) {
    return {
      title: "Transcoder Conversion Failed",
      explanation: "FFmpeg encountered an encoding or packaging error while processing renditions.",
      raw: reason,
    };
  }

  // Default clean output
  const cleanReason = reason.length > 200 ? `${reason.slice(0, 197)}...` : reason;
  return {
    title: "Pipeline Failure Notice",
    explanation: cleanReason,
    raw: reason.length > 200 ? reason : undefined,
  };
}

export default function JobMonitoringPage() {
  // Tab State: "INGESTION" | "DELETION"
  const [activeTab, setActiveTab] = useState<"INGESTION" | "DELETION">("INGESTION");

  // Ingestion Pipeline State
  const [metrics, setMetrics] = useState<JobSummaryMetrics | null>(null);
  const [activeJobs, setActiveJobs] = useState<JobProgress[]>([]);
  const [allJobs, setAllJobs] = useState<JobProgress[]>([]);
  const [selectedJob, setSelectedJob] = useState<JobProgress | null>(null);
  const [retryingIngestionJobId, setRetryingIngestionJobId] = useState<string | null>(null);
  const [deletingJobId, setDeletingJobId] = useState<string | null>(null);

  // Recover Media on Failed Job State
  const [recoveringJob, setRecoveringJob] = useState<JobProgress | null>(null);
  const [recoverAudioFile, setRecoverAudioFile] = useState<File | null>(null);
  const [recoverVideoFile, setRecoverVideoFile] = useState<File | null>(null);
  const [recoverClipStartMin, setRecoverClipStartMin] = useState<string | number>("");
  const [recoverClipStartSec, setRecoverClipStartSec] = useState<string | number>("");
  const [recoverClipEndMin, setRecoverClipEndMin] = useState<string | number>("");
  const [recoverClipEndSec, setRecoverClipEndSec] = useState<string | number>("");
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoverProgressText, setRecoverProgressText] = useState("");
  const [recoverPercent, setRecoverPercent] = useState<number | null>(null);
  const [recoverStats, setRecoverStats] = useState<{
    loadedText?: string;
    speedText?: string;
    fileName?: string;
  }>({});
  const [recoverError, setRecoverError] = useState<{
    title?: string;
    message: string;
    isNetworkError?: boolean;
  } | null>(null);
  const [recoverRetryStatusText, setRecoverRetryStatusText] = useState("");
  const [isRecoverRetrying, setIsRecoverRetrying] = useState(false);

  // Ingestion Pagination State
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [totalJobsCount, setTotalJobsCount] = useState(0);
  const [showRawError, setShowRawError] = useState(false);
  const [showRawDeleteError, setShowRawDeleteError] = useState(false);

  // Deletion Pipeline State
  const [deleteMetrics, setDeleteMetrics] = useState<DeleteJobSummaryMetrics | null>(null);
  const [activeDeleteJobs, setActiveDeleteJobs] = useState<DeleteJobProgress[]>([]);
  const [allDeleteJobs, setAllDeleteJobs] = useState<DeleteJobProgress[]>([]);
  const [selectedDeleteJob, setSelectedDeleteJob] = useState<DeleteJobProgress | null>(null);
  const [deleteStatusFilter, setDeleteStatusFilter] = useState<string>("ALL");
  const [deleteTypeFilter, setDeleteTypeFilter] = useState<string>("ALL");
  const [deleteSearchQuery, setDeleteSearchQuery] = useState("");
  const [retryingJobId, setRetryingJobId] = useState<string | null>(null);
  const [deletingDeleteJobId, setDeletingDeleteJobId] = useState<string | null>(null);
  const [isPurgingFailedJobs, setIsPurgingFailedJobs] = useState(false);

  // Deletion Pagination State
  const [deletePage, setDeletePage] = useState(0);
  const [deletePageSize, setDeletePageSize] = useState(20);
  const [totalDeleteJobsCount, setTotalDeleteJobsCount] = useState(0);

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
        const queryParams = new URLSearchParams({
          page: String(page),
          size: String(pageSize),
        });
        if (statusFilter !== "ALL") queryParams.set("status", statusFilter);
        if (searchQuery.trim()) queryParams.set("search", searchQuery.trim());

        const [summaryRes, activeRes, allJobsRes] = await Promise.all([
          adminFetch("/admin/jobs/summary"),
          adminFetch("/admin/jobs/active"),
          adminFetch(`/admin/jobs?${queryParams.toString()}`),
        ]);

        if (summaryRes.ok) {
          const summaryData = await summaryRes.json();
          setMetrics(summaryData);
        }

        if (activeRes.ok) {
          const activeData = await activeRes.json();
          setActiveJobs(activeData.content || activeData.data || activeData || []);
        }

        if (allJobsRes.ok) {
          const jobsData = await allJobsRes.json();
          setAllJobs(jobsData.content || jobsData.data || []);
          const total = jobsData.metadata?.totalCount ?? jobsData.totalCount ?? (jobsData.content || []).length;
          setTotalJobsCount(total);
        }
      } else {
        const queryParams = new URLSearchParams({
          page: String(deletePage),
          size: String(deletePageSize),
        });
        if (deleteStatusFilter !== "ALL") queryParams.set("status", deleteStatusFilter);
        if (deleteTypeFilter !== "ALL") queryParams.set("entityType", deleteTypeFilter);
        if (deleteSearchQuery.trim()) queryParams.set("search", deleteSearchQuery.trim());

        const [delSummaryRes, delActiveRes, delAllRes] = await Promise.all([
          adminFetch("/admin/delete-jobs/summary"),
          adminFetch("/admin/delete-jobs/active"),
          adminFetch(`/admin/delete-jobs?${queryParams.toString()}`),
        ]);

        if (delSummaryRes.ok) {
          const delSummaryData = await delSummaryRes.json();
          setDeleteMetrics(delSummaryData);
        }

        if (delActiveRes.ok) {
          const delActiveData = await delActiveRes.json();
          setActiveDeleteJobs(delActiveData.content || delActiveData.data || delActiveData || []);
        }

        if (delAllRes.ok) {
          const delAllData = await delAllRes.json();
          setAllDeleteJobs(delAllData.content || delAllData.data || []);
          const total = delAllData.metadata?.totalCount ?? delAllData.totalCount ?? (delAllData.content || []).length;
          setTotalDeleteJobsCount(total);
        }
      }
    } catch (err) {
      console.error("Failed to fetch job monitoring metrics:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab, page, pageSize, statusFilter, searchQuery, deletePage, deletePageSize, deleteStatusFilter, deleteTypeFilter, deleteSearchQuery]);

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

  const handleRetryIngestionJob = async (jobId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      setRetryingIngestionJobId(jobId);
      const res = await adminFetch(`/admin/jobs/${jobId}/retry`, {
        method: "POST",
      });
      if (res.ok) {
        const updated: JobProgress = await res.json();
        setAllJobs((prev) => prev.map((j) => (j.id === jobId ? updated : j)));
        setActiveJobs((prev) => {
          const exists = prev.some((j) => j.id === jobId);
          if (exists) {
            return prev.map((j) => (j.id === jobId ? updated : j));
          }
          return [updated, ...prev];
        });
        if (selectedJob?.id === jobId) {
          setSelectedJob(updated);
        }
        fetchData(false);
      } else {
        const errData = await res.json().catch(() => null);
        alert(errData?.message || "Failed to retry ingestion job.");
      }
    } catch (err) {
      console.error("Failed to retry ingestion job:", err);
      alert("Error retrying ingestion job");
    } finally {
      setRetryingIngestionJobId(null);
    }
  };

  const handleOpenRecoverModal = (job: JobProgress, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setRecoveringJob(job);
    setRecoverAudioFile(null);
    setRecoverVideoFile(null);
    setRecoverClipStartMin("");
    setRecoverClipStartSec("");
    setRecoverClipEndMin("");
    setRecoverClipEndSec("");
    setRecoverError(null);
    setRecoverPercent(null);
    setIsRecovering(false);
  };

  const handleCloseRecoverModal = () => {
    if (isRecovering) return;
    setRecoveringJob(null);
    setRecoverAudioFile(null);
    setRecoverVideoFile(null);
    setRecoverError(null);
  };

  const handleRecoverJobSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveringJob) return;

    if (!recoverAudioFile && !recoverVideoFile) {
      setRecoverError({
        title: "No Media Selected",
        message: "Please select at least one replacement audio or video file to reprocess.",
      });
      return;
    }

    if (!isDeviceOnline()) {
      setRecoverError({
        title: "You Are Offline",
        message: "Network is currently disconnected. Reconnect to upload replacement media.",
        isNetworkError: true,
      });
      return;
    }

    setIsRecovering(true);
    setRecoverError(null);

    const retryHandler = (attempt: number, maxRetries: number, delayMs: number) => {
      setIsRecoverRetrying(true);
      setRecoverRetryStatusText(
        `Network issue detected. Retrying in ${Math.ceil(delayMs / 1000)}s (attempt ${attempt}/${maxRetries})...`
      );
    };

    try {
      let tempSongKey: string | null = null;
      let tempVideoKey: string | null = null;

      // 1. Upload replacement audio if selected
      if (recoverAudioFile) {
        setRecoverProgressText("Uploading replacement audio to S3...");
        setRecoverPercent(0);
        setRecoverStats({ fileName: recoverAudioFile.name });

        const urlRes = await adminFetch("/webhook/internal/song-upload-url");
        if (!urlRes.ok) throw new Error("Failed to authorize audio upload");
        const urlData = await urlRes.json();

        await uploadWithProgress(
          urlData.preSignedUrl,
          recoverAudioFile,
          "PUT",
          { "Content-Type": recoverAudioFile.type || "audio/mpeg" },
          (p) => {
            setRecoverPercent(p.percent);
            setRecoverStats({
              loadedText: `${p.loadedFormatted} / ${p.totalFormatted}`,
              speedText: p.speedText,
              fileName: recoverAudioFile.name,
            });
          },
          { onRetry: retryHandler }
        );
        setIsRecoverRetrying(false);
        setRecoverRetryStatusText("");
        tempSongKey = urlData.key;
      }

      // 2. Upload replacement video if selected
      if (recoverVideoFile) {
        setRecoverProgressText("Uploading replacement video to S3...");
        setRecoverPercent(0);
        setRecoverStats({ fileName: recoverVideoFile.name });

        const urlRes = await adminFetch("/webhook/internal/video-upload-url");
        if (!urlRes.ok) throw new Error("Failed to authorize video upload");
        const urlData = await urlRes.json();

        await uploadWithProgress(
          urlData.preSignedUrl,
          recoverVideoFile,
          "PUT",
          { "Content-Type": recoverVideoFile.type || "video/mp4" },
          (p) => {
            setRecoverPercent(p.percent);
            setRecoverStats({
              loadedText: `${p.loadedFormatted} / ${p.totalFormatted}`,
              speedText: p.speedText,
              fileName: recoverVideoFile.name,
            });
          },
          { onRetry: retryHandler }
        );
        setIsRecoverRetrying(false);
        setRecoverRetryStatusText("");
        tempVideoKey = urlData.key;
      }

      // 3. Parse optional canvas clip timestamps
      let clipStartMin: number | undefined = undefined;
      let clipStartSec: number | undefined = undefined;
      let clipEndMin: number | undefined = undefined;
      let clipEndSec: number | undefined = undefined;

      if (recoverClipStartMin !== "") clipStartMin = parseInt(String(recoverClipStartMin), 10) || 0;
      if (recoverClipStartSec !== "") clipStartSec = parseInt(String(recoverClipStartSec), 10) || 0;
      if (recoverClipEndMin !== "") clipEndMin = parseInt(String(recoverClipEndMin), 10) || 0;
      if (recoverClipEndSec !== "") clipEndSec = parseInt(String(recoverClipEndSec), 10) || 0;

      // 4. Trigger recovery endpoint on coreEngine
      setRecoverProgressText("Re-enqueueing job with healthy media...");
      setRecoverPercent(100);

      const res = await adminFetch(`/admin/jobs/${recoveringJob.id}/recover-media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tempSongKey,
          tempVideoKey,
          clipStartMin,
          clipStartSec,
          clipEndMin,
          clipEndSec,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.message || "Failed to recover failed ingestion job.");
      }

      const updated: JobProgress = await res.json();
      setAllJobs((prev) => prev.map((j) => (j.id === recoveringJob.id ? updated : j)));
      setActiveJobs((prev) => {
        const exists = prev.some((j) => j.id === recoveringJob.id);
        if (exists) {
          return prev.map((j) => (j.id === recoveringJob.id ? updated : j));
        }
        return [updated, ...prev];
      });
      if (selectedJob?.id === recoveringJob.id) {
        setSelectedJob(updated);
      }
      fetchData(false);
      setRecoveringJob(null);
    } catch (err: any) {
      console.error("Failed to recover job:", err);
      const friendly = getFriendlyUploadErrorMessage(err);
      setRecoverError(friendly);
    } finally {
      setIsRecovering(false);
      setIsRecoverRetrying(false);
      setRecoverRetryStatusText("");
    }
  };

  const handleDeleteIngestionJob = async (jobId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm("Are you sure you want to delete this job? This will clean up all associated garbage: S3 audio/video files, temporary uploads, Algolia search records, Recombee vectors, and database entities.")) {
      return;
    }
    try {
      setDeletingJobId(jobId);
      const res = await adminFetch(`/admin/jobs/${jobId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setAllJobs((prev) => prev.filter((j) => j.id !== jobId));
        setActiveJobs((prev) => prev.filter((j) => j.id !== jobId));
        if (selectedJob?.id === jobId) {
          setSelectedJob(null);
        }
        fetchData(false);
      } else {
        const errData = await res.json().catch(() => null);
        alert(errData?.message || "Failed to delete ingestion job.");
      }
    } catch (err) {
      console.error("Failed to delete ingestion job:", err);
      alert("Error deleting ingestion job");
    } finally {
      setDeletingJobId(null);
    }
  };

  const handlePurgeAllFailedJobs = async () => {
    if (!confirm("Are you sure you want to purge ALL failed jobs? This will permanently wipe all associated residual S3 audio/video files, halt Inngest executions, and remove Algolia/Recombee records.")) {
      return;
    }
    try {
      setIsPurgingFailedJobs(true);
      const res = await adminFetch("/admin/jobs/failed", {
        method: "DELETE",
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(`Successfully purged ${data.deletedCount ?? 0} failed job(s) and their cloud/storage artifacts.`);
        if (selectedJob?.status === "FAILED") {
          setSelectedJob(null);
        }
        fetchData(false);
      } else {
        const errData = await res.json().catch(() => null);
        alert(errData?.message || "Failed to purge failed jobs.");
      }
    } catch (err) {
      console.error("Failed to purge failed jobs:", err);
      alert("Error purging failed jobs");
    } finally {
      setIsPurgingFailedJobs(false);
    }
  };

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

  const handleDeleteDeleteJob = async (jobId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm("Are you sure you want to delete this cascade delete audit record? This cannot be undone.")) {
      return;
    }
    try {
      setDeletingDeleteJobId(jobId);
      const res = await adminFetch(`/admin/delete-jobs/${jobId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setAllDeleteJobs((prev) => prev.filter((j) => j.id !== jobId));
        setActiveDeleteJobs((prev) => prev.filter((j) => j.id !== jobId));
        if (selectedDeleteJob?.id === jobId) {
          setSelectedDeleteJob(null);
        }
        fetchData(false);
      } else {
        const errData = await res.json().catch(() => null);
        alert(errData?.message || "Failed to delete cascade delete record.");
      }
    } catch (err) {
      console.error("Failed to delete cascade delete job:", err);
      alert("Error deleting cascade delete job");
    } finally {
      setDeletingDeleteJobId(null);
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

  const filteredJobs = allJobs;
  const filteredDeleteJobs = allDeleteJobs;

  return (
    <div className="p-6 md:p-8 max-w-[1600px] mx-auto space-y-8 text-white font-sans">
      {/* Header & Tab Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              {activeTab === "INGESTION" ? (
                <Zap className="w-5 h-5 text-white fill-white" />
              ) : (
                <Trash2 className="w-5 h-5 text-rose-400 fill-rose-500/20" />
              )}
              {activeTab === "INGESTION" ? "Song Ingestion Pipeline" : "Cascade Delete Pipeline"}
            </h1>
            {activeTab === "INGESTION" && activeJobs.length > 0 && (
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-white/10 text-white border border-white/20 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-white" />
                {activeJobs.length} active
              </span>
            )}
            {activeTab === "DELETION" && activeDeleteJobs.length > 0 && (
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                {activeDeleteJobs.length} active
              </span>
            )}
          </div>
          <p className="text-zinc-400 text-sm mt-1">
            {activeTab === "INGESTION"
              ? "Real-time telemetry, stage execution time, retry tracking, and webhook lifecycle logs for audio & canvas transcoding."
              : "End-to-end cascade deletion tracking across Algolia, Recombee, ImageKit CDN, AWS S3, and PostgreSQL with 1-click retry."}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Tab Selector */}
          <div className="flex bg-black/60 p-1 rounded-full border border-[#282828]">
            <button
              onClick={() => setActiveTab("INGESTION")}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all ${
                activeTab === "INGESTION"
                  ? "bg-white text-black shadow-sm"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <Workflow className="w-3.5 h-3.5" />
              Ingestion Pipeline
            </button>
            <button
              onClick={() => setActiveTab("DELETION")}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all ${
                activeTab === "DELETION"
                  ? "bg-white text-black shadow-sm"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Cascade Delete
            </button>
          </div>

          {/* Auto-Refresh Toggle */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3.5 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-2 border ${
              autoRefresh
                ? "bg-white/10 text-white border-white/20"
                : "bg-black/60 text-zinc-400 border-[#282828]"
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${autoRefresh ? "bg-emerald-400 animate-ping" : "bg-zinc-600"}`} />
            {autoRefresh ? "Live 4s" : "Paused"}
          </button>

          {/* Refresh Button */}
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="p-2.5 bg-black/60 hover:bg-[#181818] border border-[#282828] rounded-full text-zinc-300 hover:text-white transition-all active:scale-95 disabled:opacity-50"
            title="Refresh now"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-white" : ""}`} />
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
            <div className="p-5 rounded-2xl bg-[#121212] border border-[#282828] shadow-sm relative overflow-hidden group hover:border-zinc-700 hover:bg-[#181818] transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Processing</span>
                <div className="w-8 h-8 rounded-xl bg-black border border-[#282828] text-white flex items-center justify-center">
                  <Activity className="w-4 h-4 animate-pulse" />
                </div>
              </div>
              <div className="text-3xl font-bold text-white">
                {metrics?.currentlyProcessing ?? 0}
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
                {metrics?.pendingQueued ?? 0}
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
                {metrics?.completed ?? 0}
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
                {metrics?.failed ?? 0}
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
                {metrics?.totalJobs ?? 0}
              </div>
              <p className="text-[11px] text-zinc-400 mt-1">All pipeline executions</p>
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
                Avg Total: {formatMs(metrics?.avgTotalMs)}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-2">
              {/* Stage 1: Queued */}
              <div className="p-4 rounded-xl bg-black/50 border border-[#282828] relative group">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-bold text-amber-400">1. Pickup &amp; Download</span>
                  <Radio className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <div className="text-lg font-bold text-white">
                  {metrics?.stageBreakdown?.["QUEUED"] ?? 0}
                </div>
                <div className="text-[11px] text-zinc-400 mt-1">Pending worker pickup</div>
              </div>

              {/* Stage 2: Transcoding */}
              <div className="p-4 rounded-xl bg-black/50 border border-[#282828] relative group">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-bold text-white">2. Transcoding (DASH/HLS)</span>
                  <Cpu className="w-3.5 h-3.5 text-white" />
                </div>
                <div className="text-lg font-bold text-white">
                  {metrics?.stageBreakdown?.["TRANSCODING"] ?? 0}
                </div>
                <div className="text-[11px] text-zinc-400 mt-1">
                  Avg: {formatMs(metrics?.avgTranscodingMs)}
                </div>
              </div>

              {/* Stage 3: Recombee */}
              <div className="p-4 rounded-xl bg-black/50 border border-[#282828] relative group">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-bold text-zinc-200">3. Recombee AI</span>
                  <Sparkles className="w-3.5 h-3.5 text-zinc-200" />
                </div>
                <div className="text-lg font-bold text-white">
                  {metrics?.stageBreakdown?.["RECOMMENDATION_INDEXING"] ?? 0}
                </div>
                <div className="text-[11px] text-zinc-400 mt-1">
                  Avg: {formatMs(metrics?.avgRecommendationMs)}
                </div>
              </div>

              {/* Stage 4: Algolia */}
              <div className="p-4 rounded-xl bg-black/50 border border-[#282828] relative group">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-bold text-zinc-200">4. Algolia Search</span>
                  <Search className="w-3.5 h-3.5 text-zinc-200" />
                </div>
                <div className="text-lg font-bold text-white">
                  {metrics?.stageBreakdown?.["SEARCH_INDEXING"] ?? 0}
                </div>
                <div className="text-[11px] text-zinc-400 mt-1">
                  Avg: {formatMs(metrics?.avgSearchMs)}
                </div>
              </div>

              {/* Stage 5: Finalizing */}
              <div className="p-4 rounded-xl bg-black/50 border border-[#282828] relative group">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-bold text-emerald-400">5. Finalize Song</span>
                  <Database className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <div className="text-lg font-bold text-white">
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
            <div className="p-6 rounded-2xl bg-black/50 border border-[#282828] shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
                  </span>
                  <h3 className="text-sm font-bold text-white">
                    Actively In Flight ({activeJobs.length})
                  </h3>
                </div>
                <span className="text-xs text-zinc-400 font-mono">
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
                      className="p-4 rounded-xl bg-[#121212] border border-[#282828] shadow-sm cursor-pointer hover:border-zinc-600 hover:bg-[#181818] transition-all space-y-3 group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative w-11 h-11 rounded-xl overflow-hidden bg-black shrink-0 border border-[#282828]">
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
                          <h4 className="font-bold text-xs text-white truncate group-hover:underline transition-colors">
                            {job.title}
                          </h4>
                          <p className="text-[11px] text-zinc-400 truncate">{job.artistName}</p>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${stageBadge.bg}`}>
                          {stageBadge.label}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono pt-2 border-t border-[#282828]">
                        <span>Elapsed: {formatMs(job.elapsedTotalMs)}</span>
                        {job.transcodingAttempt > 1 && (
                          <span className="text-amber-400 font-bold">
                            Attempt #{job.transcodingAttempt}
                          </span>
                        )}
                        <span className="text-white flex items-center gap-1 font-bold">
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
                    onClick={() => {
                      setStatusFilter(s);
                      setPage(0);
                    }}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                      statusFilter === s
                        ? "bg-white text-black border-white shadow-sm"
                        : "bg-[#121212] text-zinc-400 border-[#282828] hover:text-white hover:border-zinc-700"
                    }`}
                  >
                    {s}
                  </button>
                ))}
                {statusFilter === "FAILED" && (
                  <button
                    onClick={handlePurgeAllFailedJobs}
                    disabled={isPurgingFailedJobs}
                    className="ml-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all border bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-600 hover:text-white flex items-center gap-1.5"
                  >
                    <Trash2 className={`w-3.5 h-3.5 ${isPurgingFailedJobs ? "animate-spin" : ""}`} />
                    <span>{isPurgingFailedJobs ? "Purging Failed Jobs..." : "Purge All Failed"}</span>
                  </button>
                )}
              </div>

              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Search song, artist, job ID..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(0);
                  }}
                  className="w-full pl-9 pr-4 py-2 bg-[#121212] border border-[#282828] rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white focus:ring-1 focus:ring-white/20 transition-all"
                />
              </div>
            </div>

            {/* Ingestion Jobs Table */}
            <div className="bg-[#121212] border border-[#282828] rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-black/60 border-b border-[#282828] text-zinc-400 uppercase font-bold tracking-wider text-[10px]">
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
                  <tbody className="divide-y divide-[#282828] font-mono">
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
                            className="hover:bg-[#181818] transition-colors cursor-pointer group"
                          >
                            <td className="py-3 px-4 font-sans">
                              <div className="flex items-center gap-3">
                                <div className="relative w-8 h-8 rounded-lg overflow-hidden bg-black shrink-0 border border-[#282828]">
                                  {job.imageKey ? (
                                    <Image
                                      src={getImageUrl(job.imageKey, { width: 80, height: 80 })}
                                      alt={job.title}
                                      fill
                                      className="object-cover"
                                      unoptimized
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-[9px] text-zinc-500">
                                      IMG
                                    </div>
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-bold text-white truncate max-w-[200px] group-hover:underline transition-colors">
                                    {job.title}
                                  </div>
                                  <div className="text-[11px] text-zinc-400 truncate max-w-[200px]">
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

                            <td className="py-3 px-4 text-zinc-400">
                              {job.transcodingAttempt > 1 ? (
                                <span className="font-bold text-amber-400">#{job.transcodingAttempt}</span>
                              ) : (
                                "#1"
                              )}
                            </td>

                            <td className="py-3 px-4 text-zinc-400">
                              {formatMs(job.transcodingDurationMs)}
                            </td>

                            <td className="py-3 px-4 font-bold text-white">
                              {formatMs(job.totalDurationMs || job.elapsedTotalMs)}
                            </td>

                            <td className="py-3 px-4 text-zinc-500 text-[11px]">
                              {formatTime(job.createdAt)}
                            </td>

                            <td className="py-3 px-4 text-right font-sans">
                              <div className="flex items-center justify-end gap-2">
                                {job.status === "FAILED" && (
                                  <>
                                    <button
                                      onClick={(e) => handleOpenRecoverModal(job, e)}
                                      className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-600 hover:text-white border border-emerald-500/30 font-bold text-[11px] rounded-lg transition-all flex items-center gap-1 shadow-sm"
                                      title="Upload replacement audio/video and recover job"
                                    >
                                      <UploadCloud className="w-3 h-3" />
                                      Recover
                                    </button>
                                    <button
                                      onClick={(e) => handleRetryIngestionJob(job.id, e)}
                                      disabled={retryingIngestionJobId === job.id}
                                      className="px-2.5 py-1 bg-amber-500/10 text-amber-400 hover:bg-amber-600 hover:text-white border border-amber-500/30 font-bold text-[11px] rounded-lg transition-all flex items-center gap-1"
                                      title="1-Click Retry Ingestion"
                                    >
                                      <RotateCcw className={`w-3 h-3 ${retryingIngestionJobId === job.id ? "animate-spin" : ""}`} />
                                      Retry
                                    </button>
                                  </>
                                )}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedJob(job);
                                  }}
                                  className="px-3 py-1 bg-black/60 hover:bg-white hover:text-black border border-[#282828] text-zinc-300 font-bold text-[11px] rounded-lg transition-all"
                                >
                                  View Stages
                                </button>
                                <button
                                  onClick={(e) => handleDeleteIngestionJob(job.id, e)}
                                  disabled={deletingJobId === job.id}
                                  className="p-1.5 bg-rose-500/10 text-rose-400 hover:bg-rose-600 hover:text-white border border-rose-500/20 rounded-lg transition-all"
                                  title="Delete Job & Purge Cloud Artifacts"
                                >
                                  <Trash2 className={`w-3.5 h-3.5 ${deletingJobId === job.id ? "animate-spin" : ""}`} />
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

              {/* Ingestion Table Pagination Bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-[#282828] bg-black/40 text-xs text-zinc-400">
                <div className="flex items-center gap-3">
                  <span>
                    Showing{" "}
                    <strong className="text-white font-semibold">
                      {totalJobsCount === 0 ? 0 : page * pageSize + 1}
                    </strong>{" "}
                    to{" "}
                    <strong className="text-white font-semibold">
                      {Math.min((page + 1) * pageSize, totalJobsCount)}
                    </strong>{" "}
                    of{" "}
                    <strong className="text-white font-semibold">
                      {totalJobsCount}
                    </strong>{" "}
                    jobs
                  </span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPage(0);
                    }}
                    className="bg-[#181818] border border-[#282828] text-zinc-300 text-xs rounded-lg px-2.5 py-1 focus:outline-none focus:border-zinc-500 cursor-pointer"
                  >
                    <option value={10}>10 per page</option>
                    <option value={20}>20 per page</option>
                    <option value={50}>50 per page</option>
                    <option value={100}>100 per page</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setPage(0)}
                    disabled={page === 0}
                    className="p-1.5 rounded-lg border border-[#282828] bg-[#181818] text-zinc-400 hover:text-white hover:border-zinc-500 disabled:opacity-30 disabled:hover:border-[#282828] disabled:hover:text-zinc-400 transition-all cursor-pointer disabled:cursor-not-allowed"
                    title="First Page"
                  >
                    <ChevronsLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="p-1.5 rounded-lg border border-[#282828] bg-[#181818] text-zinc-400 hover:text-white hover:border-zinc-500 disabled:opacity-30 disabled:hover:border-[#282828] disabled:hover:text-zinc-400 transition-all cursor-pointer disabled:cursor-not-allowed"
                    title="Previous Page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <span className="px-3 py-1 font-mono text-zinc-300 text-xs">
                    Page <strong className="text-white">{page + 1}</strong> of{" "}
                    <strong className="text-white">
                      {Math.max(1, Math.ceil(totalJobsCount / pageSize))}
                    </strong>
                  </span>

                  <button
                    onClick={() =>
                      setPage((p) =>
                        Math.min(Math.ceil(totalJobsCount / pageSize) - 1, p + 1)
                      )
                    }
                    disabled={page >= Math.ceil(totalJobsCount / pageSize) - 1}
                    className="p-1.5 rounded-lg border border-[#282828] bg-[#181818] text-zinc-400 hover:text-white hover:border-zinc-500 disabled:opacity-30 disabled:hover:border-[#282828] disabled:hover:text-zinc-400 transition-all cursor-pointer disabled:cursor-not-allowed"
                    title="Next Page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() =>
                      setPage(Math.max(0, Math.ceil(totalJobsCount / pageSize) - 1))
                    }
                    disabled={page >= Math.ceil(totalJobsCount / pageSize) - 1}
                    className="p-1.5 rounded-lg border border-[#282828] bg-[#181818] text-zinc-400 hover:text-white hover:border-zinc-500 disabled:opacity-30 disabled:hover:border-[#282828] disabled:hover:text-zinc-400 transition-all cursor-pointer disabled:cursor-not-allowed"
                    title="Last Page"
                  >
                    <ChevronsRight className="w-4 h-4" />
                  </button>
                </div>
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
            <div className="p-5 rounded-3xl bg-[#121212] border border-[#282828] shadow-sm relative overflow-hidden group hover:border-zinc-700 transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-rose-400 uppercase tracking-wider">In Progress</span>
                <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center">
                  <Activity className="w-4 h-4 animate-pulse" />
                </div>
              </div>
              <div className="text-3xl font-black text-white">
                {deleteMetrics?.currentlyProcessing ?? 0}
              </div>
              <p className="text-[11px] text-zinc-500 mt-1">Purging cloud assets</p>
            </div>

            {/* In Queue (delete_event_queue) */}
            <div className="p-5 rounded-3xl bg-[#121212] border border-[#282828] shadow-sm relative overflow-hidden group hover:border-zinc-700 transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">In Queue</span>
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl font-black text-white">
                {deleteMetrics?.pendingQueued ?? 0}
              </div>
              <p className="text-[11px] text-zinc-500 mt-1">Redis queue: {deleteMetrics?.deleteQueueDepth ?? 0}</p>
            </div>

            {/* Successfully Completed */}
            <div className="p-5 rounded-3xl bg-[#121212] border border-[#282828] shadow-sm relative overflow-hidden group hover:border-zinc-700 transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Purged &amp; Deleted</span>
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl font-black text-white">
                {deleteMetrics?.completed ?? 0}
              </div>
              <p className="text-[11px] text-zinc-500 mt-1">Zero orphaned assets</p>
            </div>

            {/* Failed Deletes */}
            <div className="p-5 rounded-3xl bg-[#121212] border border-[#282828] shadow-sm relative overflow-hidden group hover:border-zinc-700 transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-rose-400 uppercase tracking-wider">Failed</span>
                <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl font-black text-white">
                {deleteMetrics?.failed ?? 0}
              </div>
              <p className="text-[11px] text-zinc-500 mt-1">Actionable retry available</p>
            </div>

            {/* Total Delete Jobs */}
            <div className="p-5 rounded-3xl bg-[#121212] border border-[#282828] shadow-sm relative overflow-hidden col-span-2 md:col-span-1 group hover:border-zinc-700 transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Total Lifetime</span>
                <div className="w-8 h-8 rounded-xl bg-black/60 text-zinc-300 border border-[#282828] flex items-center justify-center">
                  <Trash2 className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl font-black text-white">
                {deleteMetrics?.totalJobs ?? 0}
              </div>
              <p className="text-[11px] text-zinc-500 mt-1">All cascade operations</p>
            </div>
          </div>

          {/* Delete Cascade Architecture Flowchart */}
          <div className="p-6 rounded-3xl bg-[#121212] border border-[#282828] shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <CloudLightning className="w-4 h-4 text-rose-400" />
                  Cascade Delete Architecture &amp; Cleanup Flow
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Sequential cloud teardown ensuring complete atomicity across search, AI recommendations, CDN, S3, and database.
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-zinc-300 bg-black/60 border border-[#282828] px-3 py-1 rounded-full">
                Avg Cleanup: {formatMs(deleteMetrics?.avgTotalMs)}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-2">
              {/* Step 1: Algolia Purge */}
              <div className="p-4 rounded-2xl bg-black/60 border border-[#282828] relative group hover:border-zinc-600 transition-all">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-bold text-cyan-400">1. Algolia Sync</span>
                  <Search className="w-3.5 h-3.5 text-cyan-400" />
                </div>
                <div className="text-lg font-black text-white">
                  {deleteMetrics?.stageBreakdown?.["SEARCH_DELETED"] ?? 0}
                </div>
                <div className="text-[11px] text-zinc-400 mt-1 font-mono">
                  Avg: {formatMs(deleteMetrics?.avgSearchMs)}
                </div>
              </div>

              {/* Step 2: Recombee Purge */}
              <div className="p-4 rounded-2xl bg-black/60 border border-[#282828] relative group hover:border-zinc-600 transition-all">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-bold text-purple-400">2. Recombee AI</span>
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                </div>
                <div className="text-lg font-black text-white">
                  {deleteMetrics?.stageBreakdown?.["RECOMMENDATION_DELETED"] ?? 0}
                </div>
                <div className="text-[11px] text-zinc-400 mt-1 font-mono">
                  Avg: {formatMs(deleteMetrics?.avgRecommendationMs)}
                </div>
              </div>

              {/* Step 3: ImageKit CDN Purge */}
              <div className="p-4 rounded-2xl bg-black/60 border border-[#282828] relative group hover:border-zinc-600 transition-all">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-bold text-pink-400">3. ImageKit CDN</span>
                  <Activity className="w-3.5 h-3.5 text-pink-400" />
                </div>
                <div className="text-lg font-black text-white">
                  {deleteMetrics?.stageBreakdown?.["IMAGEKIT_DELETED"] ?? 0}
                </div>
                <div className="text-[11px] text-zinc-400 mt-1 font-mono">
                  Avg: {formatMs(deleteMetrics?.avgImageKitMs)}
                </div>
              </div>

              {/* Step 4: S3 Audio & Video Purge */}
              <div className="p-4 rounded-2xl bg-black/60 border border-[#282828] relative group hover:border-zinc-600 transition-all">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-bold text-indigo-400">4. S3 Media Prefix</span>
                  <HardDrive className="w-3.5 h-3.5 text-indigo-400" />
                </div>
                <div className="text-lg font-black text-white">
                  {deleteMetrics?.stageBreakdown?.["S3_DELETED"] ?? 0}
                </div>
                <div className="text-[11px] text-zinc-400 mt-1 font-mono">
                  Avg: {formatMs(deleteMetrics?.avgS3Ms)}
                </div>
              </div>

              {/* Step 5: Database Hard Delete */}
              <div className="p-4 rounded-2xl bg-black/60 border border-[#282828] relative group hover:border-zinc-600 transition-all">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-bold text-emerald-400">5. Hard Delete</span>
                  <Database className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <div className="text-lg font-black text-white">
                  {deleteMetrics?.stageBreakdown?.["COMPLETED"] ?? 0}
                </div>
                <div className="text-[11px] text-zinc-400 mt-1 font-mono">
                  Avg: {formatMs(deleteMetrics?.avgFinalizeMs)}
                </div>
              </div>
            </div>
          </div>

          {/* Active Delete Jobs Live Monitor */}
          {activeDeleteJobs.length > 0 && (
            <div className="p-6 rounded-3xl bg-[#121212] border border-rose-500/30 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
                  </span>
                  <h3 className="text-sm font-bold text-white">
                    Active Deletion Tasks ({activeDeleteJobs.length})
                  </h3>
                </div>
                <span className="text-xs text-rose-400 font-mono">
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
                      className="p-4 rounded-2xl bg-black/60 border border-[#282828] shadow-sm cursor-pointer hover:border-rose-500/60 transition-all space-y-3 group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-black/80 border border-[#282828] text-zinc-400 uppercase">
                          {job.entityType}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${stageBadge.bg}`}>
                          {stageBadge.label}
                        </span>
                      </div>

                      <div>
                        <h4 className="font-bold text-xs text-white truncate group-hover:text-rose-400 transition-colors">
                          {job.entityTitle || job.entityId}
                        </h4>
                        <p className="text-[11px] text-zinc-500 font-mono truncate">{job.entityId}</p>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono pt-2 border-t border-[#282828]">
                        <span>Elapsed: {formatMs(job.elapsedTotalMs)}</span>
                        <span className="text-rose-400 flex items-center gap-1 font-bold">
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
                    onClick={() => {
                      setDeleteStatusFilter(s);
                      setDeletePage(0);
                    }}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                      deleteStatusFilter === s
                        ? "bg-white text-black border-white shadow-sm"
                        : "bg-black/60 text-zinc-400 border-[#282828] hover:text-white hover:border-zinc-500"
                    }`}
                  >
                    {s}
                  </button>
                ))}

                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 ml-3">Type:</span>
                {["ALL", "SONG", "PLAYLIST", "ARTIST"].map((t) => (
                  <button
                    key={t}
                    onClick={() => {
                      setDeleteTypeFilter(t);
                      setDeletePage(0);
                    }}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                      deleteTypeFilter === t
                        ? "bg-white text-black border-white shadow-sm"
                        : "bg-black/60 text-zinc-400 border-[#282828] hover:text-white hover:border-zinc-500"
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
                  onChange={(e) => {
                    setDeleteSearchQuery(e.target.value);
                    setDeletePage(0);
                  }}
                  className="w-full pl-9 pr-4 py-2 bg-[#121212] border border-[#282828] rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-400 transition-all"
                />
              </div>
            </div>

            {/* Delete Jobs Table */}
            <div className="bg-[#121212] border border-[#282828] rounded-3xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-black/60 border-b border-[#282828] text-zinc-400 uppercase font-bold tracking-wider text-[10px]">
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
                  <tbody className="divide-y divide-[#282828] font-mono">
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
                            className="hover:bg-zinc-800/30 transition-colors cursor-pointer group"
                          >
                            <td className="py-3 px-4 font-sans">
                              <div className="min-w-0">
                                <div className="font-bold text-white truncate max-w-[220px] group-hover:text-rose-400 transition-colors">
                                  {job.entityTitle || "Untitled Entity"}
                                </div>
                                <div className="text-[11px] text-zinc-500 font-mono truncate max-w-[220px]">
                                  {job.entityId}
                                </div>
                              </div>
                            </td>

                            <td className="py-3 px-4 font-sans">
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-black/60 border border-[#282828] text-zinc-300">
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

                            <td className="py-3 px-4 text-zinc-300">
                              {job.attemptCount > 1 ? (
                                <span className="font-bold text-amber-400">#{job.attemptCount}</span>
                              ) : (
                                "#1"
                              )}
                              <span className="text-[10px] text-zinc-500"> / {job.maxAttempts}</span>
                            </td>

                            <td className="py-3 px-4 text-zinc-300">
                              {formatMs(job.s3DurationMs)}
                            </td>

                            <td className="py-3 px-4 font-bold text-white">
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
                                    className="px-2.5 py-1 bg-rose-500/10 text-rose-400 hover:bg-rose-600 hover:text-white border border-rose-500/30 font-bold text-[11px] rounded-lg transition-all flex items-center gap-1"
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
                                  className="px-3 py-1 bg-black/60 hover:bg-white hover:text-black border border-[#282828] text-zinc-300 font-bold text-[11px] rounded-lg transition-all"
                                >
                                  Details
                                </button>
                                <button
                                  onClick={(e) => handleDeleteDeleteJob(job.id, e)}
                                  disabled={deletingDeleteJobId === job.id}
                                  className="p-1.5 bg-rose-500/10 text-rose-400 hover:bg-rose-600 hover:text-white border border-rose-500/20 rounded-lg transition-all"
                                  title="Delete Audit Record"
                                >
                                  <Trash2 className={`w-3.5 h-3.5 ${deletingDeleteJobId === job.id ? "animate-pulse" : ""}`} />
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

              {/* Cascade Delete Table Pagination Bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-[#282828] bg-black/40 text-xs text-zinc-400">
                <div className="flex items-center gap-3">
                  <span>
                    Showing{" "}
                    <strong className="text-white font-semibold">
                      {totalDeleteJobsCount === 0 ? 0 : deletePage * deletePageSize + 1}
                    </strong>{" "}
                    to{" "}
                    <strong className="text-white font-semibold">
                      {Math.min((deletePage + 1) * deletePageSize, totalDeleteJobsCount)}
                    </strong>{" "}
                    of{" "}
                    <strong className="text-white font-semibold">
                      {totalDeleteJobsCount}
                    </strong>{" "}
                    audit records
                  </span>
                  <select
                    value={deletePageSize}
                    onChange={(e) => {
                      setDeletePageSize(Number(e.target.value));
                      setDeletePage(0);
                    }}
                    className="bg-[#181818] border border-[#282828] text-zinc-300 text-xs rounded-lg px-2.5 py-1 focus:outline-none focus:border-zinc-500 cursor-pointer"
                  >
                    <option value={10}>10 per page</option>
                    <option value={20}>20 per page</option>
                    <option value={50}>50 per page</option>
                    <option value={100}>100 per page</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setDeletePage(0)}
                    disabled={deletePage === 0}
                    className="p-1.5 rounded-lg border border-[#282828] bg-[#181818] text-zinc-400 hover:text-white hover:border-zinc-500 disabled:opacity-30 disabled:hover:border-[#282828] disabled:hover:text-zinc-400 transition-all cursor-pointer disabled:cursor-not-allowed"
                    title="First Page"
                  >
                    <ChevronsLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeletePage((p) => Math.max(0, p - 1))}
                    disabled={deletePage === 0}
                    className="p-1.5 rounded-lg border border-[#282828] bg-[#181818] text-zinc-400 hover:text-white hover:border-zinc-500 disabled:opacity-30 disabled:hover:border-[#282828] disabled:hover:text-zinc-400 transition-all cursor-pointer disabled:cursor-not-allowed"
                    title="Previous Page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <span className="px-3 py-1 font-mono text-zinc-300 text-xs">
                    Page <strong className="text-white">{deletePage + 1}</strong> of{" "}
                    <strong className="text-white">
                      {Math.max(1, Math.ceil(totalDeleteJobsCount / deletePageSize))}
                    </strong>
                  </span>

                  <button
                    onClick={() =>
                      setDeletePage((p) =>
                        Math.min(Math.ceil(totalDeleteJobsCount / deletePageSize) - 1, p + 1)
                      )
                    }
                    disabled={deletePage >= Math.ceil(totalDeleteJobsCount / deletePageSize) - 1}
                    className="p-1.5 rounded-lg border border-[#282828] bg-[#181818] text-zinc-400 hover:text-white hover:border-zinc-500 disabled:opacity-30 disabled:hover:border-[#282828] disabled:hover:text-zinc-400 transition-all cursor-pointer disabled:cursor-not-allowed"
                    title="Next Page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() =>
                      setDeletePage(Math.max(0, Math.ceil(totalDeleteJobsCount / deletePageSize) - 1))
                    }
                    disabled={deletePage >= Math.ceil(totalDeleteJobsCount / deletePageSize) - 1}
                    className="p-1.5 rounded-lg border border-[#282828] bg-[#181818] text-zinc-400 hover:text-white hover:border-zinc-500 disabled:opacity-30 disabled:hover:border-[#282828] disabled:hover:text-zinc-400 transition-all cursor-pointer disabled:cursor-not-allowed"
                    title="Last Page"
                  >
                    <ChevronsRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ========================================================================= */}
      {/* INGESTION DETAIL MODAL                                                    */}
      {/* ========================================================================= */}
      {selectedJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-[#121212] border border-[#282828] rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="p-6 border-b border-[#282828] flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-black/60 shrink-0 border border-[#282828]">
                  {selectedJob.imageKey ? (
                    <Image
                      src={getImageUrl(selectedJob.imageKey, { width: 120, height: 120 })}
                      alt={selectedJob.title}
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
                <div>
                  <h3 className="font-bold text-base text-white flex items-center gap-2">
                    {selectedJob.title}
                    {selectedJob.isVideoReprocess && (
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 font-bold border border-indigo-500/30">
                        Canvas Reprocess
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-zinc-400">{selectedJob.artistName} • Job ID: {selectedJob.id}</p>
                </div>
              </div>

              <button
                onClick={() => setSelectedJob(null)}
                className="p-2 text-zinc-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Failure Banner if Failed */}
              {selectedJob.status === "FAILED" && (() => {
                const failure = formatFailureNotice(selectedJob.failureReason);
                return (
                  <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-rose-400" />
                        <div>
                          <h4 className="text-xs font-bold uppercase tracking-wider text-rose-300">{failure.title}</h4>
                          <p className="text-xs mt-1 text-zinc-300 leading-relaxed font-sans">{failure.explanation}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleOpenRecoverModal(selectedJob)}
                          className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs rounded-full transition-all flex items-center gap-1.5 shadow-sm"
                          title="Upload fixed audio/video and reprocess job"
                        >
                          <UploadCloud className="w-3.5 h-3.5" />
                          Upload & Reprocess
                        </button>
                        <button
                          onClick={() => handleRetryIngestionJob(selectedJob.id)}
                          disabled={retryingIngestionJobId === selectedJob.id}
                          className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs rounded-full transition-all flex items-center gap-1.5 shadow-sm"
                        >
                          <RotateCcw className={`w-3.5 h-3.5 ${retryingIngestionJobId === selectedJob.id ? "animate-spin" : ""}`} />
                          Retry
                        </button>
                        <button
                          onClick={() => handleDeleteIngestionJob(selectedJob.id)}
                          disabled={deletingJobId === selectedJob.id}
                          className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-full transition-all flex items-center gap-1.5 shadow-sm"
                        >
                          <Trash2 className={`w-3.5 h-3.5 ${deletingJobId === selectedJob.id ? "animate-spin" : ""}`} />
                          Purge Job
                        </button>
                      </div>
                    </div>
                    {failure.raw && (
                      <div className="pt-2 border-t border-rose-500/10">
                        <button
                          type="button"
                          onClick={() => setShowRawError(!showRawError)}
                          className="text-[11px] text-zinc-400 hover:text-white flex items-center gap-1 transition-colors"
                        >
                          <span>{showRawError ? "Hide" : "View"} technical log</span>
                          {showRawError ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                        {showRawError && (
                          <pre className="mt-2 p-2.5 rounded-lg bg-black/80 border border-[#282828] text-[10px] font-mono text-zinc-400 overflow-x-auto max-h-36 whitespace-pre-wrap leading-tight">
                            {failure.raw}
                          </pre>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Stage Progress Timeline */}
              <div>
                <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4">
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
                            ? "bg-black/40 border-[#282828] opacity-60"
                            : "bg-black/40 border-[#282828]"
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
                                ? "bg-zinc-600 text-white"
                                : "bg-black/60 text-zinc-400 border border-[#282828]"
                            }`}
                          >
                            {isDone ? "✓" : isFailed ? "✕" : isSkipped ? "-" : idx + 1}
                          </div>
                          <div>
                            <div className="font-bold text-xs text-white flex items-center gap-2">
                              {stage.label}
                              {isSkipped && <span className="text-[10px] text-zinc-500">(Skipped)</span>}
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
                                ? "text-emerald-400"
                                : isInProgress
                                ? "text-indigo-400"
                                : "text-zinc-500"
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
              <div className="p-4 rounded-2xl bg-black/60 border border-[#282828] space-y-2 text-xs font-mono">
                <div className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider mb-2">Media Artifacts</div>
                <div className="flex justify-between truncate">
                  <span className="text-zinc-500">Song Key:</span>
                  <span className="text-zinc-200 font-semibold truncate max-w-[280px]">
                    {selectedJob.songId ? `audios/${selectedJob.songId}` : "-"}
                  </span>
                </div>
                {selectedJob.videoKey && (
                  <div className="flex justify-between truncate">
                    <span className="text-zinc-500">Video Canvas:</span>
                    <span className="text-emerald-400 font-semibold truncate max-w-[280px]">
                      {selectedJob.videoKey}
                    </span>
                  </div>
                )}
                {selectedJob.fullVideoKey && (
                  <div className="flex justify-between truncate">
                    <span className="text-zinc-500">Full Video:</span>
                    <span className="text-indigo-400 font-semibold truncate max-w-[280px]">
                      {selectedJob.fullVideoKey}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-[#282828] flex items-center justify-between">
              <button
                onClick={() => handleDeleteIngestionJob(selectedJob.id)}
                disabled={deletingJobId === selectedJob.id}
                className="px-4 py-2 bg-rose-500/10 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/20 font-bold text-xs rounded-full transition-all flex items-center gap-2"
              >
                <Trash2 className={`w-4 h-4 ${deletingJobId === selectedJob.id ? "animate-spin" : ""}`} />
                {deletingJobId === selectedJob.id ? "Purging Cloud Artifacts..." : "Delete Job & Purge Artifacts"}
              </button>
              <div className="flex items-center gap-3">
                {selectedJob.status === "FAILED" && (
                  <>
                    <button
                      onClick={() => handleOpenRecoverModal(selectedJob)}
                      className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs rounded-full transition-all flex items-center gap-2 shadow-sm"
                    >
                      <UploadCloud className="w-4 h-4" />
                      Upload & Reprocess
                    </button>
                    <button
                      onClick={() => handleRetryIngestionJob(selectedJob.id)}
                      disabled={retryingIngestionJobId === selectedJob.id}
                      className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs rounded-full transition-all flex items-center gap-2"
                    >
                      <RotateCcw className={`w-4 h-4 ${retryingIngestionJobId === selectedJob.id ? "animate-spin" : ""}`} />
                      Retry Job
                    </button>
                  </>
                )}
                <button
                  onClick={() => setSelectedJob(null)}
                  className="px-6 py-2 bg-white hover:bg-zinc-200 text-black font-bold text-xs rounded-full transition-all"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CASCADE DELETE DETAIL MODAL                                               */}
      {/* ========================================================================= */}
      {selectedDeleteJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-[#121212] border border-[#282828] rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="p-6 border-b border-[#282828] flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center shrink-0 border border-rose-500/20">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white flex items-center gap-2">
                    {selectedDeleteJob.entityTitle || "Untitled Entity"}
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-black/60 border border-[#282828] text-zinc-300 font-bold">
                      {selectedDeleteJob.entityType}
                    </span>
                  </h3>
                  <p className="text-xs text-zinc-400">Entity ID: {selectedDeleteJob.entityId} • Task: {selectedDeleteJob.id}</p>
                </div>
              </div>

              <button
                onClick={() => setSelectedDeleteJob(null)}
                className="p-2 text-zinc-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Failure Banner with 1-Click Retry */}
              {selectedDeleteJob.status === "FAILED" && (() => {
                const failure = formatFailureNotice(selectedDeleteJob.failureReason);
                return (
                  <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-rose-400" />
                        <div>
                          <h4 className="text-xs font-bold uppercase tracking-wider text-rose-300">{failure.title}</h4>
                          <p className="text-xs mt-1 text-zinc-300 leading-relaxed font-sans">{failure.explanation}</p>
                          <p className="text-[11px] text-zinc-400 mt-1">Attempts made: {selectedDeleteJob.attemptCount} of {selectedDeleteJob.maxAttempts}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRetryDeleteJob(selectedDeleteJob.id)}
                        disabled={retryingJobId === selectedDeleteJob.id}
                        className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-full transition-all flex items-center gap-1.5 shrink-0 shadow-sm"
                      >
                        <RotateCcw className={`w-3.5 h-3.5 ${retryingJobId === selectedDeleteJob.id ? "animate-spin" : ""}`} />
                        Retry Now
                      </button>
                    </div>
                    {failure.raw && (
                      <div className="pt-2 border-t border-rose-500/10">
                        <button
                          type="button"
                          onClick={() => setShowRawDeleteError(!showRawDeleteError)}
                          className="text-[11px] text-zinc-400 hover:text-white flex items-center gap-1 transition-colors"
                        >
                          <span>{showRawDeleteError ? "Hide" : "View"} technical log</span>
                          {showRawDeleteError ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                        {showRawDeleteError && (
                          <pre className="mt-2 p-2.5 rounded-lg bg-black/80 border border-[#282828] text-[10px] font-mono text-zinc-400 overflow-x-auto max-h-36 whitespace-pre-wrap leading-tight">
                            {failure.raw}
                          </pre>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Stage Progress Timeline */}
              <div>
                <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4">
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
                            ? "bg-black/40 border-[#282828] opacity-60"
                            : "bg-black/40 border-[#282828]"
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
                                ? "bg-zinc-600 text-white"
                                : "bg-black/60 text-zinc-400 border border-[#282828]"
                            }`}
                          >
                            {isDone ? "✓" : isFailed ? "✕" : isSkipped ? "-" : idx + 1}
                          </div>
                          <div>
                            <div className="font-bold text-xs text-white flex items-center gap-2">
                              {stage.label}
                              {isSkipped && <span className="text-[10px] text-zinc-500">(Skipped)</span>}
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
                                ? "text-emerald-400"
                                : isInProgress
                                ? "text-rose-400"
                                : "text-zinc-500"
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
              <div className="p-4 rounded-2xl bg-black/60 border border-[#282828] space-y-2 text-xs font-mono">
                <div className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider mb-2">Cloud Keys &amp; Resources Purged</div>
                {selectedDeleteJob.songKey && (
                  <div className="flex justify-between truncate">
                    <span className="text-zinc-500">Audio S3 Prefix:</span>
                    <span className="text-zinc-200 font-semibold truncate max-w-[280px]">
                      {selectedDeleteJob.songKey}
                    </span>
                  </div>
                )}
                {selectedDeleteJob.fullVideoKey && (
                  <div className="flex justify-between truncate">
                    <span className="text-zinc-500">Full Video Prefix:</span>
                    <span className="text-indigo-400 font-semibold truncate max-w-[280px]">
                      {selectedDeleteJob.fullVideoKey}
                    </span>
                  </div>
                )}
                {selectedDeleteJob.videoKey && (
                  <div className="flex justify-between truncate">
                    <span className="text-zinc-500">Video Canvas:</span>
                    <span className="text-emerald-400 font-semibold truncate max-w-[280px]">
                      {selectedDeleteJob.videoKey}
                    </span>
                  </div>
                )}
                {selectedDeleteJob.imageKey && (
                  <div className="flex justify-between truncate">
                    <span className="text-zinc-500">Image Key:</span>
                    <span className="text-zinc-200 font-semibold truncate max-w-[280px]">
                      {selectedDeleteJob.imageKey}
                    </span>
                  </div>
                )}
                {selectedDeleteJob.coverImageKey && (
                  <div className="flex justify-between truncate">
                    <span className="text-zinc-500">Cover Image Key:</span>
                    <span className="text-zinc-200 font-semibold truncate max-w-[280px]">
                      {selectedDeleteJob.coverImageKey}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-[#282828] flex items-center justify-between">
              <button
                onClick={() => handleDeleteDeleteJob(selectedDeleteJob.id)}
                disabled={deletingDeleteJobId === selectedDeleteJob.id}
                className="px-4 py-2 bg-rose-500/10 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/20 font-bold text-xs rounded-full transition-all flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete Audit Record
              </button>
              <div className="flex items-center gap-3">
                {selectedDeleteJob.status === "FAILED" && (
                  <button
                    onClick={() => handleRetryDeleteJob(selectedDeleteJob.id)}
                    disabled={retryingJobId === selectedDeleteJob.id}
                    className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-full transition-all flex items-center gap-2 shadow-lg shadow-rose-900/20"
                  >
                    <RotateCcw className={`w-4 h-4 ${retryingJobId === selectedDeleteJob.id ? "animate-spin" : ""}`} />
                    Retry Purge
                  </button>
                )}
                <button
                  onClick={() => setSelectedDeleteJob(null)}
                  className="px-6 py-2 bg-white hover:bg-zinc-200 text-black font-bold text-xs rounded-full transition-all"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ========================================================================= */}
      {/* RECOVER FAILED JOB MEDIA MODAL                                            */}
      {/* ========================================================================= */}
      {recoveringJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-[#121212] border border-[#282828] rounded-3xl w-full max-w-xl overflow-hidden flex flex-col shadow-2xl">
            {/* Header */}
            <div className="p-6 border-b border-[#282828] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/20">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Upload & Reprocess Job</h3>
                  <p className="text-xs text-zinc-400">
                    Replace corrupted audio or video for <span className="text-white font-medium">{recoveringJob.title}</span> ({recoveringJob.artistName})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseRecoverModal}
                disabled={isRecovering}
                className="p-2 text-zinc-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body / Form */}
            <form onSubmit={handleRecoverJobSubmit} className="p-6 space-y-4">
              {/* Failure Notice Reminder */}
              {recoveringJob.failureReason && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-start gap-2.5 text-xs text-rose-300">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                  <div>
                    <span className="font-bold block">Previous Failure Reason:</span>
                    <span className="text-zinc-300 line-clamp-2">{recoveringJob.failureReason}</span>
                  </div>
                </div>
              )}

              {/* Error display */}
              {recoverError && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-start gap-2.5 text-xs text-amber-300">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                  <div>
                    <span className="font-bold block">{recoverError.title || "Recovery Error"}</span>
                    <span>{recoverError.message}</span>
                  </div>
                </div>
              )}

              {/* Replacement Audio */}
              <div className="border border-dashed border-[#282828] rounded-2xl p-4 bg-black/40 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-200 flex items-center gap-1.5 uppercase tracking-wider">
                    <Music className="w-4 h-4 text-emerald-400" />
                    Replacement Audio Track
                  </label>
                  {recoverAudioFile && (
                    <button
                      type="button"
                      onClick={() => setRecoverAudioFile(null)}
                      className="text-[11px] font-bold text-zinc-400 hover:text-white"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-zinc-400">
                  Upload an uncorrupted audio file (.mp3, .wav, .flac, .aac, .m4a) to replace the damaged audio stream.
                </p>
                <input
                  type="file"
                  accept="audio/*,.mp3,.wav,.flac,.aac,.m4a"
                  disabled={isRecovering}
                  onChange={(e) => setRecoverAudioFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-zinc-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-[#282828] file:text-white hover:file:bg-zinc-700 cursor-pointer"
                />
                {recoverAudioFile && (
                  <div className="text-[11px] text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Selected: {recoverAudioFile.name} ({(recoverAudioFile.size / (1024 * 1024)).toFixed(2)} MB)</span>
                  </div>
                )}
              </div>

              {/* Replacement Video */}
              <div className="border border-dashed border-[#282828] rounded-2xl p-4 bg-black/40 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-200 flex items-center gap-1.5 uppercase tracking-wider">
                    <Film className="w-4 h-4 text-blue-400" />
                    Replacement Video File (optional)
                  </label>
                  {recoverVideoFile && (
                    <button
                      type="button"
                      onClick={() => setRecoverVideoFile(null)}
                      className="text-[11px] font-bold text-zinc-400 hover:text-white"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-zinc-400">
                  Upload a replacement video (.mp4, .mov) if the source video was corrupt or missing.
                </p>
                <input
                  type="file"
                  accept="video/*,.mp4,.mov"
                  disabled={isRecovering}
                  onChange={(e) => setRecoverVideoFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-zinc-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-[#282828] file:text-white hover:file:bg-zinc-700 cursor-pointer"
                />
                {recoverVideoFile && (
                  <div className="text-[11px] text-blue-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Selected: {recoverVideoFile.name} ({(recoverVideoFile.size / (1024 * 1024)).toFixed(2)} MB)</span>
                  </div>
                )}
              </div>

              {/* Canvas Timestamps (Optional) */}
              {recoverVideoFile && (
                <div className="p-3 bg-black/50 border border-[#282828] rounded-2xl space-y-2">
                  <span className="text-[11px] font-bold text-zinc-300 block">
                    Optional Canvas Loop Timestamps
                  </span>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-[10px] text-zinc-500 block mb-1">Start (min : sec)</span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={recoverClipStartMin}
                          onChange={(e) => setRecoverClipStartMin(e.target.value)}
                          className="w-14 bg-black/60 border border-[#282828] rounded-lg px-2 py-1 text-center font-mono text-white text-xs"
                        />
                        <span className="text-zinc-500 font-bold">:</span>
                        <input
                          type="number"
                          min="0"
                          max="59"
                          placeholder="00"
                          value={recoverClipStartSec}
                          onChange={(e) => setRecoverClipStartSec(e.target.value)}
                          className="w-14 bg-black/60 border border-[#282828] rounded-lg px-2 py-1 text-center font-mono text-white text-xs"
                        />
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-500 block mb-1">End (min : sec)</span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={recoverClipEndMin}
                          onChange={(e) => setRecoverClipEndMin(e.target.value)}
                          className="w-14 bg-black/60 border border-[#282828] rounded-lg px-2 py-1 text-center font-mono text-white text-xs"
                        />
                        <span className="text-zinc-500 font-bold">:</span>
                        <input
                          type="number"
                          min="0"
                          max="59"
                          placeholder="00"
                          value={recoverClipEndSec}
                          onChange={(e) => setRecoverClipEndSec(e.target.value)}
                          className="w-14 bg-black/60 border border-[#282828] rounded-lg px-2 py-1 text-center font-mono text-white text-xs"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCloseRecoverModal}
                  disabled={isRecovering}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs rounded-full transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isRecovering || (!recoverAudioFile && !recoverVideoFile)}
                  className="px-6 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs rounded-full transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                >
                  {isRecovering ? (
                    <>
                      <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                      Uploading & Recovering...
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-3.5 h-3.5" />
                      Upload & Reprocess Job
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Upload Progress Overlay during Recovery */}
      {isRecovering && (
        <UploadProgressBar
          statusText={recoverProgressText}
          percent={recoverPercent ?? 0}
          fileName={recoverStats.fileName}
          loadedText={recoverStats.loadedText}
          speedText={recoverStats.speedText}
          error={recoverError}
          retryStatusText={recoverRetryStatusText}
          isRetrying={isRecoverRetrying}
          onRetry={() => {}}
          onCancel={() => {}}
        />
      )}
    </div>
  );
}
