"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/http";
import { queryKeys } from "@/lib/query/keys";

/** Listening analytics (adminBackend catalog/analytics_views.py). */
export type AnalyticsRange = "7d" | "30d" | "90d" | "all";

export interface PeriodKpis {
  source: "events" | "history";
  plays: number;
  listeners: number;
  qualifiedStreams: number;
  completions: number;
  completionRate: number;
  skips: number;
  skipRate: number | null;
  avgListened: number;
  listenedHours: number;
  returningListeners?: number;
  playsPerListener?: number;
}

export interface Kpis {
  current: PeriodKpis;
  previous: PeriodKpis | null;
  change: Record<string, number | null>;
}

export interface DailyPoint {
  day: string;
  plays: number;
  listeners?: number;
  qualifiedStreams?: number;
  completions: number;
  skips: number | null;
  listenedHours?: number;
}

export interface TimelineSecond {
  sec: number;
  listens: number;
  exits: number;
  skips: number;
  seeksAway: number;
  seeksInto: number;
  retention: number;
}

export interface Hook {
  startSec: number;
  endSec: number;
  score: number;
}

export interface QualityRow {
  quality: string;
  platform: string;
  plays: number;
  listenedHours: number;
  avgStartupMs: number | null;
  rebuffersPerPlay: number;
  rebufferMsPerPlay: number;
  stallRatio: number;
}

export interface SongAnalytics {
  song: {
    id: string;
    title: string;
    artistName: string;
    duration: number;
    songKey: string;
    imageKey: string;
    status: string;
    totalStreams: number;
    createdAt?: string;
  };
  range: { label: AnalyticsRange; start: string | null; end: string };
  kpis: Kpis;
  engagement: { favourites: number; playlistAdds: number; shorts: number };
  daily: DailyPoint[];
  timeline: {
    seconds: TimelineSecond[];
    hooks: Hook[];
    summary: {
      trackedPlays: number;
      peakSec: number | null;
      earlyExitRate: number;
      totalSkips: number;
      totalSeeks: number;
    } | null;
  };
  quality: QualityRow[];
  lake: {
    available: boolean;
    error: string | null;
    audience: {
      plays: number;
      listeners: number;
      returningListeners: number;
      playsPerListener: number;
    } | null;
    whenListened: { weekday: number; hour: number; plays: number }[];
    platforms: { platform: string; plays: number; avgListened: number }[];
  };
}

export interface SongRef {
  songId: string;
  title: string | null;
  artistName: string | null;
  imageKey: string | null;
}

export interface AnalyticsOverview {
  range: { label: AnalyticsRange; start: string | null; end: string };
  kpis: Kpis;
  daily: DailyPoint[];
  topSongs: (SongRef & {
    plays: number;
    completionRate: number;
    skipRate: number | null;
    listenedHours: number | null;
  })[];
  topCompletion: (SongRef & { plays: number; completionRate: number })[];
  skippedIntros: (SongRef & {
    plays: number;
    earlyExits: number;
    earlyExitRate: number;
  })[];
  qualityMix: {
    quality: string;
    plays: number;
    avgStartupMs: number | null;
    rebuffersPerPlay: number;
  }[];
  retention: {
    cohort: string;
    size: number;
    weeks: { week: number; listeners: number; rate: number }[];
  }[];
  lake: { available: boolean; error: string | null };
}

export function useSongAnalytics(id: string, range: AnalyticsRange) {
  return useQuery({
    queryKey: queryKeys.analytics.song(id, range),
    queryFn: ({ signal }) =>
      apiGet<SongAnalytics>(
        `/admin/song/${id}/analytics?range=${range}`,
        signal,
      ),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

export function useAnalyticsOverview(range: AnalyticsRange) {
  return useQuery({
    queryKey: queryKeys.analytics.overview(range),
    queryFn: ({ signal }) =>
      apiGet<AnalyticsOverview>(
        `/admin/analytics/overview?range=${range}`,
        signal,
      ),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}
