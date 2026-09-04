"use client";

import React from "react";
import { TvMinimalPlay, Sliders, Moon, Mic2, ListMusic } from "lucide-react";
import { playerActions } from "@/store/player.store";
import { type PlayerSong } from "@/lib/player-utils";
import { PlayerTooltip } from "./PlayerTooltip";
import { PlayerQualitySelector } from "./PlayerQualitySelector";
import { PlayerSpeedSelector } from "./PlayerSpeedSelector";
import { PlayerVolumeSlider } from "./PlayerVolumeSlider";

interface PlayerRightControlsProps {
  currentSong: PlayerSong;
  isLyricsOpen: boolean;
  showQueuePanel: boolean;
  setShowQueuePanel: React.Dispatch<React.SetStateAction<boolean>>;
  showEqualizerModal: boolean;
  setShowEqualizerModal: React.Dispatch<React.SetStateAction<boolean>>;
  setShowSleepTimerModal: React.Dispatch<React.SetStateAction<boolean>>;
  sleepTimerMode?: "minutes" | "end_of_track" | null;
  selectedQuality: "auto" | number;
  qualityTracks: Array<{ index: number; bandwidth: number; label: string }>;
  showQualityMenu: boolean;
  setShowQualityMenu: React.Dispatch<React.SetStateAction<boolean>>;
  volume: number;
  isMuted: boolean;
}

export const PlayerRightControls: React.FC<PlayerRightControlsProps> = ({
  currentSong,
  isLyricsOpen,
  showQueuePanel,
  setShowQueuePanel,
  showEqualizerModal,
  setShowEqualizerModal,
  setShowSleepTimerModal,
  sleepTimerMode,
  selectedQuality,
  qualityTracks,
  showQualityMenu,
  setShowQualityMenu,
  volume,
  isMuted,
}) => {
  const hasFullVideo = Boolean(
    currentSong.fullVideoKey || (currentSong as any).full_video_key,
  );

  return (
    <div className="flex items-center justify-end gap-1.5 sm:gap-2 md:gap-2.5 w-[32%] md:w-[35%] max-w-[360px]">
      {/* Watch Full Video Button (when video is available) */}
      {hasFullVideo && (
        <PlayerTooltip content="Watch Full Video" shortcut="V">
          <button
            type="button"
            onClick={() => playerActions.openFullVideo()}
            className="p-1.5 rounded-md transition-colors cursor-pointer text-zinc-400 hover:text-white hover:bg-[#282828]"
            aria-label="Watch Full Video"
          >
            <TvMinimalPlay size={16} />
          </button>
        </PlayerTooltip>
      )}

      <PlayerTooltip content="Equalizer & Visualizer" shortcut="E">
        <button
          type="button"
          onClick={() => setShowEqualizerModal((v) => !v)}
          className={`p-1.5 rounded-md transition-colors cursor-pointer ${
            showEqualizerModal
              ? "text-primary bg-[#282828]"
              : "text-zinc-400 hover:text-white"
          }`}
          aria-label="Equalizer & Visualizer"
        >
          <Sliders size={16} />
        </button>
      </PlayerTooltip>

      <PlayerTooltip content="Sleep Timer">
        <button
          type="button"
          onClick={() => setShowSleepTimerModal(true)}
          className={`relative p-1.5 rounded-md transition-colors cursor-pointer ${
            sleepTimerMode
              ? "text-primary bg-[#282828]"
              : "text-zinc-400 hover:text-white"
          }`}
          aria-label="Sleep Timer"
        >
          <Moon size={16} />
          {sleepTimerMode && (
            <span className="absolute 1 top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          )}
        </button>
      </PlayerTooltip>

      <PlayerTooltip content="Lyrics" shortcut="L">
        <button
          type="button"
          onClick={() => playerActions.toggleLyrics()}
          className={`p-1.5 rounded-md transition-colors cursor-pointer ${
            isLyricsOpen
              ? "text-primary bg-[#282828]"
              : "text-zinc-400 hover:text-white"
          }`}
          aria-label="Lyrics"
        >
          <Mic2 size={16} />
        </button>
      </PlayerTooltip>

      <PlayerTooltip content="Queue" shortcut="Q">
        <button
          type="button"
          data-queue-toggle="true"
          onClick={() => setShowQueuePanel((v) => !v)}
          className={`p-1.5 rounded-md transition-colors cursor-pointer ${
            showQueuePanel
              ? "text-primary bg-[#282828]"
              : "text-zinc-400 hover:text-white"
          }`}
          aria-label="Queue"
        >
          <ListMusic size={16} />
        </button>
      </PlayerTooltip>

      <PlayerSpeedSelector />

      <PlayerQualitySelector
        selectedQuality={selectedQuality}
        qualityTracks={qualityTracks}
        showQualityMenu={showQualityMenu}
        setShowQualityMenu={setShowQualityMenu}
        onSelectQuality={(q) => playerActions.setSelectedQuality(q)}
      />

      <PlayerVolumeSlider volume={volume} isMuted={isMuted} />
    </div>
  );
};
