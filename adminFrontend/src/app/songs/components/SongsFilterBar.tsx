"use client";

import { Plus, Search, Music } from "lucide-react";

interface SongsFilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  totalSongs: number;
  pageSize: number;
  onPageSizeChange: (pageSize: number) => void;
  onOpenCreateModal: () => void;
}

export function SongsFilterBar({
  search,
  onSearchChange,
  totalSongs,
  pageSize,
  onPageSizeChange,
  onOpenCreateModal,
}: SongsFilterBarProps) {
  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-[#121212] p-4 rounded-2xl border border-[#282828]">
      {/* Search Input */}
      <div className="relative flex-1">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by title, artist, language, or album..."
          className="w-full bg-[#181818] border border-[#282828] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-white transition-colors"
        />
      </div>

      <div className="flex items-center gap-3">
        {/* Track count indicator */}
        <div className="hidden md:flex items-center gap-1.5 px-3 py-2 bg-[#181818] border border-[#282828] rounded-xl text-xs text-zinc-400 font-medium">
          <Music className="w-3.5 h-3.5 text-emerald-400" />
          <span>
            {totalSongs.toLocaleString()} {totalSongs === 1 ? "track" : "tracks"}
          </span>
        </div>

        {/* Page Size Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500 hidden sm:inline">Per page:</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="bg-[#181818] border border-[#282828] text-zinc-300 text-xs font-semibold rounded-xl px-3 py-2.5 focus:outline-none focus:border-white cursor-pointer"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>

        {/* Add Song Button */}
        <button
          type="button"
          onClick={onOpenCreateModal}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm rounded-xl transition-all shadow-lg shadow-emerald-500/20 active:scale-95 shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Add Song</span>
        </button>
      </div>
    </div>
  );
}
