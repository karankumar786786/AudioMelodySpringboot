"use client";

import React from "react";
import { Mic2, ListMusic, TvMinimalPlay } from "lucide-react";
import { playerActions } from "@/store/player.store";
import { type PlayerSong } from "@/lib/player-utils";
import { PlayerTooltip } from "./PlayerTooltip";
import { PlayerVolumeSlider } from "./PlayerVolumeSlider";
import { PlayerMoreMenu } from "./PlayerMoreMenu";
import { PlayerQualitySelector, type QualityTrack } from "./PlayerQualitySelector";

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
  qualityTracks: QualityTrack[];
  volume: number;
  isMuted: boolean;
  isBassBoostEnabled?: boolean;
  toggleBassBoost?: () => void;
  isSpatialAudioEnabled?: boolean;
  toggleSpatialAudio?: () => void;
  currentTime?: number;
  bufferedTime?: number;
  onOpenShare?: () => void;
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
  volume,
  isMuted,
  isBassBoostEnabled = false,
  toggleBassBoost = () => {},
  isSpatialAudioEnabled = false,
  toggleSpatialAudio = () => {},
  currentTime = 0,
  bufferedTime = 0,
  onOpenShare,
}) => {
  const hasFullVideo = Boolean(
    currentSong.fullVideoKey || (currentSong as any).full_video_key,
  );

  return (
    <div className="flex items-center justify-end gap-1.5 sm:gap-2 md:gap-2.5 w-[34%] md:w-[38%] max-w-[400px]">
      {/* Watch Full Video Button (when video key is present) */}
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

      {/* Lyrics Button */}
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

      {/* Queue Drawer Button */}
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

      {/* Quality Selector directly on bottom player */}
      <PlayerQualitySelector
        selectedQuality={selectedQuality}
        qualityTracks={qualityTracks}
        onSelectQuality={(q) => playerActions.setSelectedQuality(q)}
      />

      {/* Volume Slider & Mute Toggle */}
      <PlayerVolumeSlider volume={volume} isMuted={isMuted} />

      {/* 3-Dot More Menu (Audio FX, Equalizer, Sleep Timer, Speed, Share) */}
      <PlayerMoreMenu
        showEqualizerModal={showEqualizerModal}
        setShowEqualizerModal={setShowEqualizerModal}
        setShowSleepTimerModal={setShowSleepTimerModal}
        sleepTimerMode={sleepTimerMode}
        isBassBoostEnabled={isBassBoostEnabled}
        toggleBassBoost={toggleBassBoost}
        isSpatialAudioEnabled={isSpatialAudioEnabled}
        toggleSpatialAudio={toggleSpatialAudio}
        bufferedTime={bufferedTime}
        currentTime={currentTime}
        onOpenShare={onOpenShare}
      />
    </div>
  );
};


