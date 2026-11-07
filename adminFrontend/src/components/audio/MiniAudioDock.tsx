"use client";

import React from "react";
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  X,
  Film,
  Music,
} from "lucide-react";
import { useAudio } from "@/lib/audio-context";
import { getImageUrl } from "@/lib/image-utils";

function formatTime(seconds: number): string {
  if (!seconds || Number.isNaN(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function MiniAudioDock() {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    togglePlay,
    seekTo,
    setVolume,
    setIsCanvasOpen,
    stopTrack,
  } = useAudio();

  if (!currentTrack) return null;

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const coverUrl = currentTrack.imageKey
    ? getImageUrl(currentTrack.imageKey, { width: 100, height: 100 })
    : "";

  return (
    <div className="fixed bottom-0 left-64 right-0 z-40 bg-[#0e0e11]/90 backdrop-blur-2xl border-t border-white/[0.1] px-6 py-3 shadow-[0_-10px_35px_rgba(0,0,0,0.6)] animate-in slide-in-from-bottom-4 duration-200">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-6">
        {/* Left: Track Information & Cover Art */}
        <div className="flex items-center gap-3.5 min-w-[220px] max-w-xs shrink-0">
          <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-white/[0.12] overflow-hidden shrink-0 flex items-center justify-center relative shadow-sm">
            {coverUrl ? (
              <img
                src={coverUrl}
                alt={currentTrack.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <Music className="w-5 h-5 text-zinc-600" />
            )}
            {isPlaying && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              </div>
            )}
          </div>

          <div className="flex flex-col min-w-0">
            <span className="text-xs font-bold text-white truncate">
              {currentTrack.title}
            </span>
            <span className="text-[11px] text-zinc-400 truncate">
              {currentTrack.artistName || "Unknown Artist"}
            </span>

            {/* Video Canvas Pill if available */}
            {currentTrack.videoKey && (
              <button
                type="button"
                onClick={() => setIsCanvasOpen(true)}
                className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors w-fit"
              >
                <Film className="w-2.5 h-2.5" />
                <span>Preview Canvas</span>
              </button>
            )}
          </div>
        </div>

        {/* Center: Playback Controls & Progress Scrubber */}
        <div className="flex-1 max-w-2xl flex flex-col items-center gap-1.5">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => seekTo(Math.max(0, currentTime - 10))}
              className="text-zinc-400 hover:text-white transition-colors p-1"
              title="Rewind 10s"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={togglePlay}
              className="w-9 h-9 rounded-full bg-white hover:bg-zinc-200 text-black flex items-center justify-center transition-all shadow-md active:scale-95 cursor-pointer"
            >
              {isPlaying ? (
                <Pause className="w-4 h-4 fill-black" />
              ) : (
                <Play className="w-4 h-4 fill-black translate-x-0.5" />
              )}
            </button>

            <button
              type="button"
              onClick={() => seekTo(Math.min(duration, currentTime + 10))}
              className="text-zinc-400 hover:text-white transition-colors p-1"
              title="Fast Forward 10s"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Scrubber slider */}
          <div className="w-full flex items-center gap-3">
            <span className="text-[10px] font-mono text-zinc-400 w-8 text-right tabular-nums">
              {formatTime(currentTime)}
            </span>
            <div className="relative flex-1 flex items-center group cursor-pointer">
              <input
                type="range"
                min={0}
                max={duration || 100}
                value={currentTime}
                onChange={(e) => seekTo(Number(e.target.value))}
                className="w-full h-1 bg-white/[0.1] rounded-lg appearance-none cursor-pointer accent-white hover:h-1.5 transition-all"
              />
            </div>
            <span className="text-[10px] font-mono text-zinc-400 w-8 tabular-nums">
              {formatTime(duration)}
            </span>
          </div>
        </div>

        {/* Right: Volume & Dismiss */}
        <div className="flex items-center gap-4 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setVolume(volume === 0 ? 0.8 : 0)}
              className="text-zinc-400 hover:text-white transition-colors p-1"
            >
              {volume === 0 ? (
                <VolumeX className="w-4 h-4 text-zinc-500" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="w-16 h-1 bg-white/[0.1] rounded-lg appearance-none cursor-pointer accent-white"
            />
          </div>

          <div className="h-4 w-px bg-white/[0.1]" />

          <button
            type="button"
            onClick={stopTrack}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors"
            title="Close Player"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
