"use client";

import React, { type RefObject } from "react";
import { Loader2, Search, X } from "lucide-react";

interface CommandPaletteInputProps {
  query: string;
  setQuery: (q: string) => void;
  isSearching: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
}

export function CommandPaletteInput({
  query,
  setQuery,
  isSearching,
  inputRef,
}: CommandPaletteInputProps) {
  return (
    <div className="relative flex items-center px-4 py-3.5 border-b border-white/10 gap-3">
      <Search size={20} className="text-zinc-400 shrink-0" />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search songs, artists, playlists, or albums..."
        className="flex-1 bg-transparent text-white text-base placeholder-zinc-500 focus:outline-none"
      />
      {isSearching && (
        <Loader2 size={18} className="animate-spin text-primary shrink-0" />
      )}
      {query && (
        <button
          type="button"
          onClick={() => {
            setQuery("");
            inputRef.current?.focus();
          }}
          className="p-1 rounded-full text-zinc-500 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
        >
          <X size={16} />
        </button>
      )}
      <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-0.5 rounded bg-zinc-800 border border-white/10 text-[11px] font-mono text-zinc-400 shadow-sm">
        ESC
      </kbd>
    </div>
  );
}
