"use client";

import Link from "next/link";
import { DashboardStats } from "@/lib/api";
import { SkeletonCard } from "@/components/SkeletonCard";
import {
  Music,
  Activity,
  Mic2,
  ListMusic,
  Users,
  Cpu,
  ArrowUpRight,
} from "lucide-react";

interface DashboardMetricCardsProps {
  stats: DashboardStats | null;
  loading: boolean;
}

export function DashboardMetricCards({ stats, loading }: DashboardMetricCardsProps) {
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
      name: "Total Streams",
      value: stats?.totalStreams ?? 0,
      subValue: "Global audio streams",
      badge: (stats?.totalStreams ?? 0) > 0 ? "Telemetry Active" : null,
      badgeType: "default",
      icon: Activity,
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
      badge:
        (stats?.failedJobs ?? 0) > 0
          ? `${stats?.failedJobs} failed`
          : (stats?.pendingJobs ?? 0) > 0
          ? `${stats?.pendingJobs} pending`
          : null,
      badgeType: (stats?.failedJobs ?? 0) > 0 ? "danger" : "default",
      icon: Cpu,
      href: "/jobs",
    },
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <SkeletonCard variant="stat" count={6} />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      {statCards.map((card) => {
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
      })}
    </div>
  );
}
