"use client";

import React from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Film } from "lucide-react";
import { VideoCard } from "@/components/video-card";
import type { Song } from "@/lib/api/types";

interface FullVideosSectionProps {
  sectionRef: React.RefObject<HTMLElement | null>;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onScroll: (distance: number) => void;
  videos: Song[];
}

export const FullVideosSection: React.FC<FullVideosSectionProps> = ({
  sectionRef,
  scrollRef,
  onScroll,
  videos,
}) => {
  if (!videos || videos.length === 0) return null;

  return (
    <section ref={sectionRef} className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <Film size={17} className="stroke-[2.2]" />
          </div>
          <div className="flex items-baseline gap-2">
            <h2 className="text-xl font-bold text-white tracking-tight">
              Full Music Videos
            </h2>
            <span className="hidden sm:inline-block text-[11px] font-semibold text-emerald-400/90 tracking-wide uppercase">
              • High Definition
            </span>
          </div>
        </div>

        {/* Scroll Chevrons */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => onScroll(-420)}
            type="button"
            aria-label="Scroll left"
            className="w-7 h-7 rounded-full bg-zinc-900/90 hover:bg-zinc-800 border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-all active:scale-95 shadow-sm cursor-pointer"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => onScroll(420)}
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
          className="flex flex-row overflow-x-auto gap-3 pb-1 no-scrollbar px-1 snap-x snap-mandatory scroll-smooth"
        >
          {videos.map((song: Song, idx: number) => (
            <VideoCard
              key={`full-video-${song.id}`}
              song={song}
              priority={idx < 3}
              className="flex-none snap-start w-[85vw] sm:w-[calc(50%-8px)] md:w-[calc(40%-8px)] lg:w-[calc(30%-8px)] xl:w-[calc(25%-9px)] 2xl:w-[calc(20%-10px)]"
            />
          ))}
        </motion.div>
        <div className="pointer-events-none absolute top-0 right-0 h-[calc(100%-1rem)] w-16 bg-gradient-to-l from-black via-black/40 to-transparent" />
      </div>
    </section>
  );
};

export default FullVideosSection;
