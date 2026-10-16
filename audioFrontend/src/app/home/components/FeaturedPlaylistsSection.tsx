"use client";

import React from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PlaylistCard } from "@/components/PlaylistCard";
import type { Playlist } from "@/lib/api/types";

interface FeaturedPlaylistsSectionProps {
  sectionRef: React.RefObject<HTMLElement | null>;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onScroll: (distance: number) => void;
  isPlaylistsLoading: boolean;
  playlists?: Playlist[];
}

export const FeaturedPlaylistsSection: React.FC<FeaturedPlaylistsSectionProps> = ({
  sectionRef,
  scrollRef,
  onScroll,
  isPlaylistsLoading,
  playlists,
}) => {
  return (
    <section ref={sectionRef} className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white tracking-tight">
          Featured Playlists
        </h2>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => onScroll(-380)}
            type="button"
            aria-label="Scroll left"
            className="w-7 h-7 rounded-full bg-zinc-900/90 hover:bg-zinc-800 border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-all active:scale-95 shadow-sm cursor-pointer"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => onScroll(380)}
            type="button"
            aria-label="Scroll right"
            className="w-7 h-7 rounded-full bg-zinc-900/90 hover:bg-zinc-800 border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-all active:scale-95 shadow-sm cursor-pointer"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <motion.div
        ref={scrollRef}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="flex flex-row overflow-x-auto gap-3 md:gap-3.5 pb-3 no-scrollbar px-1 scroll-smooth"
      >
        {isPlaylistsLoading
          ? [1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="flex-none w-37.5 sm:w-45 space-y-3"
              >
                <div className="aspect-square rounded-xl bg-zinc-900 animate-pulse border border-white/5" />
                <div className="h-3 w-1/2 bg-zinc-900 rounded animate-pulse" />
              </div>
            ))
          : playlists?.map((playlist: Playlist) => (
              <PlaylistCard key={playlist.id} playlist={playlist} />
            ))}
      </motion.div>
    </section>
  );
};
