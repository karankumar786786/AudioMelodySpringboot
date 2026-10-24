"use client";

import React from "react";
import dynamic from "next/dynamic";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { closeModal } from "@/store/slices/uiSlice";
import { playerActions } from "@/store/player.store";
import { getImageUrl } from "@/lib/image-utils";
import { getFullVideoHlsUrl, getFullVideoDashUrl, type PlayerSong } from "@/lib/player-utils";
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

export interface PlayerModalsPortalProps {
  currentSong: PlayerSong;
  isPlaying: boolean;
  isFullVideoOpen?: boolean;
  showEqualizerModal?: boolean;
  setShowEqualizerModal?: (show: boolean) => void;
  showSleepTimerModal?: boolean;
  setShowSleepTimerModal?: (show: boolean) => void;
  showShortcutsModal?: boolean;
  setShowShortcutsModal?: (show: boolean) => void;
  isPlaylistModalOpen?: boolean;
  setIsPlaylistModalOpen?: (show: boolean) => void;
  showQueuePanel?: boolean;
  setShowQueuePanel?: (show: boolean) => void;
  showCommandPalette?: boolean;
  setShowCommandPalette?: (show: boolean) => void;
  showShareModal?: boolean;
  setShowShareModal?: (show: boolean) => void;
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
  isFullVideoOpen = false,
  webAudio,
}) => {
  const dispatch = useAppDispatch();
  const { activeModal, modalPayload } = useAppSelector((s) => s.ui);

  return (
    <>
      {/* Equalizer & Visualizer Modal */}
      {activeModal === "equalizer" && (
        <EqualizerModal
          isOpen={true}
          onClose={() => dispatch(closeModal())}
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
      {activeModal === "sleepTimer" && (
        <SleepTimerModal
          isOpen={true}
          onClose={() => dispatch(closeModal())}
        />
      )}

      {/* Keyboard Shortcuts Cheat-Sheet Modal */}
      {activeModal === "shortcuts" && (
        <KeyboardShortcutsModal
          isOpen={true}
          onClose={() => dispatch(closeModal())}
        />
      )}

      {/* Playlist Picker Modal */}
      {activeModal === "playlistPicker" && (
        <PlaylistPickerModal
          isOpen={true}
          onClose={() => dispatch(closeModal())}
          songId={modalPayload?.songId ?? currentSong.id}
          songTitle={modalPayload?.songTitle ?? currentSong.title}
        />
      )}

      {/* Full Video Modal */}
      {isFullVideoOpen && (currentSong.fullVideoKey || (currentSong as any).full_video_key) && (
        <FullVideoModal
          songId={currentSong.id}
          hlsUrl={getFullVideoHlsUrl(currentSong)!}
          dashUrl={getFullVideoDashUrl(currentSong)}
          title={currentSong.title}
          artistName={currentSong.artistName}
          posterUrl={getImageUrl(currentSong.imageKey, { width: 1280, height: 720, aspectRatio: "16-9" }) || undefined}
          onClose={() => playerActions.closeFullVideo()}
        />
      )}

      {/* Queue Drawer */}
      {activeModal === "queue" && (
        <PlayerQueuePanel
          open={true}
          onClose={() => dispatch(closeModal())}
        />
      )}

      {/* Quick Search Spotlight Command Palette */}
      {activeModal === "commandPalette" && (
        <CommandPaletteModal
          isOpen={true}
          onClose={() => dispatch(closeModal())}
        />
      )}

      {/* Floating On-Screen HUD Overlay for Volume & Seeking */}
      <PlayerHudOverlay />

      {/* Share Song Story Card Modal */}
      {activeModal === "shareSong" && (
        <ShareSongModal
          isOpen={true}
          onClose={() => dispatch(closeModal())}
          song={modalPayload?.song ?? currentSong}
        />
      )}
    </>
  );
};
