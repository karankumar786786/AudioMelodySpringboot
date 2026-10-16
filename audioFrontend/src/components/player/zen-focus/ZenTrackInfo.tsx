"use client";

import React from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Radio } from "lucide-react";
import type { Song } from "@/lib/api/types";

interface ZenTrackInfoProps {
  currentSong: Song;
  coverUrl: string;
  isPlaying: boolean;
}

export const ZenTrackInfo: React.FC<ZenTrackInfoProps> = ({
  currentSong,
  coverUrl,
  isPlaying,
}) => {
  return (
    <>
      {/* Mobile Only: Compact Horizontal Track Header (Saves vertical space for lyrics) */}
      <div
        style={{
          background:
            "linear-gradient(135deg, rgba(255, 255, 255, 0.16) 0%, rgba(255, 255, 255, 0.04) 100%), rgba(20, 20, 25, 0.4)",
          boxShadow:
            "inset 0 1px 1px 0 rgba(255, 255, 255, 0.35), inset 0 -1px 1px 0 rgba(0, 0, 0, 0.2), 0 12px 30px rgba(0, 0, 0, 0.4)",
        }}
        className="flex lg:hidden items-center gap-3.5 w-full px-2 py-2 shrink-0 rounded-2xl border border-white/20 backdrop-blur-3xl backdrop-saturate-190"
      >
        <div
          style={{
            boxShadow:
              "inset 0 1px 1px 0 rgba(255, 255, 255, 0.3), 0 6px 20px rgba(0, 0, 0, 0.5)",
          }}
          className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-xl overflow-hidden border border-white/20 bg-zinc-900 shrink-0"
        >
          {coverUrl ? (
            <Image
              src={coverUrl}
              alt={currentSong.title}
              fill
              priority
              className="object-cover"
              sizes="56px"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-zinc-800/80 text-zinc-500">
              <Radio size={20} />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0 text-left">
          <h1 className="text-base sm:text-lg font-black tracking-tight text-white truncate">
            {currentSong.title}
          </h1>
          <p className="text-xs sm:text-sm font-semibold text-white/50 truncate">
            {currentSong.artistName}
            {currentSong.album && (
              <span className="text-white/40"> • {currentSong.album}</span>
            )}
            {currentSong.genre && (
              <span className="text-white/40"> • {currentSong.genre}</span>
            )}
          </p>
        </div>
      </div>

      {/* Desktop Only: Grand High-Res Artwork & Metadata Column */}
      <div className="hidden lg:flex lg:col-span-5 flex-col items-start text-left space-y-6 shrink-0">
        <motion.div
          animate={{ scale: isPlaying ? 1 : 0.97 }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
          style={{
            boxShadow:
              "inset 0 1.5px 1px 0 rgba(255, 255, 255, 0.35)",
          }}
          className="relative w-72 h-72 lg:w-80 lg:h-80 xl:w-95 xl:h-95 rounded-3xl overflow-hidden border border-white/20 bg-zinc-900 group"
        >
          {coverUrl ? (
            <Image
              src={coverUrl}
              alt={currentSong.title}
              fill
              priority
              className="object-cover"
              sizes="(max-width: 1280px) 320px, 380px"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-zinc-800/80 text-zinc-600">
              <Radio size={64} />
            </div>
          )}
          {/* Glass reflection overlay on album art */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "linear-gradient(165deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.04) 25%, transparent 50%)",
            }}
          />
        </motion.div>

        <div className="space-y-2 max-w-md">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white line-clamp-2">
            {currentSong.title}
          </h1>
          <p className="text-base sm:text-lg font-semibold text-white/50 line-clamp-1">
            {currentSong.artistName}
            {currentSong.album && (
              <span className="text-white/40"> • {currentSong.album}</span>
            )}
            {currentSong.genre && (
              <span className="text-white/40"> • {currentSong.genre}</span>
            )}
          </p>
        </div>
      </div>
    </>
  );
};
