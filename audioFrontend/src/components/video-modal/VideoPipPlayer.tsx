"use client";

import React, { type RefObject } from "react";
import { Maximize2, Pause, Play, X } from "lucide-react";
import { PlayerTooltip } from "@/components/player/PlayerTooltip";

interface VideoPipPlayerProps {
  containerRef: RefObject<HTMLDivElement | null>;
  videoRef: RefObject<HTMLVideoElement | null>;
  title: string;
  artistName: string;
  isPlaying: boolean;
  bufferedPct: number;
  progressPct: number;
  safeCurrentTime: number;
  safeDuration: number;
  fmt: (s: number) => string;
  resetControlsTimer: () => void;
  onExpand: () => void;
  onClose: () => void;
  onTogglePlay: () => void;
}

export function VideoPipPlayer({
  containerRef,
  videoRef,
  title,
  artistName,
  isPlaying,
  bufferedPct,
  progressPct,
  safeCurrentTime,
  safeDuration,
  fmt,
  resetControlsTimer,
  onExpand,
  onClose,
  onTogglePlay,
}: VideoPipPlayerProps) {
  return (
    <div
      ref={containerRef}
      className="fixed bottom-24 right-4 sm:right-6 z-200 w-72 sm:w-80 md:w-96 aspect-video rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.95),inset_0_1px_1px_rgba(255,255,255,0.2)] ring-1 ring-white/20 bg-black animate-in fade-in slide-in-from-bottom-4 duration-300 select-none group"
      onMouseMove={resetControlsTimer}
      onMouseEnter={resetControlsTimer}
    >
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        playsInline
        preload="auto"
        crossOrigin="anonymous"
      />

      {/* Hover Controls Overlay */}
      <div
        className="absolute inset-0 bg-linear-to-t from-black/90 via-black/30 to-black/80 flex flex-col justify-between p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header: Title & Actions */}
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h4 className="text-xs font-bold text-white truncate leading-tight">{title}</h4>
            <p className="text-[10px] text-zinc-300 truncate">{artistName}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <PlayerTooltip content="Expand to Modal" shortcut="P">
              <button
                onClick={onExpand}
                className="p-1.5 rounded-full bg-black/60 hover:bg-black/90 text-white transition-all cursor-pointer border border-white/20 backdrop-blur-md"
                aria-label="Expand video"
              >
                <Maximize2 size={13} />
              </button>
            </PlayerTooltip>
            <PlayerTooltip content="Close & Resume Audio" shortcut={["Esc", "V"]}>
              <button
                onClick={onClose}
                className="p-1.5 rounded-full bg-black/60 hover:bg-black/90 text-white transition-all cursor-pointer border border-white/20 backdrop-blur-md"
                aria-label="Close video"
              >
                <X size={13} />
              </button>
            </PlayerTooltip>
          </div>
        </div>

        {/* Center Play/Pause button */}
        <div className="flex items-center justify-center">
          <button
            onClick={onTogglePlay}
            className="w-9 h-9 rounded-full bg-white/90 hover:bg-white flex items-center justify-center text-black shadow-xl hover:scale-110 active:scale-95 transition-all cursor-pointer"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <Pause size={16} fill="black" />
            ) : (
              <Play size={16} fill="black" style={{ marginLeft: 2 }} />
            )}
          </button>
        </div>

        {/* Bottom Progress Line */}
        <div className="space-y-1">
          <div className="relative h-1 w-full bg-white/20 rounded-full overflow-hidden">
            <div
              className="absolute left-0 top-0 bottom-0 bg-white/40 rounded-full"
              style={{ width: `${bufferedPct}%` }}
            />
            <div
              className="absolute left-0 top-0 bottom-0 bg-primary rounded-full"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono">
            <span>{fmt(safeCurrentTime)}</span>
            <span>{fmt(safeDuration)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
