"use client";

import React from "react";
import {
  ChevronDown,
  Maximize2,
  Minimize2,
  Pause,
  PictureInPicture2,
  Play,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { PlayerTooltip } from "@/components/player/PlayerTooltip";
import type { QualityLevel } from "./types";

interface VideoControlsOverlayProps {
  showControls: boolean;
  isInitializing: boolean;
  title: string;
  artistName: string;
  isPlaying: boolean;
  isMuted: boolean;
  isFullscreen: boolean;
  safeCurrentTime: number;
  safeDuration: number;
  progressPct: number;
  bufferedPct: number;
  qualityLevels: QualityLevel[];
  selectedQuality: number;
  showQualityMenu: boolean;
  qualityLabel: string;
  fmt: (s: number) => string;
  onTogglePlay: () => void;
  onToggleMute: () => void;
  onTogglePip: () => void;
  onToggleFullscreen: () => void;
  onClose: () => void;
  onSeek: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onToggleQualityMenu: () => void;
  onApplyQuality: (height: number) => void;
}

export function VideoControlsOverlay({
  showControls,
  isInitializing,
  title,
  artistName,
  isPlaying,
  isMuted,
  isFullscreen,
  safeCurrentTime,
  safeDuration,
  progressPct,
  bufferedPct,
  qualityLevels,
  selectedQuality,
  showQualityMenu,
  qualityLabel,
  fmt,
  onTogglePlay,
  onToggleMute,
  onTogglePip,
  onToggleFullscreen,
  onClose,
  onSeek,
  onToggleQualityMenu,
  onApplyQuality,
}: VideoControlsOverlayProps) {
  return (
    <div
      className="absolute inset-0 flex flex-col justify-between overflow-hidden pointer-events-none"
      style={{
        opacity: showControls && !isInitializing ? 1 : 0,
        transition: "opacity 0.3s ease",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Top: title + PiP/Close */}
      <div
        className="flex items-center justify-between px-6 sm:px-8 pt-6 pb-16 pointer-events-auto"
        style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.85), transparent)" }}
      >
        <div className="min-w-0 flex-1 pr-4">
          <h2 className="text-white font-bold text-lg sm:text-xl leading-tight truncate">{title}</h2>
          <p className="text-zinc-300 text-xs sm:text-sm truncate mt-0.5">{artistName}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <PlayerTooltip content="Picture-in-Picture" shortcut="P" side="bottom">
            <button
              onClick={(e) => { e.stopPropagation(); onTogglePip(); }}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer backdrop-blur-sm"
              aria-label="Picture-in-Picture"
            >
              <PictureInPicture2 size={16} />
            </button>
          </PlayerTooltip>
          <PlayerTooltip content="Close" shortcut={["Esc", "V"]} side="bottom" align="end">
            <button
              onClick={(e) => { e.stopPropagation(); onClose(); }}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer backdrop-blur-sm"
              aria-label="Close full video"
            >
              <X size={16} />
            </button>
          </PlayerTooltip>
        </div>
      </div>

      {/* Bottom: progress + controls */}
      <div
        className="px-6 sm:px-8 pb-6 sm:pb-8 pt-16 pointer-events-auto"
        style={{ background: "linear-gradient(to top, rgba(0,0,0,0.95), rgba(0,0,0,0.6), transparent)" }}
      >
        <div className="flex items-center gap-3 mb-3">
          <span className="text-xs text-zinc-300 font-mono w-10 text-right shrink-0 select-none">
            {fmt(safeCurrentTime)}
          </span>

          <div className="relative flex-1 h-5 flex items-center group cursor-pointer select-none">
            {/* Background Track */}
            <div className="absolute inset-x-0 h-1 group-hover:h-1.5 bg-white/20 rounded-full transition-all duration-150" />

            {/* Buffered Loaded Bar */}
            <div
              className="absolute left-0 h-1 group-hover:h-1.5 bg-white/40 rounded-full pointer-events-none transition-all duration-150"
              style={{ width: `${bufferedPct}%` }}
            />

            {/* Played Progress Bar */}
            <div
              className="absolute left-0 h-1 group-hover:h-1.5 bg-white rounded-full pointer-events-none transition-all duration-150"
              style={{ width: `${progressPct}%` }}
            />

            {/* Scrubber thumb circle */}
            <div
              className="absolute w-3.5 h-3.5 bg-white rounded-full shadow-md -translate-x-1/2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150"
              style={{ left: `${progressPct}%` }}
            />

            {/* Native Slider Input */}
            <input
              type="range"
              min="0"
              max={Math.max(1, safeDuration)}
              step="0.1"
              value={Math.min(safeCurrentTime, Math.max(1, safeDuration))}
              onChange={onSeek}
              aria-label="Seek video"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 m-0 p-0 border-0 bg-transparent"
            />
          </div>

          <span className="text-xs text-zinc-300 font-mono w-10 shrink-0 select-none">
            {fmt(safeDuration)}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <PlayerTooltip content={isPlaying ? "Pause" : "Play"} shortcut={["Space", "K"]}>
              <button
                onClick={onTogglePlay}
                className="w-9 h-9 rounded-full bg-white flex items-center justify-center text-black hover:scale-105 transition-transform cursor-pointer"
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? (
                  <Pause size={18} fill="black" />
                ) : (
                  <Play size={18} fill="black" style={{ marginLeft: 2 }} />
                )}
              </button>
            </PlayerTooltip>

            <PlayerTooltip content={isMuted ? "Unmute" : "Mute"} shortcut="M">
              <button
                onClick={onToggleMute}
                className="text-zinc-300 hover:text-white transition-colors p-1 cursor-pointer"
                aria-label={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
            </PlayerTooltip>
          </div>

          <div className="flex items-center gap-2">
            {qualityLevels.length > 0 && (
              <div className="relative">
                <PlayerTooltip content="Video Quality">
                  <button
                    onClick={(e) => { e.stopPropagation(); onToggleQualityMenu(); }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all cursor-pointer"
                  >
                    {qualityLabel}
                    <ChevronDown size={12} />
                  </button>
                </PlayerTooltip>
                {showQualityMenu && (
                  <div
                    className="absolute bottom-full mb-2 right-0 bg-zinc-900 border border-zinc-700 rounded-xl overflow-hidden shadow-2xl min-w-[80px] z-20"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {[{ height: -1, label: "Auto" }, ...qualityLevels].map((q) => (
                      <button
                        key={q.height}
                        onClick={() => onApplyQuality(q.height)}
                        className={`w-full text-left px-3 py-2 text-xs font-bold transition-colors ${
                          selectedQuality === q.height
                            ? "text-white bg-white/15"
                            : "text-zinc-400 hover:text-white hover:bg-white/5"
                        }`}
                      >
                        {q.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <PlayerTooltip content={isFullscreen ? "Exit Fullscreen" : "Fullscreen"} shortcut="F" align="end">
              <button
                onClick={(e) => { e.stopPropagation(); onToggleFullscreen(); }}
                className="text-zinc-300 hover:text-white transition-colors p-1 cursor-pointer"
                aria-label={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
              >
                {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
              </button>
            </PlayerTooltip>
          </div>
        </div>
      </div>
    </div>
  );
}
