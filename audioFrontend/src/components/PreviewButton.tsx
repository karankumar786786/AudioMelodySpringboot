"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Volume2, Loader2, Square, Pause } from "lucide-react";
import { useStore } from "@tanstack/react-store";
import { previewPlayer, previewStore } from "@/lib/preview-player";
import { Song } from "@/lib/api";

const formatTime = (seconds: number) => {
  if (isNaN(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

interface PreviewButtonProps {
  song: Song | any;
  className?: string;
  size?: "xs" | "sm" | "md";
  variant?: "icon" | "pill";
  showLabel?: boolean;
}

export function PreviewButton({
  song,
  className = "",
  size = "sm",
  variant = "icon",
  showLabel = false,
}: PreviewButtonProps) {
  const previewState = useStore(previewStore, (s) => s);
  const [isHovered, setIsHovered] = useState(false);

  if (!song?.id) return null;

  const isTarget = previewState.songId === song.id;
  const isPlaying = isTarget && previewState.status === "playing";
  const isLoading =
    isTarget &&
    (previewState.status === "loading" || previewState.status === "countdown");

  const startTime =
    song.previewStartTime != null && song.previewStartTime >= 0
      ? song.previewStartTime
      : 0;
  const endTime =
    song.previewEndTime != null && song.previewEndTime > startTime
      ? song.previewEndTime
      : startTime + 30;

  const progress = isPlaying ? Math.min(1, Math.max(0, previewState.progress || 0)) : 0;
  const currentTime = isPlaying ? previewState.currentTime : startTime;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    previewPlayer.togglePreview(song);
  };

  const titleText = isPlaying
    ? `Playing preview (${formatTime(currentTime)} / ${formatTime(previewState.endTime)}) • Click to stop`
    : isLoading
    ? "Loading preview..."
    : `Preview best part (${formatTime(startTime)} - ${formatTime(endTime)})`;

  // Pill variant with progress bar
  if (variant === "pill") {
    return (
      <button
        type="button"
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`relative overflow-hidden inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer select-none ${
          isPlaying
            ? "!opacity-100 bg-[#121212] text-white border border-primary/50 shadow-lg shadow-primary/20 scale-105 z-10"
            : isLoading
            ? "!opacity-100 bg-primary/20 text-primary border border-primary/40 animate-pulse z-10"
            : "bg-white/10 text-zinc-300 hover:text-white hover:bg-white/20 border border-white/10"
        } ${className}`}
        title={titleText}
      >
        {/* Fill background bar according to progress */}
        {isPlaying && (
          <div
            className="absolute inset-y-0 left-0 bg-primary/25 transition-all duration-100 ease-linear pointer-events-none"
            style={{ width: `${(progress * 100).toFixed(1)}%` }}
          />
        )}

        <div className="relative z-10 flex items-center gap-1.5">
          {isPlaying ? (
            <>
              {isHovered ? (
                <Square size={11} className="fill-red-400 text-red-400" />
              ) : (
                <div className="flex items-end gap-0.5 h-3 w-3">
                  <motion.span
                    animate={{ height: ["30%", "100%", "40%"] }}
                    transition={{
                      duration: 0.5,
                      repeat: Infinity,
                      repeatType: "reverse",
                    }}
                    className="w-0.5 bg-primary rounded-full"
                  />
                  <motion.span
                    animate={{ height: ["80%", "30%", "90%"] }}
                    transition={{
                      duration: 0.4,
                      repeat: Infinity,
                      repeatType: "reverse",
                      delay: 0.1,
                    }}
                    className="w-0.5 bg-primary rounded-full"
                  />
                  <motion.span
                    animate={{ height: ["40%", "90%", "30%"] }}
                    transition={{
                      duration: 0.45,
                      repeat: Infinity,
                      repeatType: "reverse",
                      delay: 0.2,
                    }}
                    className="w-0.5 bg-primary rounded-full"
                  />
                </div>
              )}
              <span className="font-mono text-[11px] text-primary">
                {formatTime(currentTime)}
              </span>
            </>
          ) : isLoading ? (
            <>
              <Loader2 size={12} className="animate-spin text-primary" />
              <span>Loading...</span>
            </>
          ) : (
            <>
              <Volume2 size={12} className="text-primary" />
              <span>Preview</span>
            </>
          )}
        </div>
      </button>
    );
  }

  // Dimension presets for Circular Progress Ring
  const ringConfig = {
    xs: { box: "w-7 h-7", size: 28, center: 14, r: 11, stroke: 2, iconSize: 11 },
    sm: { box: "w-8 h-8", size: 32, center: 16, r: 13, stroke: 2.5, iconSize: 12 },
    md: { box: "w-10 h-10", size: 40, center: 20, r: 16.5, stroke: 3, iconSize: 15 },
  };

  const currentRing = ringConfig[size];
  const circumference = 2 * Math.PI * currentRing.r;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 ${currentRing.box} text-zinc-400 hover:text-white ${className} ${
        isPlaying || isLoading
          ? "!opacity-100 !pointer-events-auto !visible z-20"
          : ""
      }`}
    >
      {/* 1. Real-time Progress Ring around the button */}
      {isPlaying && (
        <svg
          className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none drop-shadow-[0_0_6px_rgba(30,215,96,0.4)]"
          viewBox={`0 0 ${currentRing.size} ${currentRing.size}`}
        >
          {/* Background circle track */}
          <circle
            cx={currentRing.center}
            cy={currentRing.center}
            r={currentRing.r}
            fill="none"
            stroke="rgba(255, 255, 255, 0.2)"
            strokeWidth={currentRing.stroke}
          />
          {/* Dynamic Progress arc */}
          <circle
            cx={currentRing.center}
            cy={currentRing.center}
            r={currentRing.r}
            fill="none"
            stroke="#1ed760"
            strokeWidth={currentRing.stroke}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-[stroke-dashoffset] duration-150 ease-linear"
          />
        </svg>
      )}

      {/* Loading Pulsing Outline */}
      {isLoading && (
        <span className="absolute inset-0.5 rounded-full border border-primary/50 animate-ping opacity-60 pointer-events-none" />
      )}

      {/* 2. Main Trigger Button */}
      <button
        type="button"
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`relative flex items-center justify-center rounded-full transition-all cursor-pointer ${
          isPlaying
            ? "!opacity-100 w-[calc(100%-8px)] h-[calc(100%-8px)] bg-black text-primary hover:bg-zinc-900 shadow-md"
            : isLoading
            ? "!opacity-100 w-[calc(100%-8px)] h-[calc(100%-8px)] bg-primary/20 text-primary"
            : "w-full h-full text-zinc-400 hover:text-white hover:bg-white/10"
        }`}
        title={titleText}
        aria-label={titleText}
      >
        {isPlaying ? (
          isHovered ? (
            <Square size={currentRing.iconSize - 1} className="fill-red-400 text-red-400" />
          ) : (
            <div className="flex items-end justify-center gap-0.5 h-3 w-3">
              <motion.span
                animate={{ height: ["30%", "100%", "40%"] }}
                transition={{
                  duration: 0.5,
                  repeat: Infinity,
                  repeatType: "reverse",
                  ease: "easeInOut",
                }}
                className="w-0.5 bg-primary rounded-full"
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
                className="w-0.5 bg-primary rounded-full"
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
                className="w-0.5 bg-primary rounded-full"
              />
            </div>
          )
        ) : isLoading ? (
          <Loader2 size={currentRing.iconSize} className="animate-spin text-primary" />
        ) : (
          <Volume2
            size={currentRing.iconSize}
            className="transition-transform group-hover:scale-110"
          />
        )}
      </button>

      {showLabel && (
        <span className="ml-1.5 text-[11px] font-medium text-white select-none">
          {isPlaying ? formatTime(currentTime) : "Preview"}
        </span>
      )}
    </div>
  );
}
