"use client";

import React from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Maximize,
} from "lucide-react";
import { playerActions } from "@/store/player.store";
import { Slider } from "@/components/ui/slider";

interface ZenControlsBarProps {
  currentTime: number;
  duration: number;
  buffered?: number;
  onSeek: (time: number) => void;
  volume: number;
  isMuted: boolean;
  isPlaying: boolean;
}

export const ZenControlsBar: React.FC<ZenControlsBarProps> = ({
  currentTime,
  duration,
  buffered = 0,
  onSeek,
  volume,
  isMuted,
  isPlaying,
}) => {
  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return "0:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <footer className="relative z-10 flex flex-col items-center max-w-xl mx-auto w-full space-y-2.5 sm:space-y-3 shrink-0 pt-2">
      {/* Progress Slider with Buffer & Hover effect */}
      <div className="w-full flex items-center gap-3 select-none px-1">
        <span className="text-[11px] font-medium text-white/60 tabular-nums select-none min-w-8 text-right">
          {formatTime(currentTime)}
        </span>
        <div
          className="flex-1 h-1.5 hover:h-2.5 bg-white/20 hover:bg-white/25 border border-white/10 rounded-full overflow-hidden cursor-pointer relative transition-all group/seek backdrop-blur-md"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            onSeek(pos * duration);
          }}
        >
          {/* Buffered Progress Bar */}
          <div
            style={{
              width: `${duration > 0 ? Math.min(100, Math.max(0, (buffered / duration) * 100)) : 0}%`,
            }}
            className="absolute left-0 top-0 bottom-0 bg-white/35 rounded-full pointer-events-none transition-all duration-200"
          />
          {/* Active Progress Bar */}
          <div
            style={{
              width: `${duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0}%`,
            }}
            className="absolute left-0 top-0 bottom-0 bg-white rounded-full pointer-events-none transition-all shadow-[0_0_8px_rgba(255,255,255,0.4)]"
          />
        </div>
        <span className="text-[11px] font-medium text-white/60 tabular-nums select-none min-w-8">
          {formatTime(duration)}
        </span>
      </div>

      {/* Controls Bar (Apple Liquid Frosted Glass Dock) */}
      <div
        style={{
          background:
            "linear-gradient(135deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0.07) 50%, rgba(255, 255, 255, 0.02) 100%), rgba(22, 22, 26, 0.45)",
          boxShadow:
            "inset 0 1.25px 1px 0 rgba(255, 255, 255, 0.5), inset 0 -1px 1px 0 rgba(0, 0, 0, 0.25), 0 24px 48px -12px rgba(0, 0, 0, 0.7), 0 8px 20px -4px rgba(0, 0, 0, 0.4)",
        }}
        className="flex items-center justify-between w-full px-4 sm:px-6 py-2 sm:py-2.5 rounded-full border border-white/25 backdrop-blur-3xl backdrop-saturate-190 backdrop-brightness-105"
      >
        {/* Volume Control (Toggle + Desktop Slider with Fill) */}
        <div
          onWheel={(e) => {
            e.preventDefault();
            if (isMuted) playerActions.setIsMuted(false);
            const delta = e.deltaY < 0 ? 0.05 : -0.05;
            playerActions.setVolume(Math.min(1, Math.max(0, volume + delta)));
          }}
          className="flex items-center gap-2"
        >
          <button
            type="button"
            onClick={() => playerActions.setIsMuted(!isMuted)}
            className="w-8 h-8 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/12 active:bg-white/20 active:scale-90 transition-all cursor-pointer"
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted || volume === 0 ? <VolumeX size={17} /> : <Volume2 size={17} />}
          </button>
          <div className="w-16 sm:w-20 hidden sm:block">
            <Slider
              min={0}
              max={1}
              step={0.01}
              value={[isMuted ? 0 : volume]}
              onValueChange={(val) => {
                playerActions.setVolume(val[0]);
                if (isMuted) playerActions.setIsMuted(false);
              }}
              className="cursor-pointer"
              aria-label="Volume slider"
            />
          </div>
        </div>

        {/* Transport Buttons */}
        <div className="flex items-center gap-3 sm:gap-4">
          <button
            onClick={() => playerActions.previous()}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-white/80 hover:text-white hover:bg-white/12 active:bg-white/20 hover:scale-105 active:scale-90 transition-all cursor-pointer"
            title="Previous track"
          >
            <SkipBack size={19} />
          </button>

          <button
            onClick={() => playerActions.setIsPlaying(!isPlaying)}
            className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-white text-black flex items-center justify-center shadow-[0_4px_16px_rgba(255,255,255,0.3),0_2px_6px_rgba(0,0,0,0.3)] hover:scale-105 active:scale-95 transition-all cursor-pointer hover:bg-white/95"
            title={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <Pause size={19} fill="black" />
            ) : (
              <Play size={19} fill="black" className="translate-x-0.5" />
            )}
          </button>

          <button
            onClick={() => playerActions.next(true)}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-white/80 hover:text-white hover:bg-white/12 active:bg-white/20 hover:scale-105 active:scale-90 transition-all cursor-pointer"
            title="Next track"
          >
            <SkipForward size={19} />
          </button>
        </div>

        {/* Fullscreen Toggle */}
        <button
          onClick={() => {
            if (!document.fullscreenElement) {
              document.documentElement.requestFullscreen().catch(() => {});
            } else {
              document.exitFullscreen().catch(() => {});
            }
          }}
          className="w-8 h-8 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/12 active:bg-white/20 active:scale-90 transition-all cursor-pointer"
          title="Toggle Fullscreen"
        >
          <Maximize size={17} />
        </button>
      </div>
    </footer>
  );
};
