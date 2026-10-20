"use client";

import React from "react";
import dynamic from "next/dynamic";
import { playerActions } from "@/store/player.store";
import { getImageUrl } from "@/lib/image-utils";
import { getFullVideoHlsUrl, getFullVideoDashUrl, type PlayerSong } from "@/lib/player-utils";
import type { Song } from "@/lib/api/types";
import { PlayerHudOverlay } from "../PlayerHudOverlay";

const PlaylistPickerModal = dynamic(
  () => import("@/components/PlaylistPickerModal").then((m) => m.PlaylistPickerModal),
  { ssr: false },
);
const FullVideoModal = dynamic(
  () => import("@/components/FullVideoModal").then((m) => m.FullVideoModal),
  { ssr: false },
);
const SleepTimerModal = dynamic(
  () => import("../SleepTimerModal").then((m) => m.SleepTimerModal),
  { ssr: false },
);
const EqualizerModal = dynamic(
  () => import("../EqualizerModal").then((m) => m.EqualizerModal),
  { ssr: false },
);
const KeyboardShortcutsModal = dynamic(
  () => import("../KeyboardShortcutsModal").then((m) => m.KeyboardShortcutsModal),
  { ssr: false },
);
const CommandPaletteModal = dynamic(
  () => import("@/components/CommandPaletteModal").then((m) => m.CommandPaletteModal),
  { ssr: false },
);
const ShareSongModal = dynamic(
  () => import("@/components/ShareSongModal").then((m) => m.ShareSongModal),
  { ssr: false },
);
const PlayerQueuePanel = dynamic(
  () => import("../PlayerQueuePanel").then((m) => m.PlayerQueuePanel),
  { ssr: false },
);

interface PlayerModalsPortalProps {
  currentSong: PlayerSong;
  isPlaying: boolean;
  isFullVideoOpen: boolean;
  showEqualizerModal: boolean;
  setShowEqualizerModal: (show: boolean) => void;
  showSleepTimerModal: boolean;
  setShowSleepTimerModal: (show: boolean) => void;
  showShortcutsModal: boolean;
  setShowShortcutsModal: (show: boolean) => void;
  isPlaylistModalOpen: boolean;
  setIsPlaylistModalOpen: (show: boolean) => void;
  showQueuePanel: boolean;
  setShowQueuePanel: (show: boolean) => void;
  showCommandPalette: boolean;
  setShowCommandPalette: (show: boolean) => void;
  showShareModal: boolean;
  setShowShareModal: (show: boolean) => void;
  webAudio: {
    analyser: AnalyserNode | null;
    gains: number[];
    selectedPreset: string;
    setBandGain: (band: number, val: number) => void;
    applyPreset: (preset: any) => void;
    resetEq: () => void;
    isNormalizationEnabled: boolean;
    toggleNormalization: () => void;
  };
}

export const PlayerModalsPortal: React.FC<PlayerModalsPortalProps> = ({
  currentSong,
  isPlaying,
  isFullVideoOpen,
  showEqualizerModal,
  setShowEqualizerModal,
  showSleepTimerModal,
  setShowSleepTimerModal,
  showShortcutsModal,
  setShowShortcutsModal,
  isPlaylistModalOpen,
  setIsPlaylistModalOpen,
  showQueuePanel,
  setShowQueuePanel,
  showCommandPalette,
  setShowCommandPalette,
  showShareModal,
  setShowShareModal,
  webAudio,
}) => {
  return (
    <>
      {/* Equalizer & Visualizer Modal */}
      {showEqualizerModal && (
        <EqualizerModal
          isOpen={showEqualizerModal}
          onClose={() => setShowEqualizerModal(false)}
          analyser={webAudio.analyser}
          isPlaying={isPlaying}
          gains={webAudio.gains}
          selectedPreset={webAudio.selectedPreset}
          setBandGain={webAudio.setBandGain}
          applyPreset={webAudio.applyPreset}
          resetEq={webAudio.resetEq}
          isNormalizationEnabled={webAudio.isNormalizationEnabled}
          toggleNormalization={webAudio.toggleNormalization}
        />
      )}

      {/* Sleep Timer Modal */}
      {showSleepTimerModal && (
        <SleepTimerModal
          isOpen={showSleepTimerModal}
          onClose={() => setShowSleepTimerModal(false)}
        />
      )}

      {/* Keyboard Shortcuts Cheat-Sheet Modal */}
      {showShortcutsModal && (
        <KeyboardShortcutsModal
          isOpen={showShortcutsModal}
          onClose={() => setShowShortcutsModal(false)}
        />
      )}

      {/* Playlist Picker Modal */}
      {isPlaylistModalOpen && (
        <PlaylistPickerModal
          isOpen={isPlaylistModalOpen}
          onClose={() => setIsPlaylistModalOpen(false)}
          songId={currentSong.id}
          songTitle={currentSong.title}
        />
      )}

      {/* Full Video Modal */}
      {isFullVideoOpen && Boolean(
        currentSong.hasVideo ||
        currentSong.fullVideoKey ||
        (currentSong as any).full_video_key ||
        (currentSong as any).videoKey ||
        (currentSong as any).video_key
      ) && (
        <FullVideoModal
          songId={currentSong.id}
          fullVideoKey={
            currentSong.fullVideoKey ||
            (currentSong as any).full_video_key ||
            (currentSong as any).videoKey ||
            (currentSong as any).video_key ||
            `videos/${currentSong.id}`
          }
          videoKey={(currentSong as any).videoKey || (currentSong as any).video_key}
          hlsUrl={getFullVideoHlsUrl(currentSong)!}
          dashUrl={getFullVideoDashUrl(currentSong)}
          title={currentSong.title}
          artistName={currentSong.artistName}
          posterUrl={getImageUrl(currentSong.imageKey, { width: 1280, height: 720, aspectRatio: "16-9" }) || undefined}
          onClose={() => playerActions.closeFullVideo()}
        />
      )}

      {/* Queue Drawer */}
      {showQueuePanel && (
        <PlayerQueuePanel
          open={showQueuePanel}
          onClose={() => setShowQueuePanel(false)}
        />
      )}

      {/* Quick Search Spotlight Command Palette */}
      {showCommandPalette && (
        <CommandPaletteModal
          isOpen={showCommandPalette}
          onClose={() => setShowCommandPalette(false)}
        />
      )}

      {/* Floating On-Screen HUD Overlay for Volume & Seeking */}
      <PlayerHudOverlay />

      {/* Share Song Story Card Modal */}
      {showShareModal && (
        <ShareSongModal
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          song={currentSong}
        />
      )}
    </>
  );
};
