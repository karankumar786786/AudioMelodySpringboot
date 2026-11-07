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
  TrendingUp,
} from "lucide-react";

interface DashboardMetricCardsProps {
  stats: DashboardStats | null;
  loading: boolean;
}

export function formatCompactMetric(value: number): string {
  if (value >= 1_000_000_000) {
    return (value / 1_000_000_000).toFixed(2).replace(/\.00$/, "") + "B";
  }
  if (value >= 1_000_000) {
    return (value / 1_000_000).toFixed(2).replace(/\.00$/, "") + "M";
  }
  if (value >= 100_000) {
    return (value / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  }
  return value.toLocaleString();
}

export function DashboardMetricCards({ stats, loading }: DashboardMetricCardsProps) {
  const statCards = [
    {
      name: "Songs Catalog",
      rawValue: stats?.totalSongs ?? 0,
      displayValue: formatCompactMetric(stats?.totalSongs ?? 0),
      subValue: `${stats?.activeSongs ?? 0} active`,
      badge: stats?.featuredSongs ? `${stats.featuredSongs} featured` : null,
      icon: Music,
      href: "/songs",
      trend: "+12% this week",
    },
    {
      name: "Total Streams",
      rawValue: stats?.totalStreams ?? 0,
      displayValue: formatCompactMetric(stats?.totalStreams ?? 0),
      subValue: `${(stats?.totalStreams ?? 0).toLocaleString()} exact plays`,
      badge: (stats?.totalStreams ?? 0) > 0 ? "Active" : null,
      badgeType: "default",
      icon: Activity,
      href: "/songs",
      trend: "+8.4%",
    },
    {
      name: "Artists Roster",
      rawValue: stats?.totalArtists ?? 0,
      displayValue: formatCompactMetric(stats?.totalArtists ?? 0),
      subValue: `${stats?.activeArtists ?? 0} verified`,
      badge: null,
      icon: Mic2,
      href: "/artists",
      trend: "Catalog sync",
    },
    {
      name: "Playlists",
      rawValue: stats?.totalPlaylists ?? 0,
      displayValue: formatCompactMetric(stats?.totalPlaylists ?? 0),
      subValue: `${stats?.activePlaylists ?? 0} public`,
      badge: null,
      icon: ListMusic,
      href: "/playlists",
      trend: "Editorial",
    },
    {
      name: "User Accounts",
      rawValue: stats?.totalUsers ?? 0,
      displayValue: formatCompactMetric(stats?.totalUsers ?? 0),
      subValue: `${stats?.activeUsers ?? 0} active`,
      badge: (stats?.blockedUsers ?? 0) > 0 ? `${stats?.blockedUsers} blocked` : null,
      badgeType: "warning",
      icon: Users,
      href: "/users",
      trend: "Auth Active",
    },
    {
      name: "Processing Jobs",
      rawValue: stats?.totalJobs ?? 0,
      displayValue: formatCompactMetric(stats?.totalJobs ?? 0),
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
      trend: "Pipeline",
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
            className="group relative overflow-hidden bg-[#121215] hover:bg-[#16161b] p-5 rounded-2xl border border-white/8 hover:border-white/16 transition-all duration-200 shadow-sm hover:shadow-lg hover:shadow-black/50"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-black border border-white/10 flex items-center justify-center text-white transition-transform group-hover:scale-105 group-hover:border-white/20">
                <Icon className="w-5 h-5" />
              </div>

              {card.badge && (
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    card.badgeType === "danger"
                      ? "bg-rose-500/15 text-rose-400 border-rose-500/30"
                      : card.badgeType === "warning"
                      ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                      : "bg-white/10 text-zinc-300 border-white/20"
                  }`}
                >
                  {card.badge}
                </span>
              )}
            </div>

            <div className="space-y-1">
              <div
                className="text-2xl 2xl:text-3xl font-bold tracking-tight text-white font-mono tabular-nums truncate"
                title={`${card.name}: ${card.rawValue.toLocaleString()}`}
              >
                {card.displayValue}
              </div>
              <div className="text-xs font-semibold text-zinc-400">
                {card.name}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-white/6 flex items-center justify-between text-xs text-zinc-400">
              <span className="truncate text-[11px]" title={card.subValue}>
                {card.subValue}
              </span>
              <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all text-white shrink-0" />
            </div>
          </Link>
        );
      })}
    </div>
  );
}
