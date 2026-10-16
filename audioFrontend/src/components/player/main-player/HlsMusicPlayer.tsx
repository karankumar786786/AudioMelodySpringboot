"use client";

import React, { useState, useEffect, useRef } from "react";
import { useStore } from "@tanstack/react-store";
import { playerStore, playerActions } from "@/store/player.store";
import { getImageUrl } from "@/lib/image-utils";
import { getSolidBgFromImage } from "@/lib/color-utils";
import { toast } from "sonner";

// Overlays
import { PlayerLyricsView } from "../PlayerLyricsView";
import { ZenFocusOverlay } from "../ZenFocusOverlay";

// Main Player Submodules
import { PlayerAmbientGlow } from "./PlayerAmbientGlow";
import { PlayerFooterDock } from "./PlayerFooterDock";
import { PlayerModalsPortal } from "./PlayerModalsPortal";

// Hooks
import { useHlsPlayer } from "../hooks/useHlsPlayer";
import { useLyrics } from "../hooks/useLyrics";
import { useAudioSync } from "../hooks/useAudioSync";
import { useWebAudio } from "../hooks/useWebAudio";
import { useNextTrackPreloader } from "../hooks/useNextTrackPreloader";
import { usePlayerShortcuts } from "../hooks/usePlayerShortcuts";
import { useMediaSession } from "../hooks/useMediaSession";

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

  // Synchronize lyrics availability to playerStore to enable/disable Zen Focus Mode
  useEffect(() => {
    if (!currentSong) {
      playerActions.setHasLyrics(false);
      return;
    }
    if (!isLyricsLoading) {
      const hasAvailableLyrics = transcriptions.length > 0 || Boolean(plainLyrics);
      playerActions.setHasLyrics(hasAvailableLyrics);
    }
  }, [currentSong?.id, isLyricsLoading, transcriptions.length, plainLyrics]);

  // Auto-close Full Video if current track does not have a video available
  useEffect(() => {
    if (state.isFullVideoOpen && currentSong) {
      const hasVideo = Boolean(currentSong.fullVideoKey || (currentSong as any).full_video_key);
      if (!hasVideo) {
        playerActions.closeFullVideo();
        toast.info("Video closed", {
          description: "Music video is not available for this track.",
        });
      }
    }
  }, [currentSong?.id, state.isFullVideoOpen]);

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
    : (currentSong as any).posterUrl || "";

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
      <PlayerAmbientGlow solidBgColor={solidBgColor} isPlaying={isPlaying} />

      {/* Spotify Bottom Persistent Audio Player Bar */}
      <PlayerFooterDock
        currentSong={currentSong}
        posterUrl={posterUrl}
        isPlaying={isPlaying}
        isShuffle={isShuffle}
        repeatMode={repeatMode}
        isVideoActive={isVideoActive}
        audioElement={audioRef.current}
        localTime={localTime}
        duration={duration}
        buffered={buffered}
        onSeekChange={handleSeekChange}
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
        webAudio={webAudio}
        onOpenShare={() => setShowShareModal(true)}
      />

      {/* All Secondary Modals & Drawers */}
      <PlayerModalsPortal
        currentSong={currentSong}
        isPlaying={isPlaying}
        isFullVideoOpen={state.isFullVideoOpen}
        showEqualizerModal={showEqualizerModal}
        setShowEqualizerModal={setShowEqualizerModal}
        showSleepTimerModal={showSleepTimerModal}
        setShowSleepTimerModal={setShowSleepTimerModal}
        showShortcutsModal={showShortcutsModal}
        setShowShortcutsModal={setShowShortcutsModal}
        isPlaylistModalOpen={isPlaylistModalOpen}
        setIsPlaylistModalOpen={setIsPlaylistModalOpen}
        showQueuePanel={showQueuePanel}
        setShowQueuePanel={setShowQueuePanel}
        showCommandPalette={showCommandPalette}
        setShowCommandPalette={setShowCommandPalette}
        showShareModal={showShareModal}
        setShowShareModal={setShowShareModal}
        webAudio={webAudio}
      />
    </>
  );
}
