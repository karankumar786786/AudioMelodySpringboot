"use client";

import { AlertOctagon, AlertTriangle, ChevronDown, Layers } from "lucide-react";
import Link from "next/link";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardMetricCards } from "@/components/dashboard/DashboardMetricCards";
import { DashboardQuickActions } from "@/components/dashboard/DashboardQuickActions";
import { ListeningOverview } from "@/components/dashboard/ListeningOverview";
import { RecentJobsWidget } from "@/components/dashboard/RecentJobsWidget";
import { RecentSongsWidget } from "@/components/dashboard/RecentSongsWidget";
import { SystemStatusWidget } from "@/components/dashboard/SystemStatusWidget";
import { QueueBackpressureWidget } from "@/components/QueueBackpressureWidget";
import { useDashboardStats } from "@/lib/queries/dashboard";

export default function DashboardPage() {
  const statsQuery = useDashboardStats();
  const stats = statsQuery.data ?? null;
  const loading = statsQuery.isPending;
  const refreshing = statsQuery.isFetching && !statsQuery.isPending;
  const error = statsQuery.error
    ? "Unable to load latest system metrics. Please check server status."
    : null;
  const fetchStats = (_manual?: boolean) => {
    statsQuery.refetch();
  };

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-10 text-white font-sans">
      {/* Top Header */}
      <DashboardHeader
        onRefresh={() => fetchStats(true)}
        loading={loading}
        refreshing={refreshing}
      />

      {error && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400" />
          <p className="font-medium">{error}</p>
        </div>
      )}

      {/* Alert Banner for DLQ failures or failed pipeline jobs */}
      {(stats?.queueStats?.mailDlqSize ?? 0) > 0 && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertOctagon className="w-5 h-5 text-rose-400 shrink-0 animate-pulse" />
            <div>
              <p className="font-semibold text-white">
                {stats?.queueStats?.mailDlqSize} Failed Email
                {(stats?.queueStats?.mailDlqSize ?? 0) > 1 ? "s" : ""} in
                Dead-Letter Queue
              </p>
              <p className="text-xs text-rose-300/80">
                Transactional email delivery failed (SMTP rate-limit or invalid
                recipient address).
              </p>
            </div>
          </div>
          <Link
            href="/jobs"
            className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-xs font-semibold text-white transition-colors shrink-0"
          >
            Review Logs
          </Link>
        </div>
      )}

      {/* Metrics Cards Grid */}
      <DashboardMetricCards stats={stats} loading={loading} />

      <ListeningOverview />

      {/* Primary Catalog & Pipeline Ingestion Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentSongsWidget songs={stats?.recentSongs} loading={loading} />
        <RecentJobsWidget jobs={stats?.recentJobs} loading={loading} />
      </div>

      {/* Quick Actions & System Health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <DashboardQuickActions />
        <SystemStatusWidget
          queueStats={stats?.queueStats}
          systemHealth={stats?.systemHealth}
        />
      </div>

      {/* Collapsible Queue & DLQ Diagnostics (Accessible on demand) */}
      {stats?.queueStats && (
        <div
          id="mail-queue"
          className="rounded-2xl border border-white/8 bg-[#121215] overflow-hidden"
        >
          <details className="group">
            <summary className="flex items-center justify-between p-4 sm:p-5 cursor-pointer list-none select-none hover:bg-white/[0.02] transition-colors">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-black border border-white/10 text-white">
                  <Layers className="w-4 h-4 text-zinc-300" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white">
                      Redis Queue Diagnostics
                    </h3>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white/10 text-zinc-300 border border-white/20">
                      {stats.queueStats.mailDlqSize > 0
                        ? `${stats.queueStats.mailDlqSize} Failed DLQ`
                        : "Optimal (Idle)"}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Transactional email buffer (OTPs, password resets) • Safe
                    capacity &lt;10 items
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-400 group-hover:text-zinc-200">
                <span className="hidden sm:inline">Inspect Buffers</span>
                <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
              </div>
            </summary>
            <div className="p-4 sm:p-5 pt-0 border-t border-white/6">
              <QueueBackpressureWidget
                queueData={stats.queueStats}
                onRefresh={() => fetchStats(true)}
                isRefreshing={refreshing}
                compact
              />
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
