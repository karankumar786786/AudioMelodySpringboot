"use client";

import React from "react";
import type { TabType } from "./types";
import { Badge } from "@/components/ui/badge";

interface CommandPaletteTabsProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  setSelectedIndex: (idx: number) => void;
  counts: {
    all: number;
    songs: number;
    artists: number;
    playlists: number;
  };
}

export function CommandPaletteTabs({
  activeTab,
  setActiveTab,
  setSelectedIndex,
  counts,
}: CommandPaletteTabsProps) {
  return (
    <div className="flex items-center gap-1.5 px-4 py-2 border-b border-white/5 bg-zinc-900/40 text-xs select-none">
      {(["all", "songs", "artists", "playlists"] as TabType[]).map((tab) => {
        const count = counts[tab];
        const isActive = activeTab === tab;

        return (
          <button
            key={tab}
            type="button"
            onClick={() => {
              setActiveTab(tab);
              setSelectedIndex(0);
            }}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium capitalize transition-all cursor-pointer ${
              isActive
                ? "bg-primary text-black font-semibold shadow-sm"
                : "text-zinc-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <span>{tab}</span>
            {count > 0 && (
              <Badge
                variant="outline"
                className={`h-4 px-1 text-[10px] font-mono leading-none border-transparent ${
                  isActive
                    ? "bg-black/25 text-black"
                    : "bg-white/10 text-zinc-300"
                }`}
              >
                {count}
              </Badge>
            )}
          </button>
        );
      })}
    </div>
  );
}
