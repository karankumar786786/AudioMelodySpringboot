"use client";

import React from "react";
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
  const VolumeIcon =
    isMuted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;
  const volumePct = isMuted ? 0 : volume * 100;

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isMuted) playerActions.setIsMuted(false);
    playerActions.setVolume(parseFloat(e.currentTarget.value));
  };

  return (
    <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-[70px] sm:min-w-[90px] md:min-w-[110px]">
      <PlayerTooltip content={isMuted ? "Unmute" : "Mute"} shortcut="M">
        <button
          type="button"
          onClick={() => playerActions.setIsMuted(!isMuted)}
          className="text-zinc-400 hover:text-white transition-colors cursor-pointer shrink-0"
          aria-label={isMuted ? "Unmute" : "Mute"}
        >
          <VolumeIcon size={16} />
        </button>
      </PlayerTooltip>

      <PlayerTooltip content="Volume" shortcut={["↑", "↓"]} className="flex-1">
        <div className="relative flex-1 flex items-center h-6 w-full">
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            aria-label="Volume"
            style={{ backgroundSize: `${volumePct}% 100%` }}
            className="modern-slider w-full cursor-pointer"
          />
        </div>
      </PlayerTooltip>
    </div>
  );
};
