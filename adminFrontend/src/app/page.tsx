"use client";

import { useEffect, useState, useCallback } from "react";
import { AlertTriangle } from "lucide-react";
import { adminFetch } from "@/lib/adminFetch";
import { DashboardStats } from "@/lib/api";
import { QueueBackpressureWidget } from "@/components/QueueBackpressureWidget";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardMetricCards } from "@/components/dashboard/DashboardMetricCards";
import { RecentSongsWidget } from "@/components/dashboard/RecentSongsWidget";
import { RecentJobsWidget } from "@/components/dashboard/RecentJobsWidget";
import { DashboardQuickActions } from "@/components/dashboard/DashboardQuickActions";
import { SystemStatusWidget } from "@/components/dashboard/SystemStatusWidget";

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    setError(null);

    try {
      // 1. Attempt single aggregated dashboard stats endpoint
      const res = await adminFetch("/admin/dashboard/stats");
      if (res.ok) {
        const data: DashboardStats = await res.json();
        setStats(data);
        return;
      }

      // 2. Fallback to individual endpoints if needed
      const [songsRes, artistsRes, playlistsRes, usersRes, queuesRes] = await Promise.all([
        adminFetch("/admin/song?page=0&size=5"),
        adminFetch("/admin/artist?page=0&size=1"),
        adminFetch("/admin/playlist?page=0&size=1"),
        adminFetch("/admin/account?page=0&size=1"),
        adminFetch("/admin/jobs/queues"),
      ]);

      const [songsData, artistsData, playlistsData, usersData, queuesData] = await Promise.all([
        songsRes.ok ? songsRes.json() : null,
        artistsRes.ok ? artistsRes.json() : null,
        playlistsRes.ok ? playlistsRes.json() : null,
        usersRes.ok ? usersRes.json() : null,
        queuesRes.ok ? queuesRes.json() : null,
      ]);

      setStats({
        totalSongs: songsData?.paginationMetaData?.totalCount ?? songsData?.content?.length ?? 0,
        activeSongs: songsData?.paginationMetaData?.activeCount ?? 0,
        featuredSongs: 0,
        totalArtists: artistsData?.paginationMetaData?.totalCount ?? 0,
        activeArtists: artistsData?.paginationMetaData?.activeCount ?? 0,
        totalPlaylists: playlistsData?.paginationMetaData?.totalCount ?? 0,
        activePlaylists: playlistsData?.paginationMetaData?.activeCount ?? 0,
        totalUsers: usersData?.paginationMetaData?.totalCount ?? 0,
        activeUsers: usersData?.paginationMetaData?.activeCount ?? 0,
        blockedUsers: usersData?.paginationMetaData?.blockedCount ?? 0,
        totalJobs: 0,
        pendingJobs: 0,
        failedJobs: 0,
        processingJobs: 0,
        completedJobs: 0,
        recentSongs: songsData?.content ?? [],
        recentJobs: [],
        queueStats: queuesData ?? undefined,
      });
    } catch (err) {
      console.error("Failed to fetch stats", err);
      setError("Unable to load latest system metrics. Please check server status.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

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

      {/* Metrics Cards Grid */}
      <DashboardMetricCards stats={stats} loading={loading} />

      {/* Redis Queue Backpressure & Ingestion Depth */}
      <QueueBackpressureWidget
        queueData={stats?.queueStats}
        onRefresh={() => fetchStats(true)}
        isRefreshing={refreshing}
      />

      {/* Activity & Queues Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentSongsWidget songs={stats?.recentSongs} loading={loading} />
        <RecentJobsWidget jobs={stats?.recentJobs} loading={loading} />
      </div>

      {/* Quick Actions & System Health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <DashboardQuickActions />
        <SystemStatusWidget queueStats={stats?.queueStats} systemHealth={stats?.systemHealth} />
      </div>
    </div>
  );
}
