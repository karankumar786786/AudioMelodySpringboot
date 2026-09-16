"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { adminFetch } from "@/lib/adminFetch";
import {
  JobProgress,
  JobSummaryMetrics,
  DeleteJobProgress,
  DeleteJobSummaryMetrics,
} from "@/lib/api";
import { Zap, Trash2, Workflow, RotateCcw } from "lucide-react";

import { JobMetricsCards } from "./components/JobMetricsCards";
import { ActiveJobsLiveMonitor } from "./components/ActiveJobsLiveMonitor";
import { IngestionJobsTable } from "./components/IngestionJobsTable";
import { CascadeDeleteTable } from "./components/CascadeDeleteTable";
import { JobDetailModal } from "./components/JobDetailModal";
import { DeleteJobDetailModal } from "./components/DeleteJobDetailModal";
import { RecoverJobMediaModal } from "./components/RecoverJobMediaModal";

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
  const [isPurgingFailedJobs, setIsPurgingFailedJobs] = useState(false);

  // Recover Media on Failed Job State
  const [recoveringJob, setRecoveringJob] = useState<JobProgress | null>(null);

  // Ingestion Pagination & Filters
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [totalJobsCount, setTotalJobsCount] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Deletion Pipeline State
  const [deleteMetrics, setDeleteMetrics] = useState<DeleteJobSummaryMetrics | null>(null);
  const [activeDeleteJobs, setActiveDeleteJobs] = useState<DeleteJobProgress[]>([]);
  const [allDeleteJobs, setAllDeleteJobs] = useState<DeleteJobProgress[]>([]);
  const [selectedDeleteJob, setSelectedDeleteJob] = useState<DeleteJobProgress | null>(null);
  const [retryingJobId, setRetryingJobId] = useState<string | null>(null);
  const [deletingDeleteJobId, setDeletingDeleteJobId] = useState<string | null>(null);

  // Deletion Pagination & Filters
  const [deletePage, setDeletePage] = useState(0);
  const [deletePageSize, setDeletePageSize] = useState(20);
  const [totalDeleteJobsCount, setTotalDeleteJobsCount] = useState(0);
  const [deleteStatusFilter, setDeleteStatusFilter] = useState<string>("ALL");
  const [deleteTypeFilter, setDeleteTypeFilter] = useState<string>("ALL");
  const [deleteSearchQuery, setDeleteSearchQuery] = useState("");

  // General Page State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchData = useCallback(
    async (showLoader = false) => {
      if (showLoader) {
        setLoading(true);
        setRefreshing(true);
      }
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
            const content = jobsData.content || jobsData.data || [];
            setAllJobs(content);
            const metaTotal =
              jobsData.paginationMetaData?.totalCount ??
              jobsData.paginationMetaData?.total ??
              jobsData.metadata?.totalCount ??
              jobsData.totalCount;
            let total: number;
            if (metaTotal !== undefined && metaTotal !== null && !isNaN(Number(metaTotal)) && Number(metaTotal) > 0) {
              total = Number(metaTotal);
            } else if (content.length < pageSize) {
              total = page * pageSize + content.length;
            } else {
              total = (page + 2) * pageSize;
            }
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
            const content = delAllData.content || delAllData.data || [];
            setAllDeleteJobs(content);
            const metaTotal =
              delAllData.paginationMetaData?.totalCount ??
              delAllData.paginationMetaData?.total ??
              delAllData.metadata?.totalCount ??
              delAllData.totalCount;
            let total: number;
            if (metaTotal !== undefined && metaTotal !== null && !isNaN(Number(metaTotal)) && Number(metaTotal) > 0) {
              total = Number(metaTotal);
            } else if (content.length < deletePageSize) {
              total = deletePage * deletePageSize + content.length;
            } else {
              total = (deletePage + 2) * deletePageSize;
            }
            setTotalDeleteJobsCount(total);
          }
        }
      } catch (err) {
        console.error("Failed to fetch job monitoring metrics:", err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [
      activeTab,
      page,
      pageSize,
      statusFilter,
      searchQuery,
      deletePage,
      deletePageSize,
      deleteStatusFilter,
      deleteTypeFilter,
      deleteSearchQuery,
    ]
  );

  useEffect(() => {
    fetchData(true);
  }, [fetchData]);

  // Live Auto-Refresh (every 4 seconds, quiet in background without flashing skeleton)
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

  // Actions: Retry Ingestion Job
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

  // Actions: Delete Ingestion Job
  const handleDeleteIngestionJob = async (jobId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (
      !confirm(
        "Are you sure you want to delete this job? This will clean up all associated garbage: S3 audio/video files, temporary uploads, Algolia search records, Recombee vectors, and database entities."
      )
    ) {
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

  // Actions: Purge All Failed Ingestion Jobs
  const handlePurgeAllFailedJobs = async () => {
    if (
      !confirm(
        "Are you sure you want to purge ALL failed jobs? This will permanently wipe all associated residual S3 audio/video files, halt Inngest executions, and remove Algolia/Recombee records."
      )
    ) {
      return;
    }
    try {
      setIsPurgingFailedJobs(true);
      const res = await adminFetch("/admin/jobs/failed", {
        method: "DELETE",
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(
          `Successfully purged ${data.deletedCount ?? 0} failed job(s) and their cloud/storage artifacts.`
        );
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

  // Actions: Retry Cascade Delete Job
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

  // Actions: Delete Cascade Delete Job Record
  const handleDeleteDeleteJob = async (jobId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (
      !confirm("Are you sure you want to delete this cascade delete audit record? This cannot be undone.")
    ) {
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
              onClick={() => {
                setLoading(true);
                setActiveTab("INGESTION");
              }}
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
              onClick={() => {
                setLoading(true);
                setActiveTab("DELETION");
              }}
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
            <span
              className={`w-2 h-2 rounded-full ${
                autoRefresh ? "bg-emerald-400 animate-ping" : "bg-zinc-600"
              }`}
            />
            {autoRefresh ? "Live 4s" : "Paused"}
          </button>

          {/* Manual Refresh */}
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="p-2 rounded-full bg-black/60 border border-[#282828] text-zinc-400 hover:text-white transition-all disabled:opacity-50"
            title="Refresh metrics now"
          >
            <RotateCcw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* KPI Metrics Cards */}
      {activeTab === "INGESTION" ? (
        <JobMetricsCards
          type="INGESTION"
          metrics={metrics}
          loading={loading}
          onRefresh={() => fetchData(true)}
          isRefreshing={refreshing}
        />
      ) : (
        <JobMetricsCards
          type="DELETION"
          metrics={deleteMetrics}
          loading={loading}
          onRefresh={() => fetchData(true)}
          isRefreshing={refreshing}
        />
      )}

      {/* Main Content Area based on Tab */}
      {activeTab === "INGESTION" ? (
        <>
          {/* Active Jobs Live Monitor */}
          <ActiveJobsLiveMonitor
            activeJobs={activeJobs}
            onSelectJob={(job) => setSelectedJob(job)}
          />

          {/* Ingestion Jobs Table */}
          <IngestionJobsTable
            jobs={allJobs}
            loading={loading}
            searchQuery={searchQuery}
            onSearchChange={(query) => {
              setLoading(true);
              setSearchQuery(query);
              setPage(0);
            }}
            statusFilter={statusFilter}
            onStatusFilterChange={(status) => {
              setLoading(true);
              setStatusFilter(status);
              setPage(0);
            }}
            onPurgeAllFailed={handlePurgeAllFailedJobs}
            isPurgingFailed={isPurgingFailedJobs}
            onSelectJob={(job) => setSelectedJob(job)}
            onRetryJob={handleRetryIngestionJob}
            retryingJobId={retryingIngestionJobId}
            onOpenRecoverModal={(job) => setRecoveringJob(job)}
            onDeleteJob={handleDeleteIngestionJob}
            deletingJobId={deletingJobId}
            page={page}
            pageSize={pageSize}
            totalJobsCount={totalJobsCount}
            onPageChange={(newPage) => {
              setLoading(true);
              setPage(newPage);
            }}
            onPageSizeChange={(newSize) => {
              setLoading(true);
              setPageSize(newSize);
              setPage(0);
            }}
          />
        </>
      ) : (
        /* Cascade Delete Jobs Table */
        <CascadeDeleteTable
          jobs={allDeleteJobs}
          loading={loading}
          searchQuery={deleteSearchQuery}
          onSearchChange={(query) => {
            setLoading(true);
            setDeleteSearchQuery(query);
            setDeletePage(0);
          }}
          statusFilter={deleteStatusFilter}
          onStatusFilterChange={(status) => {
            setLoading(true);
            setDeleteStatusFilter(status);
            setDeletePage(0);
          }}
          typeFilter={deleteTypeFilter}
          onTypeFilterChange={(type) => {
            setLoading(true);
            setDeleteTypeFilter(type);
            setDeletePage(0);
          }}
          onSelectJob={(job) => setSelectedDeleteJob(job)}
          onRetryJob={handleRetryDeleteJob}
          retryingJobId={retryingJobId}
          onDeleteJob={handleDeleteDeleteJob}
          deletingJobId={deletingDeleteJobId}
          page={deletePage}
          pageSize={deletePageSize}
          totalJobsCount={totalDeleteJobsCount}
          onPageChange={(newPage) => {
            setLoading(true);
            setDeletePage(newPage);
          }}
          onPageSizeChange={(newSize) => {
            setLoading(true);
            setDeletePageSize(newSize);
            setDeletePage(0);
          }}
        />
      )}

      {/* Ingestion Job Detail Modal */}
      <JobDetailModal
        job={selectedJob}
        onClose={() => setSelectedJob(null)}
        onRetryJob={(id) => handleRetryIngestionJob(id)}
        retryingJobId={retryingIngestionJobId}
        onOpenRecoverModal={(job) => {
          setSelectedJob(null);
          setRecoveringJob(job);
        }}
        onDeleteJob={(id) => handleDeleteIngestionJob(id)}
        deletingJobId={deletingJobId}
      />

      {/* Delete Job Detail Modal */}
      <DeleteJobDetailModal
        job={selectedDeleteJob}
        onClose={() => setSelectedDeleteJob(null)}
        onRetryJob={(id) => handleRetryDeleteJob(id)}
        retryingJobId={retryingJobId}
        onDeleteJob={(id) => handleDeleteDeleteJob(id)}
        deletingJobId={deletingDeleteJobId}
      />

      {/* Recover Corrupt Job Media Modal */}
      <RecoverJobMediaModal
        job={recoveringJob}
        onClose={() => setRecoveringJob(null)}
        onSuccess={(updated) => {
          setAllJobs((prev) => prev.map((j) => (j.id === updated.id ? updated : j)));
          setActiveJobs((prev) => {
            const exists = prev.some((j) => j.id === updated.id);
            if (exists) {
              return prev.map((j) => (j.id === updated.id ? updated : j));
            }
            return [updated, ...prev];
          });
          if (selectedJob?.id === updated.id) {
            setSelectedJob(updated);
          }
          fetchData(false);
        }}
      />
    </div>
  );
}
