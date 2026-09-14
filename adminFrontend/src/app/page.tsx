"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { adminFetch } from "@/lib/adminFetch";
import { DashboardStats, Song, Job } from "@/lib/api";
import { SkeletonCard } from "@/components/SkeletonCard";
import { getImageUrl } from "@/lib/image-utils";
import { QueueBackpressureWidget } from "@/components/QueueBackpressureWidget";
import {
  Music,
  Users,
  Mic2,
  ListMusic,
  Cpu,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowUpRight,
  Activity,
  RefreshCw,
  PlusCircle,
  Shield,
  Layers,
  Sparkles,
  Server,
  AlertOctagon,
} from "lucide-react";

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    setError(null);

    try {
      // 1. First attempt single aggregated dashboard stats endpoint
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

  const formatDuration = (seconds?: number) => {
    if (!seconds) return "--:--";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const statCards = [
    {
      name: "Songs Library",
      value: stats?.totalSongs ?? 0,
      subValue: `${stats?.activeSongs ?? 0} active`,
      badge: stats?.featuredSongs ? `${stats.featuredSongs} featured` : null,
      icon: Music,
      href: "/songs",
    },
    {
      name: "Artists",
      value: stats?.totalArtists ?? 0,
      subValue: `${stats?.activeArtists ?? 0} verified`,
      badge: null,
      icon: Mic2,
      href: "/artists",
    },
    {
      name: "Playlists",
      value: stats?.totalPlaylists ?? 0,
      subValue: `${stats?.activePlaylists ?? 0} public`,
      badge: null,
      icon: ListMusic,
      href: "/playlists",
    },
    {
      name: "User Accounts",
      value: stats?.totalUsers ?? 0,
      subValue: `${stats?.activeUsers ?? 0} active`,
      badge: (stats?.blockedUsers ?? 0) > 0 ? `${stats?.blockedUsers} blocked` : null,
      badgeType: "warning",
      icon: Users,
      href: "/users",
    },
    {
      name: "Processing Jobs",
      value: stats?.totalJobs ?? 0,
      subValue: `${stats?.completedJobs ?? 0} finished`,
      badge: (stats?.failedJobs ?? 0) > 0 ? `${stats?.failedJobs} failed` : (stats?.pendingJobs ?? 0) > 0 ? `${stats?.pendingJobs} pending` : null,
      badgeType: (stats?.failedJobs ?? 0) > 0 ? "danger" : "default",
      icon: Cpu,
      href: "/jobs",
    },
  ];

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-10 text-white font-sans">
      {/* Top Header */}
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
            onClick={() => fetchStats(true)}
            disabled={loading || refreshing}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold text-black bg-white hover:bg-zinc-200 transition-all active:scale-[0.98] shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            <span>{refreshing ? "Refreshing..." : "Refresh"}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400" />
          <p className="font-medium">{error}</p>
        </div>
      )}

      {/* Metrics Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {loading ? (
          <SkeletonCard variant="stat" count={5} />
        ) : (
          statCards.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.name}
                href={card.href}
                className="group relative overflow-hidden bg-[#121212] p-5 rounded-2xl border border-[#282828] hover:border-zinc-700 hover:bg-[#181818] transition-all duration-200"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-black border border-[#282828] flex items-center justify-center text-white transition-transform group-hover:scale-105">
                    <Icon className="w-5 h-5" />
                  </div>

                  {card.badge && (
                    <span
                      className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                        card.badgeType === "danger"
                          ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                          : card.badgeType === "warning"
                          ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                          : "bg-white/10 text-zinc-300 border-white/20"
                      }`}
                    >
                      {card.badge}
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="text-3xl font-bold tracking-tight text-white">
                    {card.value.toLocaleString()}
                  </div>
                  <div className="text-xs font-medium text-zinc-400">
                    {card.name}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-[#282828] flex items-center justify-between text-xs text-zinc-400">
                  <span>{card.subValue}</span>
                  <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all text-white" />
                </div>
              </Link>
            );
          })
        )}
      </div>

      {/* Redis Queue Backpressure & Ingestion Depth */}
      <QueueBackpressureWidget
        queueData={stats?.queueStats}
        onRefresh={() => fetchStats(true)}
        isRefreshing={refreshing}
      />

      {/* Activity & Queues Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Songs */}
        <div className="bg-[#121212] rounded-2xl border border-[#282828] p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5 pb-4 border-b border-[#282828]">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-zinc-900 border border-[#282828] text-white">
                <Music className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Recent Songs</h2>
                <p className="text-xs text-zinc-400">Latest additions to the music catalog</p>
              </div>
            </div>
            <Link
              href="/songs"
              className="text-xs font-bold text-white hover:underline flex items-center gap-1"
            >
              View All <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loading ? (
            <SkeletonCard variant="activity" count={5} />
          ) : !stats?.recentSongs || stats.recentSongs.length === 0 ? (
            <div className="py-12 text-center text-zinc-500 text-sm">
              <Music className="w-8 h-8 mx-auto mb-2 opacity-40" />
              No songs found in catalog.
            </div>
          ) : (
            <div className="space-y-2.5">
              {stats.recentSongs.map((song) => (
                <div
                  key={song.id}
                  className="group flex items-center justify-between p-3 rounded-xl bg-black/50 hover:bg-[#181818] border border-[#282828] hover:border-zinc-700 transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-zinc-900 border border-[#282828] shrink-0">
                      {song.imageKey ? (
                        <Image
                          src={getImageUrl(song.imageKey, { width: 88, height: 88, quality: 75 })}
                          alt={song.title}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-500">
                          <Music className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white text-sm truncate">
                          {song.title}
                        </span>
                        {song.isFeatured && (
                          <span className="shrink-0 flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-white border border-white/20">
                            <Sparkles className="w-2.5 h-2.5" /> Featured
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-400 truncate">
                        {song.artistName}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 text-right text-xs font-mono text-zinc-400">
                    {formatDuration(song.duration)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Processing Jobs */}
        <div className="bg-[#121212] rounded-2xl border border-[#282828] p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5 pb-4 border-b border-[#282828]">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-zinc-900 border border-[#282828] text-white">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Pipeline Jobs</h2>
                <p className="text-xs text-zinc-400">Audio transcoding & analysis status</p>
              </div>
            </div>
            <Link
              href="/jobs"
              className="text-xs font-bold text-white hover:underline flex items-center gap-1"
            >
              <span>View Telemetry</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loading ? (
            <SkeletonCard variant="activity" count={5} />
          ) : !stats?.recentJobs || stats.recentJobs.length === 0 ? (
            <div className="py-12 text-center text-zinc-500 text-sm">
              <Cpu className="w-8 h-8 mx-auto mb-2 opacity-40" />
              No background jobs active or recorded.
            </div>
          ) : (
            <div className="space-y-2.5">
              {stats.recentJobs.map((job) => {
                const statusConfig = {
                  COMPLETED: {
                    badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
                    dot: "bg-emerald-500",
                    label: "Completed",
                  },
                  PROCESSING: {
                    badge: "bg-blue-500/10 text-blue-400 border-blue-500/20",
                    dot: "bg-blue-500 animate-pulse",
                    label: "Processing",
                  },
                  PENDING: {
                    badge: "bg-amber-500/10 text-amber-400 border-amber-500/20",
                    dot: "bg-amber-500",
                    label: "Pending",
                  },
                  FAILED: {
                    badge: "bg-rose-500/10 text-rose-400 border-rose-500/20",
                    dot: "bg-rose-500",
                    label: "Failed",
                  },
                }[job.status] || {
                  badge: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
                  dot: "bg-zinc-500",
                  label: job.status,
                };

                return (
                  <Link
                    key={job.id}
                    href="/jobs"
                    className="flex items-center justify-between p-3 rounded-xl bg-black/50 border border-[#282828] hover:border-zinc-700 hover:bg-[#181818] transition-all"
                  >
                    <div className="min-w-0 pr-3">
                      <p className="font-semibold text-white text-sm truncate">
                        {job.title}
                      </p>
                      <p className="text-xs text-zinc-400 truncate flex items-center gap-1.5 mt-0.5">
                        <span>{job.artistName} {job.isVideoReprocess ? "• Video Reprocess" : ""}</span>
                        {job.currentStage && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 border border-[#282828] font-mono font-semibold text-zinc-300">
                            {job.currentStage}
                          </span>
                        )}
                        {job.transcodingAttempt != null && job.transcodingAttempt > 1 && (
                          <span className="text-[10px] text-amber-400 font-bold">
                            ⚠️ #{job.transcodingAttempt}
                          </span>
                        )}
                      </p>
                    </div>

                    <span
                      className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${statusConfig.badge}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`} />
                      {statusConfig.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions & System Health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions (2 cols on lg) */}
        <div className="lg:col-span-2 bg-[#121212] rounded-2xl border border-[#282828] p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-base font-bold text-white">Quick Actions</h2>
              <p className="text-xs text-zinc-400">Fast shortcuts to common admin workflows</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Link
              href="/songs"
              className="flex flex-col items-center text-center p-5 rounded-xl bg-black/50 border border-[#282828] hover:border-zinc-700 hover:bg-[#181818] transition-all group"
            >
              <div className="w-10 h-10 rounded-xl bg-white text-black flex items-center justify-center mb-3 group-hover:scale-105 transition-transform shadow-sm">
                <PlusCircle className="w-5 h-5" />
              </div>
              <span className="font-bold text-sm text-white">Add Song</span>
              <span className="text-[11px] text-zinc-400 mt-1">Upload & transcode</span>
            </Link>

            <Link
              href="/artists"
              className="flex flex-col items-center text-center p-5 rounded-xl bg-black/50 border border-[#282828] hover:border-zinc-700 hover:bg-[#181818] transition-all group"
            >
              <div className="w-10 h-10 rounded-xl bg-white text-black flex items-center justify-center mb-3 group-hover:scale-105 transition-transform shadow-sm">
                <Mic2 className="w-5 h-5" />
              </div>
              <span className="font-bold text-sm text-white">Manage Artists</span>
              <span className="text-[11px] text-zinc-400 mt-1">Profiles & covers</span>
            </Link>

            <Link
              href="/playlists"
              className="flex flex-col items-center text-center p-5 rounded-xl bg-black/50 border border-[#282828] hover:border-zinc-700 hover:bg-[#181818] transition-all group"
            >
              <div className="w-10 h-10 rounded-xl bg-white text-black flex items-center justify-center mb-3 group-hover:scale-105 transition-transform shadow-sm">
                <ListMusic className="w-5 h-5" />
              </div>
              <span className="font-bold text-sm text-white">Curate Playlists</span>
              <span className="text-[11px] text-zinc-400 mt-1">Featured mixes</span>
            </Link>

            <Link
              href="/users"
              className="flex flex-col items-center text-center p-5 rounded-xl bg-black/50 border border-[#282828] hover:border-zinc-700 hover:bg-[#181818] transition-all group"
            >
              <div className="w-10 h-10 rounded-xl bg-white text-black flex items-center justify-center mb-3 group-hover:scale-105 transition-transform shadow-sm">
                <Shield className="w-5 h-5" />
              </div>
              <span className="font-bold text-sm text-white">User Accounts</span>
              <span className="text-[11px] text-zinc-400 mt-1">Roles & security</span>
            </Link>
          </div>
        </div>

        {/* System Health */}
        <div className="bg-[#121212] rounded-2xl border border-[#282828] p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Activity className="w-5 h-5 text-white" />
              <h2 className="text-base font-bold text-white">System Status</h2>
            </div>
            <p className="text-xs text-zinc-400 mb-6">Backend services and connectivity</p>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-black/50 border border-[#282828]">
                <div className="flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-xs font-semibold text-zinc-200">Core Engine API</span>
                </div>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Online
                </span>
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-xl bg-black/50 border border-[#282828]">
                <div className="flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-xs font-semibold text-zinc-200">PostgreSQL DB</span>
                </div>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Connected
                </span>
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-xl bg-black/50 border border-[#282828]">
                <div className="flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-white" />
                  <span className="text-xs font-semibold text-zinc-200">Audio Pipeline</span>
                </div>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-white/10 text-zinc-200 border border-white/20">
                  Ready
                </span>
              </div>

              <Link
                href="/jobs"
                className="flex items-center justify-between p-3.5 rounded-xl bg-black/50 border border-[#282828] hover:border-zinc-700 hover:bg-[#181818] transition-all group"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      stats?.queueStats?.overallStatus === "DLQ_ALERT"
                        ? "bg-rose-500 animate-ping"
                        : stats?.queueStats?.overallStatus === "HIGH"
                        ? "bg-red-500 animate-ping"
                        : stats?.queueStats?.overallStatus === "MODERATE"
                        ? "bg-amber-500 animate-pulse"
                        : "bg-emerald-500"
                    }`}
                  />
                  <span className="text-xs font-semibold text-zinc-200 group-hover:text-white transition-colors">
                    Queue Buffer ({stats?.queueStats?.totalQueued ?? 0})
                  </span>
                </div>
                <span
                  className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                    stats?.queueStats?.overallStatus === "DLQ_ALERT"
                      ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                      : stats?.queueStats?.overallStatus === "HIGH"
                      ? "bg-red-500/10 text-red-400 border-red-500/20"
                      : stats?.queueStats?.overallStatus === "MODERATE"
                      ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                      : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  }`}
                >
                  {stats?.queueStats?.overallStatus || "Optimal"}
                </span>
              </Link>
            </div>
          </div>

          <div className="pt-4 mt-6 border-t border-[#282828] text-xs text-zinc-500 flex items-center justify-between">
            <span>One Melody</span>
            <span className="font-mono">Port 8080/9090</span>
          </div>
        </div>
      </div>
    </div>
  );
}
