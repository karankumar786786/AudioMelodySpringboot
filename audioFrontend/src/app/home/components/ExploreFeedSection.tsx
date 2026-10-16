"use client";

import React from "react";
import { motion } from "framer-motion";
import { SongCard } from "@/components/SongCard";
import type { Song } from "@/lib/api/types";

interface ExploreFeedSectionProps {
  sectionRef: React.RefObject<HTMLElement | null>;
  triggerRef: React.RefObject<HTMLDivElement | null>;
  status: "pending" | "error" | "success";
  pages?: Array<{ data: { data: Song[] } }>;
  isFetchingNextPage: boolean;
}

export const ExploreFeedSection: React.FC<ExploreFeedSectionProps> = ({
  sectionRef,
  triggerRef,
  status,
  pages,
  isFetchingNextPage,
}) => {
  return (
    <section ref={sectionRef} className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white tracking-tight">
          Explore All Tracks
        </h2>
      </div>

      {status === "pending" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-3.5">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((i) => (
            <div
              key={i}
              className="aspect-square bg-zinc-900 rounded-xl animate-pulse border border-white/5"
            />
          ))}
        </div>
      ) : status === "error" ? (
        <div className="p-16 text-center text-zinc-500 border border-dashed border-[#282828] rounded-xl font-medium">
          Failed to load tracks
        </div>
      ) : (
        <motion.div
          initial="hidden"
          animate="show"
          variants={{
            hidden: { opacity: 0 },
            show: {
              opacity: 1,
              transition: { staggerChildren: 0.05 },
            },
          }}
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-3.5"
        >
          {pages?.map((page, i) =>
            page.data.data.map((song: Song, songIdx: number) => (
              <SongCard
                key={`${song.id}-${i}-${songIdx}`}
                song={song}
                priority={i === 0 && songIdx < 6}
              />
            )),
          )}
        </motion.div>
      )}

      {/* Loader / Infinite Scroll Trigger */}
      <div
        ref={triggerRef}
        id="infinite-scroll-trigger"
        className="h-32 flex items-center justify-center mt-12"
      >
        {isFetchingNextPage && (
          <div className="relative w-10 h-10 flex items-center justify-center">
            <div className="absolute inset-0 border-[3px] border-primary/10 rounded-full" />
            <div className="absolute inset-0 border-[3px] border-t-primary rounded-full animate-spin" />
          </div>
        )}
      </div>
    </section>
  );
};
