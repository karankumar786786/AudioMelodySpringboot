"use client";

import React from "react";
import { Plus, Search, Music, LayoutGrid, List, Star, Film, Video } from "lucide-react";

export type SongPresetFilter = "ALL" | "FEATURED" | "CANVAS" | "FULL_VIDEO" | "LYRICS";

interface SongsFilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  genreFilter: string;
  onGenreFilterChange: (genre: string) => void;
  presetFilter: SongPresetFilter;
  onPresetFilterChange: (preset: SongPresetFilter) => void;
  viewMode: "table" | "grid";
  onViewModeChange: (mode: "table" | "grid") => void;
  totalSongs: number;
  pageSize: number;
  onPageSizeChange: (pageSize: number) => void;
  onOpenCreateModal: () => void;
}

const COMMON_GENRES = [
  "ALL",
  "Pop",
  "Hip-Hop",
  "Electronic",
  "R&B",
  "Rock",
  "Bollywood",
  "Indie",
  "Acoustic",
  "Ambient",
];

export function SongsFilterBar({
  search,
  onSearchChange,
  genreFilter,
  onGenreFilterChange,
  presetFilter,
  onPresetFilterChange,
  viewMode,
  onViewModeChange,
  totalSongs,
  pageSize,
  onPageSizeChange,
  onOpenCreateModal,
}: SongsFilterBarProps) {
  return (
    <div className="space-y-3">
      {/* Top Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#121215] p-3 rounded-2xl border border-white/8">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by title, artist, country, language, genre, or album..."
            className="w-full bg-[#16161a] border border-white/8 hover:border-white/14 focus:border-white/30 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none transition-all"
          />
        </div>

        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap justify-between">
          {/* View Mode Toggle: Table / Grid */}
          <div className="flex bg-[#16161a] p-1 rounded-xl border border-white/8">
            <button
              type="button"
              onClick={() => onViewModeChange("table")}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === "table"
                  ? "bg-white text-black shadow-sm"
                  : "text-zinc-400 hover:text-white"
              }`}
              title="Spreadsheet Table View"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange("grid")}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === "grid"
                  ? "bg-white text-black shadow-sm"
                  : "text-zinc-400 hover:text-white"
              }`}
              title="Artwork Card Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>

          {/* Track count indicator */}
          <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 bg-[#16161a] border border-white/8 rounded-xl text-xs text-zinc-400 font-mono">
            <Music className="w-3.5 h-3.5 text-zinc-300" />
            <span className="tabular-nums">
              {totalSongs.toLocaleString()} {totalSongs === 1 ? "track" : "tracks"}
            </span>
          </div>

          {/* Page Size Selector */}
          <div className="flex items-center gap-1.5">
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="bg-[#16161a] border border-white/8 text-zinc-300 text-xs font-semibold rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-white/30 cursor-pointer"
            >
              <option value={10}>10 / page</option>
              <option value={20}>20 / page</option>
              <option value={50}>50 / page</option>
              <option value={100}>100 / page</option>
            </select>
          </div>

          {/* Add Song Button */}
          <button
            type="button"
            onClick={onOpenCreateModal}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-white hover:bg-zinc-200 text-black font-bold text-xs rounded-xl transition-all shadow-sm active:scale-95 shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Add Song</span>
          </button>
        </div>
      </div>

      {/* Preset Filters Row: All, Featured, Video Canvas, Full Video, Lyrics */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
        <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mr-1">
          Preset:
        </span>
        <button
          type="button"
          onClick={() => onPresetFilterChange("ALL")}
          className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
            presetFilter === "ALL"
              ? "bg-white text-black font-bold shadow-sm"
              : "bg-[#141418] text-zinc-400 hover:text-white hover:bg-[#1a1a20] border border-white/6"
          }`}
        >
          All Tracks
        </button>
        <button
          type="button"
          onClick={() => onPresetFilterChange("FEATURED")}
          className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
            presetFilter === "FEATURED"
              ? "bg-white text-black font-bold shadow-sm"
              : "bg-[#141418] text-zinc-400 hover:text-white hover:bg-[#1a1a20] border border-white/6"
          }`}
        >
          <Star className={`w-3.5 h-3.5 ${presetFilter === "FEATURED" ? "fill-amber-500 text-amber-500" : "fill-amber-400 text-amber-400"}`} />
          <span>Featured Only</span>
        </button>
        <button
          type="button"
          onClick={() => onPresetFilterChange("CANVAS")}
          className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
            presetFilter === "CANVAS"
              ? "bg-white text-black font-bold shadow-sm"
              : "bg-[#141418] text-zinc-400 hover:text-white hover:bg-[#1a1a20] border border-white/6"
          }`}
        >
          <Film className="w-3.5 h-3.5 text-zinc-300" />
          <span>Vertical Canvas</span>
        </button>
        <button
          type="button"
          onClick={() => onPresetFilterChange("FULL_VIDEO")}
          className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
            presetFilter === "FULL_VIDEO"
              ? "bg-white text-black font-bold shadow-sm"
              : "bg-[#141418] text-zinc-400 hover:text-white hover:bg-[#1a1a20] border border-white/6"
          }`}
        >
          <Video className="w-3.5 h-3.5 text-zinc-300" />
          <span>Full 16:9 Video</span>
        </button>
        <button
          type="button"
          onClick={() => onPresetFilterChange("LYRICS")}
          className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
            presetFilter === "LYRICS"
              ? "bg-white text-black font-bold shadow-sm"
              : "bg-[#141418] text-zinc-400 hover:text-white hover:bg-[#1a1a20] border border-white/6"
          }`}
        >
          <span className="font-mono text-[10px] font-bold">LRC</span>
          <span>Synced Lyrics</span>
        </button>
      </div>

      {/* Multi-Genre Quick Filter Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
        <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mr-1">
          Genre:
        </span>
        {COMMON_GENRES.map((g) => {
          const isActive = genreFilter === g;
          return (
            <button
              key={g}
              type="button"
              onClick={() => onGenreFilterChange(g)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                isActive
                  ? "bg-white text-black font-bold shadow-sm"
                  : "bg-[#141418] text-zinc-400 hover:text-white hover:bg-[#1a1a20] border border-white/6"
              }`}
            >
              {g === "ALL" ? "All Genres" : g}
            </button>
          );
        })}
      </div>
    </div>
  );
}
