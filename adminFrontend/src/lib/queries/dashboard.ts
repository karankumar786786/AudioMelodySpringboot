"use client";

import { useQuery } from "@tanstack/react-query";
import type { DashboardStats, QueueBackpressureSummary } from "@/lib/api";
import { ApiError, apiGet, fetchPage } from "@/lib/http";
import { queryKeys } from "@/lib/query/keys";

/** Builds the stats from the list endpoints when the aggregate endpoint is unavailable. */
async function fallbackStats(signal?: AbortSignal): Promise<DashboardStats> {
  const safe = <T,>(p: Promise<T>) => p.catch(() => null);
  const [songs, artists, playlists, users, queues] = await Promise.all([
    safe(fetchPage<DashboardStats["recentSongs"][number]>("/admin/song", { page: 0, size: 5 }, signal)),
    safe(fetchPage("/admin/artist", { page: 0, size: 1 }, signal)),
    safe(fetchPage("/admin/playlist", { page: 0, size: 1 }, signal)),
    safe(fetchPage("/admin/account", { page: 0, size: 1 }, signal)),
    safe(apiGet<QueueBackpressureSummary>("/admin/jobs/queues", signal)),
  ]);
  return {
    totalSongs: songs?.meta.totalCount ?? songs?.rows.length ?? 0,
    activeSongs: songs?.meta.activeCount ?? 0,
    featuredSongs: 0,
    totalArtists: artists?.meta.totalCount ?? 0,
    activeArtists: artists?.meta.activeCount ?? 0,
    totalPlaylists: playlists?.meta.totalCount ?? 0,
    activePlaylists: playlists?.meta.activeCount ?? 0,
    totalUsers: users?.meta.totalCount ?? 0,
    activeUsers: users?.meta.activeCount ?? 0,
    blockedUsers: users?.meta.blockedCount ?? 0,
    totalJobs: 0,
    pendingJobs: 0,
    failedJobs: 0,
    processingJobs: 0,
    completedJobs: 0,
    recentSongs: songs?.rows ?? [],
    recentJobs: [],
    queueStats: queues ?? undefined,
  };
}

export function useDashboardStats() {
  return useQuery({
    queryKey: queryKeys.dashboard.stats(),
    queryFn: async ({ signal }) => {
      try {
        return await apiGet<DashboardStats>("/admin/dashboard/stats", signal);
      } catch (err) {
        if (err instanceof ApiError) return fallbackStats(signal);
        throw err;
      }
    },
  });
}
