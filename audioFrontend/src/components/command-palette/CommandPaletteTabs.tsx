"use client";

import React from "react";
import type { TabType } from "./types";

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
    <div className="flex items-center gap-1.5 px-4 py-2 border-b border-white/5 bg-zinc-900/40 text-xs">
      {(["all", "songs", "artists", "playlists"] as TabType[]).map((tab) => {
        const count = counts[tab];

        return (
          <button
            key={tab}
            type="button"
            onClick={() => {
              setActiveTab(tab);
              setSelectedIndex(0);
            }}
            className={`px-3 py-1 rounded-full font-medium capitalize transition-all cursor-pointer ${
              activeTab === tab
                ? "bg-primary text-black font-semibold shadow-sm"
                : "text-zinc-400 hover:text-white hover:bg-white/5"
            }`}
          >
            {tab} {count > 0 ? `(${count})` : ""}
          </button>
        );
      })}
    </div>
  );
}
