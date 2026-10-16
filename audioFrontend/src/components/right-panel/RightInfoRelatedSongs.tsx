"use client";

import React, { type RefObject } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Song } from "@/lib/api";
import { SongCard } from "@/components/SongCard";

interface RightInfoRelatedSongsProps {
  artistMoreSongs: Song[];
  isRelatedLoading: boolean;
  scrollRelated: (distance: number) => void;
  relatedSongsRef: RefObject<HTMLDivElement | null>;
}

export function RightInfoRelatedSongs({
  artistMoreSongs,
  isRelatedLoading,
  scrollRelated,
  relatedSongsRef,
}: RightInfoRelatedSongsProps) {
  return (
    <section className="bg-black rounded-2xl px-1.5 shadow-xl">
      <div className="flex items-center justify-between pb-2 px-1">
        <h3 className="text-sm font-bold text-white tracking-tight">
          Related Songs
        </h3>
        {artistMoreSongs.length > 0 && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => scrollRelated(-160)}
              type="button"
              aria-label="Scroll left"
              className="w-6 h-6 rounded-full bg-zinc-900/90 hover:bg-zinc-800 border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-all active:scale-95 shadow-sm cursor-pointer"
            >
              <ChevronLeft size={13} />
            </button>
            <button
              onClick={() => scrollRelated(160)}
              type="button"
              aria-label="Scroll right"
              className="w-6 h-6 rounded-full bg-zinc-900/90 hover:bg-zinc-800 border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-all active:scale-95 shadow-sm cursor-pointer"
            >
              <ChevronRight size={13} />
            </button>
          </div>
        )}
      </div>

      {isRelatedLoading ? (
        <div className="flex gap-2 overflow-hidden pb-1">
          {[1, 2, 3].map((i) => (
            <div key={i} className="shrink-0 w-32 space-y-1.5 animate-pulse p-2 bg-zinc-950 rounded-lg">
              <div className="w-full aspect-square bg-zinc-900 rounded-md" />
              <div className="h-3 w-3/4 bg-zinc-800 rounded" />
              <div className="h-2.5 w-1/2 bg-zinc-800/60 rounded" />
            </div>
          ))}
        </div>
      ) : artistMoreSongs.length > 0 ? (
        <div
          ref={relatedSongsRef}
          className="flex gap-2 overflow-x-auto no-scrollbar pb-1 scroll-smooth"
        >
          {artistMoreSongs.map((song: Song) => (
            <SongCard
              key={song.id}
              song={song}
              className="shrink-0 w-32 p-2!"
            />
          ))}
        </div>
      ) : (
        <p className="text-xs text-zinc-500 py-2 px-1">No other tracks found for this artist.</p>
      )}
    </section>
  );
}
