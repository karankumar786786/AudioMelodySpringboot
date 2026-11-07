"use client";

import React from "react";
import { CheckSquare, Sparkles, Search, Trash2, X, RefreshCw } from "lucide-react";

interface BulkActionsBarProps {
  selectedCount: number;
  onClearSelection: () => void;
  onBulkDelete: () => void;
  onBulkSyncAlgolia: () => void;
  onBulkSyncRecombee: () => void;
  isProcessing?: boolean;
}

export function BulkActionsBar({
  selectedCount,
  onClearSelection,
  onBulkDelete,
  onBulkSyncAlgolia,
  onBulkSyncRecombee,
  isProcessing = false,
}: BulkActionsBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 bg-[#16161b]/95 backdrop-blur-xl border border-white/15 rounded-2xl px-5 py-3 shadow-[0_10px_35px_rgba(0,0,0,0.6)] flex items-center gap-4 animate-in slide-in-from-bottom-5 duration-200">
      <div className="flex items-center gap-2 border-r border-white/10 pr-4">
        <CheckSquare className="w-4 h-4 text-white" />
        <span className="text-xs font-bold text-white whitespace-nowrap">
          {selectedCount} {selectedCount === 1 ? "track" : "tracks"} selected
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBulkSyncAlgolia}
          disabled={isProcessing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/25 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
          title="Push selected songs to Algolia Search Index"
        >
          <Search className="w-3.5 h-3.5" />
          <span>Sync Search</span>
        </button>

        <button
          type="button"
          onClick={onBulkSyncRecombee}
          disabled={isProcessing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/25 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
          title="Push selected songs to Recombee Recommendation Vectors"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Sync Recombee</span>
        </button>

        <button
          type="button"
          onClick={onBulkDelete}
          disabled={isProcessing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/25 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Delete</span>
        </button>

        <div className="h-4 w-px bg-white/10" />

        <button
          type="button"
          onClick={onClearSelection}
          className="p-1 rounded-lg text-zinc-400 hover:text-white transition-colors"
          title="Clear selection"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

