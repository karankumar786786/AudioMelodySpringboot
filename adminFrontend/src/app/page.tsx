"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { adminFetch } from "@/lib/adminFetch";
import { DashboardStats, Song, Job } from "@/lib/api";
import { SkeletonCard } from "@/components/SkeletonCard";
import { getImageUrl } from "@/lib/image-utils";
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
      const [songsRes, artistsRes, playlistsRes, usersRes] = await Promise.all([
        adminFetch("/admin/song?page=0&size=5"),
        adminFetch("/admin/artist?page=0&size=1"),
        adminFetch("/admin/playlist?page=0&size=1"),
        adminFetch("/admin/account?page=0&size=1"),
      ]);

      const [songsData, artistsData, playlistsData, usersData] = await Promise.all([
        songsRes.ok ? songsRes.json() : null,
        artistsRes.ok ? artistsRes.json() : null,
        playlistsRes.ok ? playlistsRes.json() : null,
        usersRes.ok ? usersRes.json() : null,
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
      color: "from-blue-500 to-indigo-600",
      accentBg: "bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-200/50 dark:border-blue-800/40",
      icon: Music,
      href: "/songs",
    },
    {
      name: "Artists",
      value: stats?.totalArtists ?? 0,
      subValue: `${stats?.activeArtists ?? 0} verified`,
      badge: null,
      color: "from-purple-500 to-pink-600",
      accentBg: "bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-200/50 dark:border-purple-800/40",
      icon: Mic2,
      href: "/artists",
    },
    {
      name: "Playlists",
      value: stats?.totalPlaylists ?? 0,
      subValue: `${stats?.activePlaylists ?? 0} public`,
      badge: null,
      color: "from-amber-500 to-rose-600",
      accentBg: "bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-200/50 dark:border-amber-800/40",
      icon: ListMusic,
      href: "/playlists",
    },
    {
      name: "User Accounts",
      value: stats?.totalUsers ?? 0,
      subValue: `${stats?.activeUsers ?? 0} active`,
      badge: (stats?.blockedUsers ?? 0) > 0 ? `${stats?.blockedUsers} blocked` : null,
      badgeType: "warning",
      color: "from-cyan-500 to-teal-600",
      accentBg: "bg-cyan-500/10 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border-cyan-200/50 dark:border-cyan-800/40",
      icon: Users,
      href: "/users",
    },
    {
      name: "Processing Jobs",
      value: stats?.totalJobs ?? 0,
      subValue: `${stats?.completedJobs ?? 0} finished`,
      badge: (stats?.failedJobs ?? 0) > 0 ? `${stats?.failedJobs} failed` : (stats?.pendingJobs ?? 0) > 0 ? `${stats?.pendingJobs} pending` : null,
      badgeType: (stats?.failedJobs ?? 0) > 0 ? "danger" : "default",
      color: "from-emerald-500 to-green-600",
      accentBg: "bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-800/40",
      icon: Cpu,
      href: "/songs",
    },
  ];

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-10">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-zinc-200 dark:border-zinc-800/80">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-white">
              System Overview
            </h1>
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Live
            </span>
          </div>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1 text-sm md:text-base">
            Real-time analytics and management across your entire audio infrastructure.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchStats(true)}
            disabled={loading || refreshing}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold text-zinc-700 dark:text-zinc-200 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/80 transition-all shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            <span>{refreshing ? "Refreshing..." : "Refresh"}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-sm flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <p className="font-medium">{error}</p>
        </div>
      )}

      {/* Metrics Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
        {loading ? (
          <SkeletonCard variant="stat" count={5} />
        ) : (
          statCards.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.name}
                href={card.href}
                className="group relative overflow-hidden bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm hover:shadow-xl hover:shadow-indigo-500/5 hover:-translate-y-1 transition-all duration-300"
              >
                {/* Background glow orb */}
                <div
                  className={`absolute -top-10 -right-10 w-28 h-28 bg-gradient-to-br ${card.color} opacity-10 rounded-full blur-2xl group-hover:opacity-20 transition-opacity`}
                />

                <div className="flex items-center justify-between mb-4">
                  <div
                    className={`p-3 rounded-2xl border ${card.accentBg} transition-transform group-hover:scale-105`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>

                  {card.badge && (
                    <span
                      className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                        card.badgeType === "danger"
                          ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30"
                          : card.badgeType === "warning"
                          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                          : "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30"
                      }`}
                    >
                      {card.badge}
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="text-3xl font-black tracking-tight text-zinc-900 dark:text-white">
                    {card.value.toLocaleString()}
                  </div>
                  <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                    {card.name}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800/60 flex items-center justify-between text-xs text-zinc-400 dark:text-zinc-500">
                  <span>{card.subValue}</span>
                  <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all text-indigo-500" />
                </div>
              </Link>
            );
          })
        )}
      </div>

      {/* Activity & Queues Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Songs */}
        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 p-6 md:p-7 shadow-sm">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-zinc-100 dark:border-zinc-800/70">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                <Music className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Recent Songs</h2>
                <p className="text-xs text-zinc-500">Latest additions to the music catalog</p>
              </div>
            </div>
            <Link
              href="/songs"
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
            >
              View All <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loading ? (
            <SkeletonCard variant="activity" count={5} />
          ) : !stats?.recentSongs || stats.recentSongs.length === 0 ? (
            <div className="py-12 text-center text-zinc-400 text-sm">
              <Music className="w-8 h-8 mx-auto mb-2 opacity-40" />
              No songs found in catalog.
            </div>
          ) : (
            <div className="space-y-3">
              {stats.recentSongs.map((song) => (
                <div
                  key={song.id}
                  className="group flex items-center justify-between p-3 rounded-2xl bg-zinc-50/70 dark:bg-zinc-800/30 hover:bg-zinc-100/70 dark:hover:bg-zinc-800/70 border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700/50 transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative w-11 h-11 rounded-xl overflow-hidden bg-zinc-200 dark:bg-zinc-800 shrink-0">
                      {song.imageKey ? (
                        <Image
                          src={getImageUrl(song.imageKey, { width: 88, height: 88, quality: 75 })}
                          alt={song.title}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-400">
                          <Music className="w-5 h-5" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm truncate">
                          {song.title}
                        </span>
                        {song.isFeatured && (
                          <span className="shrink-0 flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            <Sparkles className="w-2.5 h-2.5" /> Featured
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
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
        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 p-6 md:p-7 shadow-sm">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-zinc-100 dark:border-zinc-800/70">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Pipeline Jobs</h2>
                <p className="text-xs text-zinc-500">Audio transcoding & analysis status</p>
              </div>
            </div>
            <Link
              href="/jobs"
              className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
            >
              <span>View Telemetry</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loading ? (
            <SkeletonCard variant="activity" count={5} />
          ) : !stats?.recentJobs || stats.recentJobs.length === 0 ? (
            <div className="py-12 text-center text-zinc-400 text-sm">
              <Cpu className="w-8 h-8 mx-auto mb-2 opacity-40" />
              No background jobs active or recorded.
            </div>
          ) : (
            <div className="space-y-3">
              {stats.recentJobs.map((job) => {
                const statusConfig = {
                  COMPLETED: {
                    badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
                    dot: "bg-emerald-500",
                    label: "Completed",
                  },
                  PROCESSING: {
                    badge: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
                    dot: "bg-blue-500 animate-pulse",
                    label: "Processing",
                  },
                  PENDING: {
                    badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
                    dot: "bg-amber-500",
                    label: "Pending",
                  },
                  FAILED: {
                    badge: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
                    dot: "bg-rose-500",
                    label: "Failed",
                  },
                }[job.status] || {
                  badge: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20",
                  dot: "bg-zinc-500",
                  label: job.status,
                };

                return (
                  <Link
                    key={job.id}
                    href="/jobs"
                    className="flex items-center justify-between p-3.5 rounded-2xl bg-zinc-50/70 dark:bg-zinc-800/30 border border-zinc-100 dark:border-zinc-800/40 hover:border-indigo-300 dark:hover:border-indigo-800 transition-colors"
                  >
                    <div className="min-w-0 pr-3">
                      <p className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm truncate">
                        {job.title}
                      </p>
                      <p className="text-xs text-zinc-500 truncate flex items-center gap-1.5 mt-0.5">
                        <span>{job.artistName} {job.isVideoReprocess ? "• Video Reprocess" : ""}</span>
                        {job.currentStage && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-200/60 dark:bg-zinc-700/60 font-mono font-semibold">
                            {job.currentStage}
                          </span>
                        )}
                        {job.transcodingAttempt != null && job.transcodingAttempt > 1 && (
                          <span className="text-[10px] text-amber-500 font-bold">
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Quick Actions (2 cols on lg) */}
        <div className="lg:col-span-2 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 p-6 md:p-8 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Quick Actions</h2>
              <p className="text-xs text-zinc-500">Fast shortcuts to common admin workflows</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Link
              href="/songs"
              className="flex flex-col items-center text-center p-5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 hover:bg-indigo-100/60 dark:hover:bg-indigo-950/40 transition-all group"
            >
              <div className="p-3 rounded-2xl bg-indigo-600 text-white shadow-md shadow-indigo-600/20 mb-3 group-hover:scale-110 transition-transform">
                <PlusCircle className="w-5 h-5" />
              </div>
              <span className="font-bold text-sm text-zinc-900 dark:text-white">Add Song</span>
              <span className="text-[11px] text-zinc-500 mt-1">Upload & transcode</span>
            </Link>

            <Link
              href="/artists"
              className="flex flex-col items-center text-center p-5 rounded-2xl bg-purple-50/60 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/40 hover:bg-purple-100/60 dark:hover:bg-purple-950/40 transition-all group"
            >
              <div className="p-3 rounded-2xl bg-purple-600 text-white shadow-md shadow-purple-600/20 mb-3 group-hover:scale-110 transition-transform">
                <Mic2 className="w-5 h-5" />
              </div>
              <span className="font-bold text-sm text-zinc-900 dark:text-white">Manage Artists</span>
              <span className="text-[11px] text-zinc-500 mt-1">Profiles & covers</span>
            </Link>

            <Link
              href="/playlists"
              className="flex flex-col items-center text-center p-5 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 hover:bg-amber-100/60 dark:hover:bg-amber-950/40 transition-all group"
            >
              <div className="p-3 rounded-2xl bg-amber-600 text-white shadow-md shadow-amber-600/20 mb-3 group-hover:scale-110 transition-transform">
                <ListMusic className="w-5 h-5" />
              </div>
              <span className="font-bold text-sm text-zinc-900 dark:text-white">Curate Playlists</span>
              <span className="text-[11px] text-zinc-500 mt-1">Featured mixes</span>
            </Link>

            <Link
              href="/users"
              className="flex flex-col items-center text-center p-5 rounded-2xl bg-cyan-50/60 dark:bg-cyan-950/20 border border-cyan-100 dark:border-cyan-900/40 hover:bg-cyan-100/60 dark:hover:bg-cyan-950/40 transition-all group"
            >
              <div className="p-3 rounded-2xl bg-cyan-600 text-white shadow-md shadow-cyan-600/20 mb-3 group-hover:scale-110 transition-transform">
                <Shield className="w-5 h-5" />
              </div>
              <span className="font-bold text-sm text-zinc-900 dark:text-white">User Accounts</span>
              <span className="text-[11px] text-zinc-500 mt-1">Roles & security</span>
            </Link>
          </div>
        </div>

        {/* System Health */}
        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 p-6 md:p-8 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-5 h-5 text-indigo-500" />
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white">System Status</h2>
            </div>
            <p className="text-xs text-zinc-500 mb-6">Backend services and connectivity</p>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800/50">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Core Engine API</span>
                </div>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  Online
                </span>
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800/50">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">PostgreSQL DB</span>
                </div>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  Connected
                </span>
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800/50">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                  <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Audio Pipeline</span>
                </div>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  Ready
                </span>
              </div>
            </div>
          </div>

          <div className="pt-4 mt-6 border-t border-zinc-100 dark:border-zinc-800/60 text-xs text-zinc-400 flex items-center justify-between">
            <span>AudioMelody Admin v1.0</span>
            <span className="font-mono">Port 8080/9090</span>
          </div>
        </div>
      </div>
    </div>
  );
}
