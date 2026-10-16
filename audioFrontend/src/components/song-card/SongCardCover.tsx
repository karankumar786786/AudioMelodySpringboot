"use client";

import React from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Loader2, Pause, Play } from "lucide-react";
import type { Song } from "@/lib/api";

const formatTime = (seconds: number) => {
  if (isNaN(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

interface SongCardCoverProps {
  song: Song;
  imageUrl: string;
  priority?: boolean;
  isActiveSong: boolean;
  isPlaying: boolean;
  isAudioLoading: boolean;
  isPreviewPlaying: boolean;
  isCountingDown: boolean;
  isPreviewLoading: boolean;
  previewStartTime?: number;
  previewEndTime?: number;
  previewProgress?: number;
  onPlayToggle: (e: React.MouseEvent) => void;
  onPlayMouseEnter: () => void;
  onPlayMouseLeave: () => void;
}

export function SongCardCover({
  song,
  imageUrl,
  priority,
  isActiveSong,
  isPlaying,
  isAudioLoading,
  isPreviewPlaying,
  isCountingDown,
  isPreviewLoading,
  previewStartTime,
  previewEndTime,
  previewProgress,
  onPlayToggle,
  onPlayMouseEnter,
  onPlayMouseLeave,
}: SongCardCoverProps) {
  return (
    <div className="aspect-square bg-zinc-900 rounded-md mb-1.5 relative shadow-md overflow-hidden">
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt={song.title || "Song cover"}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 250px"
          priority={priority}
          className="object-cover group-hover:scale-105 transition-transform duration-300 ease-out"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-zinc-800 text-zinc-600">
          <span className="text-xs">No Image</span>
        </div>
      )}

      {/* Best Part Badge if preview is active */}
      {isPreviewPlaying && (
        <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5 bg-black/90 backdrop-blur-md border border-primary/40 px-2 py-0.5 rounded-full text-[10px] text-primary font-bold shadow-lg max-w-[88%]">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping shrink-0" />
          <span className="truncate font-mono">
            {formatTime(previewStartTime || 0)} -{" "}
            {formatTime(previewEndTime || 0)}
          </span>
        </div>
      )}

      {/* Spotify Green Play/Pause Button Overlay on Cover Art */}
      <div
        className={`absolute bottom-2 right-2 translate-y-2 group-hover:translate-y-0 transition-all duration-300 z-10 ${
          (isActiveSong && isPlaying) ||
          isPreviewPlaying ||
          isCountingDown ||
          isPreviewLoading
            ? "opacity-100 translate-y-0"
            : "opacity-0 group-hover:opacity-100"
        }`}
        onMouseEnter={onPlayMouseEnter}
        onMouseLeave={onPlayMouseLeave}
      >
        <div className="relative flex items-center justify-center">
          {/* Circular SVG countdown progress ring when counting down */}
          {isCountingDown && (
            <svg
              className="absolute -inset-1 w-[52px] h-[52px] -rotate-90 pointer-events-none"
              viewBox="0 0 52 52"
              aria-hidden="true"
            >
              <circle
                cx="26"
                cy="26"
                r="23"
                fill="none"
                stroke="rgba(255, 255, 255, 0.15)"
                strokeWidth="2.5"
              />
              <motion.circle
                cx="26"
                cy="26"
                r="23"
                fill="none"
                stroke="#ffffffff"
                strokeWidth="2.5"
                strokeDasharray={145}
                initial={{ strokeDashoffset: 145 }}
                animate={{ strokeDashoffset: 0 }}
                transition={{ duration: 1, ease: "linear" }}
                strokeLinecap="round"
              />
            </svg>
          )}

          {/* Real-time Progress Ring & Pulsing Beat Expansion when preview is playing */}
          {isPreviewPlaying && (
            <>
              <span className="absolute -inset-1 rounded-full border-2 border-primary animate-ping opacity-60 pointer-events-none" />
              <motion.span
                className="absolute -inset-2 rounded-full border border-primary/40 pointer-events-none"
                animate={{ scale: [1, 1.2, 1], opacity: [0.6, 0, 0.6] }}
                transition={{
                  duration: 1.2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
              <svg
                className="absolute -inset-1 w-[52px] h-[52px] -rotate-90 pointer-events-none drop-shadow-[0_0_8px_rgba(30,215,96,0.6)]"
                viewBox="0 0 52 52"
                aria-hidden="true"
              >
                <circle
                  cx="26"
                  cy="26"
                  r="23"
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.2)"
                  strokeWidth="2.5"
                />
                <circle
                  cx="26"
                  cy="26"
                  r="23"
                  fill="none"
                  stroke="#ffffffff"
                  strokeWidth="2.5"
                  strokeDasharray={145}
                  strokeDashoffset={
                    145 *
                    (1 -
                      Math.min(1, Math.max(0, previewProgress || 0)))
                  }
                  strokeLinecap="round"
                  className="transition-[stroke-dashoffset] duration-150 ease-linear"
                />
              </svg>
            </>
          )}

          <button
            type="button"
            onClick={onPlayToggle}
            className={`w-11 h-11 rounded-full bg-primary hover:scale-105 flex items-center justify-center text-black shadow-xl cursor-pointer transition-transform relative ${
              isPreviewPlaying
                ? "ring-2 ring-primary ring-offset-2 ring-offset-black"
                : ""
            }`}
            title={
              isActiveSong && isPlaying
                ? "Pause"
                : isPreviewPlaying
                  ? "Playing Preview (Click for Full Track)"
                  : "Play Track (Hover 3s for preview)"
            }
            aria-label={isActiveSong && isPlaying ? "Pause" : "Play"}
          >
            {isActiveSong && isPlaying ? (
              isAudioLoading ? (
                <Loader2 size={18} className="animate-spin text-black" />
              ) : (
                <Pause fill="black" size={18} />
              )
            ) : isPreviewLoading ? (
              <Loader2 size={18} className="animate-spin text-black" />
            ) : isPreviewPlaying ? (
              <div className="flex items-end justify-center gap-0.5 h-3.5 w-3.5">
                <motion.span
                  animate={{ height: ["30%", "100%", "40%"] }}
                  transition={{
                    duration: 0.5,
                    repeat: Infinity,
                    repeatType: "reverse",
                    ease: "easeInOut",
                  }}
                  className="w-0.5 bg-black rounded-full"
                />
                <motion.span
                  animate={{ height: ["80%", "30%", "90%"] }}
                  transition={{
                    duration: 0.4,
                    repeat: Infinity,
                    repeatType: "reverse",
                    ease: "easeInOut",
                    delay: 0.1,
                  }}
                  className="w-0.5 bg-black rounded-full"
                />
                <motion.span
                  animate={{ height: ["40%", "90%", "30%"] }}
                  transition={{
                    duration: 0.45,
                    repeat: Infinity,
                    repeatType: "reverse",
                    ease: "easeInOut",
                    delay: 0.2,
                  }}
                  className="w-0.5 bg-black rounded-full"
                />
              </div>
            ) : (
              <Play fill="black" size={18} className="translate-x-0.5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
