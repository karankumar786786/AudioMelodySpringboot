"use client";

import React from "react";
import { QuickPicksGrid } from "@/components/QuickPicksGrid";
import type { Song } from "@/lib/api/types";
import { AuroraText } from "@/components/ui/aurora-text";
import { Badge } from "@/components/ui/badge";

interface HomeHeaderProps {
  greeting: string;
  userName: string | null;
  activeFilter: string;
  onFilterClick: (filter: string) => void;
  quickPicks: Song[];
  isQuickPicksLoading: boolean;
}

const FILTERS = ["All", "Trending", "Artists", "Playlists", "Explore"] as const;

export const HomeHeader: React.FC<HomeHeaderProps> = ({
  greeting,
  userName,
  activeFilter,
  onFilterClick,
  quickPicks,
  isQuickPicksLoading,
}) => {
  return (
    <section className="relative z-10 space-y-1.5 sm:space-y-2">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-1.5">
            <span>{greeting}</span>
            {userName && (
              <AuroraText className="font-extrabold">
                , {userName}
              </AuroraText>
            )}
          </h1>
        </div>

        {/* Quick Filter / Navigation Pills */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
          {FILTERS.map((filter) => {
            const isActive = activeFilter === filter;
            return (
              <Badge
                key={filter}
                variant={isActive ? "default" : "outline"}
                onClick={() => onFilterClick(filter)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-all duration-200 shrink-0 ${
                  isActive
                    ? "bg-white text-black shadow-sm hover:bg-white/90"
                    : "bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-white border-white/10"
                }`}
              >
                {filter === "Trending" && "🔥 "}
                {filter === "Artists" && "🎤 "}
                {filter === "Playlists" && "💿 "}
                {filter}
              </Badge>
            );
          })}
        </div>
      </div>

      {/* Quick Picks 6-Card Grid (Spotify Style: Instant 1-Click Play) */}
      <QuickPicksGrid songs={quickPicks} isLoading={isQuickPicksLoading} />
    </section>
  );
};
