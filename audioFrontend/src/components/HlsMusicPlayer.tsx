"use client";

import React, { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { useStore } from "@tanstack/react-store";
import { playerStore, playerActions } from "../store/player.store";
import { getImageUrl } from "../lib/image-utils";
import { getFullVideoHlsUrl, getFullVideoDashUrl } from "../lib/player-utils";
import { getSolidBgFromImage } from "../lib/color-utils";

// Lazy-loaded Modals for Bundle Optimization
const PlaylistPickerModal = dynamic(
  () => import("./PlaylistPickerModal").then((m) => m.PlaylistPickerModal),
  { ssr: false },
);
const FullVideoModal = dynamic(
  () => import("./FullVideoModal").then((m) => m.FullVideoModal),
  { ssr: false },
);
const SleepTimerModal = dynamic(
  () => import("./player/SleepTimerModal").then((m) => m.SleepTimerModal),
  { ssr: false },
);
const EqualizerModal = dynamic(
  () => import("./player/EqualizerModal").then((m) => m.EqualizerModal),
  { ssr: false },
);
const KeyboardShortcutsModal = dynamic(
  () =>
    import("./player/KeyboardShortcutsModal").then(
      (m) => m.KeyboardShortcutsModal,
    ),
  { ssr: false },
);
const CommandPaletteModal = dynamic(
  () => import("./CommandPaletteModal").then((m) => m.CommandPaletteModal),
  { ssr: false },
);
const ShareSongModal = dynamic(
  () => import("./ShareSongModal").then((m) => m.ShareSongModal),
  { ssr: false },
);
const PlayerQueuePanel = dynamic(
  () => import("./player/PlayerQueuePanel").then((m) => m.PlayerQueuePanel),
  { ssr: false },
);

// Non-lazy Subcomponents & Overlays
import { PlayerHudOverlay } from "./player/PlayerHudOverlay";
import { PlayerLyricsView } from "./player/PlayerLyricsView";
import { PlayerTrackCard } from "./player/PlayerTrackCard";
import { PlayerControlButtons } from "./player/PlayerControlButtons";
import { PlayerProgressBar } from "./player/PlayerProgressBar";
import { PlayerRightControls } from "./player/PlayerRightControls";
import { ZenFocusOverlay } from "./player/ZenFocusOverlay";

import { toast } from "sonner";

// Hooks
import { useHlsPlayer } from "./player/hooks/useHlsPlayer";
import { useLyrics } from "./player/hooks/useLyrics";
import { useAudioSync } from "./player/hooks/useAudioSync";
import { useWebAudio } from "./player/hooks/useWebAudio";
import { useNextTrackPreloader } from "./player/hooks/useNextTrackPreloader";
import { usePlayerShortcuts } from "./player/hooks/usePlayerShortcuts";
import { useMediaSession } from "./player/hooks/useMediaSession";

export function HlsMusicPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const standbyAudioRef = useRef<HTMLAudioElement>(null);
  const state = useStore(playerStore, (s) => s);
  const {
    currentSong,
    isPlaying,
    volume,
    isMuted,
    duration,
    repeatMode,
    isShuffle,
    qualityTracks,
    selectedQuality,
    isLyricsOpen,
    isVideoActive,
  } = state;

  const [localTime, setLocalTime] = useState(() => state.currentTime || 0);
  const [buffered, setBuffered] = useState(0);
  const [showQueuePanel, setShowQueuePanel] = useState(false);
  const [showEqualizerModal, setShowEqualizerModal] = useState(false);
  const [showSleepTimerModal, setShowSleepTimerModal] = useState(false);
  const [isPlaylistModalOpen, setIsPlaylistModalOpen] = useState(false);
  const [solidBgColor, setSolidBgColor] = useState("#1e3a8a");
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  // Compute solid color matching current song image
  useEffect(() => {
    if (!currentSong) return;
    const rawImageKey =
      currentSong.imageKey || (currentSong as any).coverImageKey;
    const url = rawImageKey
      ? getImageUrl(rawImageKey, {
          width: 120,
          height: 120,
          aspectRatio: "1-1",
        })
      : currentSong.coverUrl || currentSong.posterUrl;
    const fallbackKey = `${currentSong.title}-${currentSong.artistName}-${currentSong.id}`;
    getSolidBgFromImage(url, fallbackKey).then((color) => {
      if (color) {
        setSolidBgColor(color);
        playerActions.setDominantColor(color);
      }
    });
  }, [
    currentSong?.id,
    currentSong?.title,
    currentSong?.artistName,
    currentSong?.imageKey,
    (currentSong as any)?.coverImageKey,
    currentSong?.posterUrl,
    currentSong?.coverUrl,
  ]);

  // Initialize Player State & hydrate saved time
  useEffect(() => {
    playerActions.hydrate();
    playerActions.initQueue();
    if (typeof window !== "undefined") {
      const savedTime = localStorage.getItem("last_current_time");
      if (savedTime) {
        const t = parseFloat(savedTime);
        if (!isNaN(t) && t > 0) {
          setLocalTime(t);
        }
      }
    }
  }, []);

  // HLS Audio Player Engine
  const { isInternalChange } = useHlsPlayer(
    audioRef.current,
    currentSong?.id,
    currentSong?.streamUrl,
    isPlaying,
    selectedQuality,
  );

  // Synced Lyrics Loader
  const { currentCaption, transcriptions, plainLyrics, isLoading: isLyricsLoading } = useLyrics(
    currentSong?.lrclibId || currentSong?.captionUrl,
    localTime,
  );

  // Web Audio EQ Graph
  const webAudio = useWebAudio(audioRef.current, isPlaying);

  // Sleep Timer countdown check with gradual volume fade-out
  const isSleepFadingRef = useRef(false);
  useEffect(() => {
    if (!state.sleepTimer?.targetTimestamp || state.sleepTimer.mode !== "minutes") {
      if (isSleepFadingRef.current) {
        webAudio.setGainImmediate(1);
        isSleepFadingRef.current = false;
      }
      return;
    }

    const checkTimer = () => {
      const now = Date.now();
      const target = state.sleepTimer?.targetTimestamp;
      if (!target) return;

      const remainingMs = target - now;

      // Start gentle fade-out in the last 15 seconds
      if (remainingMs <= 15000 && remainingMs > 0 && !isSleepFadingRef.current) {
        isSleepFadingRef.current = true;
        const remainingSec = Math.max(0.5, remainingMs / 1000);
        webAudio.fadeTo(0, remainingSec);
      }

      if (remainingMs <= 0) {
        playerActions.setIsPlaying(false);
        playerActions.clearSleepTimer();
        webAudio.setGainImmediate(1);
        isSleepFadingRef.current = false;
        toast("Sleep timer finished", {
          description: "Playback smoothly stopped. Sweet dreams!",
          icon: "🌙",
        });
      }
    };

    const interval = setInterval(checkTimer, 1000);
    checkTimer();

    return () => {
      clearInterval(interval);
      if (isSleepFadingRef.current) {
        webAudio.setGainImmediate(1);
        isSleepFadingRef.current = false;
      }
    };
  }, [state.sleepTimer?.targetTimestamp, state.sleepTimer?.mode, webAudio.fadeTo, webAudio.setGainImmediate]);

  // Next-Track Pre-buffering & Gapless Engine
  useNextTrackPreloader(standbyAudioRef.current);

  // MediaSession API Integration (Lockscreen, Control Center & Notification Controls)
  useMediaSession({
    currentSong,
    isPlaying,
    currentTime: localTime,
    duration,
    playbackRate: state.playbackRate,
    audioElement: audioRef.current,
    setLocalTime,
  });

  // Audio Progress & Crossfade Synchronizer
  useAudioSync(
    audioRef.current,
    isInternalChange,
    currentSong,
    isPlaying,
    volume,
    isMuted,
    duration,
    isVideoActive,
    setLocalTime,
    setBuffered,
    webAudio.fadeIn,
    webAudio.fadeOut,
    webAudio.crossfadeDuration,
    webAudio.fadeTo,
    webAudio.setGainImmediate,
  );

  // Sync store currentTime resets or explicit seekTarget requests
  const storeCurrentTime = useStore(playerStore, (s) => s.currentTime);
  const seekTarget = useStore(playerStore, (s) => s.seekTarget);
  const prevIsVideoActiveRef = useRef(isVideoActive);

  useEffect(() => {
    if (isVideoActive) {
      setLocalTime(storeCurrentTime);
    }
  }, [isVideoActive, storeCurrentTime]);

  useEffect(() => {
    const wasVideoActive = prevIsVideoActiveRef.current;
    prevIsVideoActiveRef.current = isVideoActive;

    if (isVideoActive || !audioRef.current) return;

    if (wasVideoActive) {
      const targetTime = seekTarget !== null && isFinite(seekTarget) ? seekTarget : storeCurrentTime;
      if (typeof targetTime === "number" && isFinite(targetTime) && targetTime >= 0) {
        audioRef.current.currentTime = targetTime;
        setLocalTime(targetTime);
        if (seekTarget !== null) {
          playerActions.setSeekTarget(null);
        }
      }
      return;
    }

    if (seekTarget !== null && isFinite(seekTarget) && seekTarget >= 0) {
      audioRef.current.currentTime = seekTarget;
      setLocalTime(seekTarget);
      playerActions.setSeekTarget(null);
    } else if (storeCurrentTime === 0 && audioRef.current.currentTime > 1) {
      audioRef.current.currentTime = 0;
      setLocalTime(0);
    }
  }, [storeCurrentTime, seekTarget, isVideoActive]);

  // Global Keyboard Shortcuts
  usePlayerShortcuts({
    audioElement: audioRef.current,
    currentSong: currentSong || null,
    isPlaying,
    isVideoActive,
    isMuted,
    isLyricsOpen,
    duration,
    volume,
    setLocalTime,
    setShowQueuePanel,
    setShowEqualizerModal,
    setShowShortcutsModal,
    setShowCommandPalette,
  });

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.currentTarget.value);
    setLocalTime(val);
    if (!audioRef.current || !duration) return;
    audioRef.current.currentTime = val;
    playerActions.setCurrentTime(val);
    if (typeof window !== "undefined") {
      localStorage.setItem("last_current_time", val.toFixed(2));
    }
  };

  if (!currentSong) return null;

  const posterUrl = currentSong.imageKey
    ? getImageUrl(currentSong.imageKey, { width: 140, height: 140, aspectRatio: "1-1" })
    : currentSong.posterUrl || "";

  return (
    <>
      <audio ref={audioRef} crossOrigin="anonymous" preload="auto" className="hidden" />
      <audio
        ref={standbyAudioRef}
        crossOrigin="anonymous"
        preload="auto"
        className="hidden"
        aria-hidden="true"
      />

      {/* Spotify Synced Lyrics Overlay View */}
      {isLyricsOpen && (
        <PlayerLyricsView
          currentSong={currentSong}
          solidBgColor={solidBgColor}
          currentCaption={currentCaption}
          displayTranscriptions={transcriptions || []}
          displayPlainLyrics={plainLyrics}
          localTime={localTime}
          analyser={webAudio.analyser}
          isLyricsLoading={isLyricsLoading}
          onSeek={(time) => {
            if (audioRef.current) {
              audioRef.current.currentTime = time;
              setLocalTime(time);
            }
          }}
        />
      )}

      {/* Full-Screen Zen Focus Mode */}
      {state.isZenMode && (
        <ZenFocusOverlay
          analyser={webAudio.analyser}
          currentTime={localTime}
          duration={duration}
          solidBgColor={solidBgColor}
          transcriptions={transcriptions}
          plainLyrics={plainLyrics}
          isLoading={isLyricsLoading}
          buffered={buffered}
          onSeek={(time) => {
            if (audioRef.current) {
              audioRef.current.currentTime = time;
              setLocalTime(time);
            }
          }}
        />
      )}

      {/* Multi-layered Atmospheric Dynamic Ambient Glow */}
      <div
        aria-hidden="true"
        className="fixed inset-0 pointer-events-none z-0 overflow-hidden"
      >
        <div
          style={{
            background: `radial-gradient(ellipse 65% 50% at 50% 10%, ${solidBgColor}28 0%, ${solidBgColor}0a 45%, transparent 80%)`,
          }}
          className={`absolute top-0 left-0 right-0 h-[450px] transition-all duration-1000 ease-out blur-3xl ${
            isPlaying ? "opacity-100 scale-105" : "opacity-35 scale-100"
          }`}
        />
        <div
          style={{
            background: `radial-gradient(ellipse 85% 140px at 50% 100%, ${solidBgColor}66 0%, ${solidBgColor}22 55%, transparent 85%)`,
          }}
          className={`absolute bottom-20 left-0 right-0 h-36 transition-all duration-700 ease-out blur-2xl ${
            isPlaying ? "opacity-90 scale-100" : "opacity-35 scale-95"
          }`}
        />
      </div>

      {/* Spotify Bottom Persistent Audio Player Bar */}
      <footer className="fixed bottom-0 left-0 right-0 h-20 bg-black/95 backdrop-blur-md  z-50 px-3 sm:px-4 md:px-6 flex items-center justify-between select-none">
        {/* Left Section: Track Info & Quick Actions */}
        <PlayerTrackCard currentSong={currentSong} posterUrl={posterUrl} />

        {/* Middle Section: Player Controls & Timeline */}
        <div className="flex flex-col items-center justify-center flex-1 max-w-xl px-2 sm:px-4 space-y-1">
          <PlayerControlButtons
            isPlaying={isPlaying}
            isShuffle={isShuffle}
            repeatMode={repeatMode}
            isVideoActive={isVideoActive}
            audioElement={audioRef.current}
          />
          <div className="w-full max-w-lg">
            <PlayerProgressBar
              currentTime={localTime}
              duration={duration}
              bufferedTime={buffered}
              onChange={handleSeekChange}
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
          sleepTimerMode={state.sleepTimer?.mode}
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
          onOpenShare={() => setShowShareModal(true)}
        />
      </footer>

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
      {state.isFullVideoOpen && (currentSong.fullVideoKey || (currentSong as any).full_video_key) && (
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
}
