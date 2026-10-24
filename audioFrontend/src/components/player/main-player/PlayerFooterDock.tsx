"use client";

import React from "react";
import { PlayerTrackCard } from "../PlayerTrackCard";
import { PlayerControlButtons } from "../PlayerControlButtons";
import { PlayerProgressBar } from "../PlayerProgressBar";
import { PlayerRightControls } from "../PlayerRightControls";
import type { PlayerSong } from "@/lib/player-utils";

interface PlayerFooterDockProps {
  currentSong: PlayerSong;
  posterUrl: string;
  isPlaying: boolean;
  isShuffle: boolean;
  repeatMode: any;
  isVideoActive: boolean;
  audioElement: HTMLAudioElement | null;
  localTime: number;
  duration: number;
  buffered: number;
  onSeekChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isLyricsOpen: boolean;
  showQueuePanel?: boolean;
  setShowQueuePanel?: React.Dispatch<React.SetStateAction<boolean>>;
  showEqualizerModal?: boolean;
  setShowEqualizerModal?: React.Dispatch<React.SetStateAction<boolean>>;
  setShowSleepTimerModal?: React.Dispatch<React.SetStateAction<boolean>>;
  sleepTimerMode?: "minutes" | "end_of_track" | null;
  selectedQuality: "auto" | number;
  qualityTracks: any[];
  volume: number;
  isMuted: boolean;
  webAudio: {
    isBassBoostEnabled: boolean;
    toggleBassBoost: () => void;
    isSpatialAudioEnabled: boolean;
    toggleSpatialAudio: () => void;
  };
  onOpenShare?: () => void;
}

export const PlayerFooterDock: React.FC<PlayerFooterDockProps> = ({
  currentSong,
  posterUrl,
  isPlaying,
  isShuffle,
  repeatMode,
  isVideoActive,
  audioElement,
  localTime,
  duration,
  buffered,
  onSeekChange,
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
  webAudio,
  onOpenShare,
}) => {
  return (
    <footer className="fixed bottom-0 left-0 right-0 h-20 bg-black/95 backdrop-blur-md z-50 px-3 sm:px-4 md:px-6 flex items-center justify-between select-none">
      {/* Left Section: Track Info & Quick Actions */}
      <PlayerTrackCard currentSong={currentSong} posterUrl={posterUrl} />

      {/* Middle Section: Player Controls & Timeline */}
      <div className="flex flex-col items-center justify-center flex-1 max-w-xl px-2 sm:px-4 space-y-1">
        <PlayerControlButtons
          isPlaying={isPlaying}
          isShuffle={isShuffle}
          repeatMode={repeatMode}
          isVideoActive={isVideoActive}
          audioElement={audioElement}
        />
        <div className="w-full max-w-lg">
          <PlayerProgressBar
            currentTime={localTime}
            duration={duration}
            bufferedTime={buffered}
            onChange={onSeekChange}
          />
        </div>
      </div>

      {/* Right Section: Equalizer, Lyrics, Queue, Quality, Volume, FX */}
      <PlayerRightControls
        currentSong={currentSong}
        isLyricsOpen={isLyricsOpen}
        showQueuePanel={showQueuePanel}
        setShowQueuePanel={setShowQueuePanel}
        showEqualizerModal={showEqualizerModal}
        setShowEqualizerModal={setShowEqualizerModal}
        setShowSleepTimerModal={setShowSleepTimerModal}
        sleepTimerMode={sleepTimerMode}
        selectedQuality={selectedQuality}
        qualityTracks={qualityTracks}
        volume={volume}
        isMuted={isMuted}
        isBassBoostEnabled={webAudio.isBassBoostEnabled}
        toggleBassBoost={webAudio.toggleBassBoost}
        isSpatialAudioEnabled={webAudio.isSpatialAudioEnabled}
        toggleSpatialAudio={webAudio.toggleSpatialAudio}
        currentTime={localTime}
        bufferedTime={buffered}
        onOpenShare={onOpenShare}
      />
    </footer>
  );
};
