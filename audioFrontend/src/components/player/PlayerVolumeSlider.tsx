"use client";

import React, { useState } from "react";
import { VolumeX, Volume1, Volume2 } from "lucide-react";
import { playerActions } from "@/store/player.store";
import { PlayerTooltip } from "./PlayerTooltip";

interface PlayerVolumeSliderProps {
  volume: number;
  isMuted: boolean;
}

export const PlayerVolumeSlider: React.FC<PlayerVolumeSliderProps> = ({
  volume,
  isMuted,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const VolumeIcon =
    isMuted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;
  const rawPct = isMuted ? 0 : volume * 100;
  const roundedPct = Math.round(rawPct);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isMuted) playerActions.setIsMuted(false);
    playerActions.setVolume(parseFloat(e.currentTarget.value));
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (isMuted) playerActions.setIsMuted(false);
    const step = 0.05;
    const delta = e.deltaY < 0 ? step : -step;
    const nextVol = Math.min(1, Math.max(0, volume + delta));
    playerActions.setVolume(nextVol);
  };

  const showBadge = isHovered || isDragging;

  return (
    <div
      onWheel={handleWheel}
      className="flex items-center gap-1.5 sm:gap-2.5 min-w-[70px] sm:min-w-[90px] md:min-w-[110px]"
    >
      <PlayerTooltip content={isMuted ? "Unmute" : "Mute"} shortcut="M">
        <button
          type="button"
          onClick={() => playerActions.setIsMuted(!isMuted)}
          className="text-zinc-400 hover:text-white transition-colors cursor-pointer shrink-0 focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40 rounded-full p-1"
          aria-label={isMuted ? "Unmute" : "Mute"}
        >
          <VolumeIcon size={16} />
        </button>
      </PlayerTooltip>

      <PlayerTooltip
        content={isMuted ? "Muted (0%)" : `Volume: ${roundedPct}% (Scroll to adjust)`}
        shortcut={["↑", "↓"]}
        className="flex-1"
      >
        <div
          className="relative flex-1 flex items-center h-6 w-full"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => {
            setIsHovered(false);
            setIsDragging(false);
          }}
        >
          {/* Floating Volume Percentage Pill */}
          {showBadge && (
            <div
              className="absolute -top-7 pointer-events-none -translate-x-1/2 bg-zinc-900/95 text-white border border-white/20 shadow-lg text-[10px] font-bold px-1.5 py-0.5 rounded-md tabular-nums transition-all duration-150 z-30"
              style={{
                left: `${Math.max(12, Math.min(88, rawPct))}%`,
              }}
            >
              {isMuted ? "0%" : `${roundedPct}%`}
            </div>
          )}

          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            onMouseDown={() => setIsDragging(true)}
            onMouseUp={() => setIsDragging(false)}
            onTouchStart={() => setIsDragging(true)}
            onTouchEnd={() => setIsDragging(false)}
            aria-label="Volume"
            style={{ backgroundSize: `${rawPct}% 100%` }}
            className="modern-slider w-full cursor-pointer focus:outline-none"
          />
        </div>
      </PlayerTooltip>
    </div>
  );
};
