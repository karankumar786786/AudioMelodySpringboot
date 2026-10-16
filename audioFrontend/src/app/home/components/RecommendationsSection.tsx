"use client";

import React from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { SongCard } from "@/components/SongCard";
import type { Song } from "@/lib/api/types";

interface RecommendationsSectionProps {
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onScroll: (distance: number) => void;
  songs?: Song[];
}

export const RecommendationsSection: React.FC<RecommendationsSectionProps> = ({
  scrollRef,
  onScroll,
  songs,
}) => {
  if (!songs || songs.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-white tracking-tight">
            Recommended for You
          </h2>
        </div>
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

      <div className="relative">
        <motion.div
          ref={scrollRef}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="flex flex-row overflow-x-auto gap-3 md:gap-3.5 pb-3 no-scrollbar px-1 snap-x snap-mandatory scroll-smooth"
        >
          {songs.slice(0, 10).map((song: Song) => (
            <SongCard
              key={`rec-${song.id}`}
              song={song}
              className="flex-none snap-start w-[calc(50%-6px)] sm:w-[calc(33.333%-8px)] md:w-[calc(33.333%-8px)] lg:w-[calc(25%-9px)] xl:w-[calc(20%-10px)] 2xl:w-[calc(16.666%-10px)]"
            />
          ))}
        </motion.div>
        <div className="pointer-events-none absolute top-0 right-0 h-[calc(100%-1rem)] w-20 " />
      </div>
    </section>
  );
};
