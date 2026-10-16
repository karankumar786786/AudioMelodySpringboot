"use client";

import React from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ArtistCard } from "@/components/ArtistCard";
import type { Artist } from "@/lib/api/types";

interface TopArtistsSectionProps {
  sectionRef: React.RefObject<HTMLElement | null>;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onScroll: (distance: number) => void;
  isArtistsLoading: boolean;
  artists?: Artist[];
}

export const TopArtistsSection: React.FC<TopArtistsSectionProps> = ({
  sectionRef,
  scrollRef,
  onScroll,
  isArtistsLoading,
  artists,
}) => {
  return (
    <section ref={sectionRef} className="space-y-1.5 -mt-1 sm:-mt-2">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white tracking-tight">
          Top Artists
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
        className="flex flex-row overflow-x-auto gap-2.5 pb-1 no-scrollbar px-1 scroll-smooth"
      >
        {isArtistsLoading
          ? [1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="flex-none w-28.75 sm:w-31 p-2 space-y-2"
              >
                <div className="aspect-square rounded-full bg-zinc-900 animate-pulse border border-white/5 mx-auto" />
                <div className="h-3 w-3/4 bg-zinc-900 rounded mx-auto animate-pulse" />
              </div>
            ))
          : artists?.map((artist: Artist) => (
              <ArtistCard key={artist.id} artist={artist} />
            ))}
      </motion.div>
    </section>
  );
};
