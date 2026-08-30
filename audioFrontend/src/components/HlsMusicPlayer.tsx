"use client";

import React, { useState, useEffect, useRef } from "react";
import { useStore } from "@tanstack/react-store";
import { playerStore, playerActions } from "../store/player.store";
import {
  Music,
  Mic2,
  ListMusic,
  Shuffle,
  Repeat,
  Repeat1,
  VolumeX,
  Volume1,
  Volume2,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Sliders,
  X,
} from "lucide-react";
import { getImageUrl } from "../lib/image-utils";
import { PlaylistPickerModal } from "./PlaylistPickerModal";
import { toast } from "sonner";

// Hooks
import { useHlsPlayer } from "./player/hooks/useHlsPlayer";
import { useLyrics } from "./player/hooks/useLyrics";
import { useAudioSync } from "./player/hooks/useAudioSync";
import { useWebAudio } from "./player/hooks/useWebAudio";

// Components
import { PlayerLyricsOverlay } from "./player/PlayerLyricsOverlay";
import { PlayerProgressBar } from "./player/PlayerProgressBar";
import { PlayerQueuePanel } from "./player/PlayerQueuePanel";
import { PlayerQualitySelector } from "./player/PlayerQualitySelector";
import { EqualizerModal } from "./player/EqualizerModal";
import { PlayerTooltip } from "./player/PlayerTooltip";

import { getSolidBgFromImage } from "../lib/color-utils";

export function HlsMusicPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const state = useStore(playerStore, (s) => s);
  const {
    currentSong,
    isPlaying,
    volume,
    isMuted,
    duration,
    repeatMode,
    isShuffle,
    queue,
    qualityTracks,
    selectedQuality,
    favourites,
    systemUser,
    isLyricsOpen,
  } = state;

  const [localTime, setLocalTime] = useState(() => state.currentTime || 0);
  const [buffered, setBuffered] = useState(0);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [showQueuePanel, setShowQueuePanel] = useState(false);
  const [showEqualizerModal, setShowEqualizerModal] = useState(false);
  const [isPlaylistModalOpen, setIsPlaylistModalOpen] = useState(false);
  const [isTogglingFav, setIsTogglingFav] = useState(false);
  const [solidBgColor, setSolidBgColor] = useState("#181818");

  // Compute solid color matching current song image
  useEffect(() => {
    if (!currentSong) return;
    const url = currentSong.imageKey
      ? getImageUrl(currentSong.imageKey, { width: 100, height: 100, aspectRatio: "1-1" })
      : currentSong.posterUrl;
    const fallbackKey = `${currentSong.title}-${currentSong.artistName}-${currentSong.id}`;
    getSolidBgFromImage(url, fallbackKey).then((color) => {
      setSolidBgColor(color);
    });
  }, [currentSong?.id, currentSong?.title, currentSong?.artistName, currentSong?.imageKey, currentSong?.posterUrl]);

  // 1. Initialize Player State & hydrate saved time
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

  // 2. Custom Hooks for Logic
  const { isInternalChange } = useHlsPlayer(
    audioRef.current,
    currentSong?.id,
    currentSong?.streamUrl,
    isPlaying,
    selectedQuality,
  );

  const { currentCaption, transcriptions, plainLyrics } = useLyrics(
    currentSong?.lrclibId || currentSong?.captionUrl,
    localTime,
  );

  const webAudio = useWebAudio(audioRef.current, isPlaying);

  useAudioSync(
    audioRef.current,
    isInternalChange,
    currentSong,
    isPlaying,
    volume,
    isMuted,
    duration,
    setLocalTime,
    setBuffered,
    webAudio.fadeIn,
    webAudio.fadeOut,
    webAudio.crossfadeDuration,
  );

  // Sync store currentTime resets
  const storeCurrentTime = useStore(playerStore, (s) => s.currentTime);
  useEffect(() => {
    if (!audioRef.current) return;
    if (storeCurrentTime === 0 && audioRef.current.currentTime > 1) {
      audioRef.current.currentTime = 0;
      setLocalTime(0);
    }
  }, [storeCurrentTime, setLocalTime]);

  const isFavourite = currentSong
    ? Array.from(favourites).some((id) => String(id) === String(currentSong.id))
    : false;

  useEffect(() => {
    if (systemUser?.id) {
      playerActions.fetchFavourites();
    }
  }, [systemUser?.id]);

  // 3. Global Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        (activeEl as HTMLElement)?.isContentEditable;

      if (isInput) return;

      // Space or K: Toggle Play/Pause
      if (e.code === "Space" || e.key === "k" || e.key === "K") {
        e.preventDefault();
        if (!currentSong) return;
        const audio = audioRef.current;
        if (audio) {
          if (isPlaying) {
            audio.pause();
          } else {
            audio.play().catch((err) => {
              if (err.name !== "AbortError")
                console.warn("[Player] Manual play failed:", err);
            });
          }
        }
        playerActions.setIsPlaying(!isPlaying);
      }

      // M: Toggle Mute
      if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        playerActions.setIsMuted(!isMuted);
      }

      // L: Toggle Lyrics
      if (e.key === "l" || e.key === "L") {
        e.preventDefault();
        playerActions.toggleLyrics();
      }

      // Q: Toggle Queue
      if (e.key === "q" || e.key === "Q") {
        e.preventDefault();
        setShowQueuePanel((v) => !v);
      }

      // E: Toggle Equalizer
      if (e.key === "e" || e.key === "E") {
        e.preventDefault();
        setShowEqualizerModal((v) => !v);
      }

      // R: Resync Lyrics
      if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        const el = document.getElementById("active-lyric-line");
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          toast.success("Lyrics synced to playback");
        } else if (isLyricsOpen) {
          toast.info("No active lyric line at this timestamp");
        }
      }

      // ArrowRight (Ctrl/Cmd): Next Track
      if (e.key === "ArrowRight" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        playerActions.next();
      }

      // ArrowLeft (Ctrl/Cmd): Previous Track
      if (e.key === "ArrowLeft" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        playerActions.previous();
      }

      // ArrowRight: Forward 10 seconds
      if (e.key === "ArrowRight" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        if (audioRef.current) {
          const maxDur = duration || audioRef.current.duration || 0;
          const nextTime =
            maxDur > 0
              ? Math.min(maxDur, audioRef.current.currentTime + 10)
              : audioRef.current.currentTime + 10;
          audioRef.current.currentTime = nextTime;
          setLocalTime(nextTime);
          playerActions.setCurrentTime(nextTime);
          if (typeof window !== "undefined") {
            localStorage.setItem("last_current_time", nextTime.toFixed(2));
          }
        }
      }

      // ArrowLeft: Rewind 10 seconds
      if (e.key === "ArrowLeft" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        if (audioRef.current) {
          const prevTime = Math.max(0, audioRef.current.currentTime - 10);
          audioRef.current.currentTime = prevTime;
          setLocalTime(prevTime);
          playerActions.setCurrentTime(prevTime);
          if (typeof window !== "undefined") {
            localStorage.setItem("last_current_time", prevTime.toFixed(2));
          }
        }
      }

      // ArrowUp: Increase Volume
      if (e.key === "ArrowUp" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        playerActions.setVolume(Math.min(1, volume + 0.05));
      }

      // ArrowDown: Decrease Volume
      if (e.key === "ArrowDown" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        playerActions.setVolume(Math.max(0, volume - 0.05));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentSong, isPlaying, isMuted, volume, duration, isLyricsOpen]);


  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current || !duration) return;
    const val = parseFloat(e.target.value);
    audioRef.current.currentTime = val;
    setLocalTime(val);
    playerActions.setCurrentTime(val);
    if (typeof window !== "undefined") {
      localStorage.setItem("last_current_time", val.toFixed(2));
    }
  };

  const handleVolumeChange = (e: React.FormEvent<HTMLInputElement>) => {
    playerActions.setVolume(parseFloat(e.currentTarget.value));
  };

  const VolumeIcon = isMuted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;
  const volumePct = isMuted ? 0 : volume * 100;

  if (!currentSong) return null;

  const posterUrl = currentSong.imageKey
    ? getImageUrl(currentSong.imageKey, { width: 140, height: 140, aspectRatio: "1-1" })
    : currentSong.posterUrl || "";

  return (
    <>
      <audio ref={audioRef} crossOrigin="anonymous" className="hidden" />

      {/* ─── Spotify Synced Lyrics View (Middle Portion Overlay) ─── */}
      {isLyricsOpen && (
        <div
          style={{ backgroundColor: solidBgColor }}
          className="fixed left-[260px] right-80 top-0 bottom-20 z-40 flex flex-col p-6 overflow-y-auto no-scrollbar animate-in fade-in duration-300 transition-colors duration-500"
        >
          {/* Header pinned at top */}
          <div className="sticky top-0 z-50 flex items-center justify-between pb-4 border-b border-[#282828] bg-inherit backdrop-blur-md shrink-0 pt-2">
            <div className="flex items-center gap-3">
              <Mic2 className="text-primary" size={20} />
              <div>
                <h2 className="text-base font-bold text-white tracking-tight">
                  Lyrics
                </h2>
                <p className="text-xs text-zinc-400 font-medium">
                  {currentSong.title} • {currentSong.artistName}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <PlayerTooltip content="Sync lyrics to playback" shortcut="R">
                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById("active-lyric-line");
                    if (el) {
                      el.scrollIntoView({ behavior: "smooth", block: "center" });
                      toast.success("Lyrics synced");
                    }
                  }}
                  className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white text-black font-bold text-xs transition-all cursor-pointer shadow-md hover:scale-105 active:scale-95 border border-white/30"
                  aria-label="Sync lyrics to playback"
                >
                  <div className="flex items-end gap-[2px] h-3">
                    <span className="w-[2px] h-2.5 bg-black rounded-full" />
                    <span className="w-[2px] h-1.5 bg-black rounded-full" />
                    <span className="w-[2px] h-3 bg-black rounded-full" />
                    <span className="w-[2px] h-2 bg-black rounded-full" />
                  </div>
                  <span className="text-black font-bold text-xs tracking-tight">Sync</span>
                </button>
              </PlayerTooltip>
              <button
                type="button"
                onClick={() => playerActions.closeLyrics()}
                className="p-2 rounded-full text-zinc-300 hover:text-white hover:bg-[#282828] transition-colors cursor-pointer"
                title="Close Lyrics"
                aria-label="Close Lyrics"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          <div className="flex-1 flex items-center justify-center py-6">
            <PlayerLyricsOverlay
              currentCaption={currentCaption}
              transcriptions={transcriptions}
              plainLyrics={plainLyrics}
              localTime={localTime}
              analyser={webAudio.analyser}
              onSeek={(time) => {
                if (audioRef.current) {
                  audioRef.current.currentTime = time;
                  setLocalTime(time);
                }
              }}
            />
          </div>
        </div>
      )}

      {/* ─── Spotify Bottom Persistent Audio Player Bar ─── */}
      <footer className="fixed bottom-0 left-0 right-0 h-20 bg-black border-t border-[#282828] z-50 px-4 flex items-center justify-between select-none">
        {/* Left Section: Track Info & Quick Actions */}
        <div className="flex items-center gap-3 min-w-0 w-[30%] max-w-[320px]">
          <div className="w-14 h-14 shrink-0 rounded-md overflow-hidden bg-zinc-900 shadow-md">
            {posterUrl ? (
              <img src={posterUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-600">
                <Music size={20} />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-semibold text-white truncate hover:underline cursor-pointer">
              {currentSong.title}
            </h4>
            <p className="text-xs text-zinc-400 truncate hover:underline hover:text-white cursor-pointer mt-0.5 font-normal">
              {currentSong.artistName}
            </p>
          </div>
        </div>

        {/* Middle Section: Player Controls & Timeline */}
        <div className="flex flex-col items-center justify-center flex-1 max-w-xl px-4 space-y-1">
          <div className="flex items-center gap-5">
            <PlayerTooltip
              content={isShuffle ? "Disable shuffle" : "Enable shuffle"}
            >
              <button
                type="button"
                onClick={() => {
                  playerActions.toggleShuffle();
                  toast.success(isShuffle ? "Shuffle Off" : "Shuffle On");
                }}
                className={`relative flex flex-col items-center justify-center p-1.5 transition-colors cursor-pointer ${
                  isShuffle ? "text-primary" : "text-zinc-400 hover:text-white"
                }`}
                aria-label={isShuffle ? "Disable shuffle" : "Enable shuffle"}
              >
                <Shuffle size={16} />
                {isShuffle && (
                  <span className="absolute -bottom-0.5 w-1 h-1 bg-primary rounded-full" />
                )}
              </button>
            </PlayerTooltip>

            <PlayerTooltip content="Previous track" shortcut={["Ctrl", "←"]}>
              <button
                type="button"
                onClick={() => playerActions.previous()}
                className="text-zinc-300 hover:text-white transition-colors cursor-pointer"
                aria-label="Previous track"
              >
                <SkipBack size={18} fill="currentColor" />
              </button>
            </PlayerTooltip>

            <PlayerTooltip
              content={isPlaying ? "Pause" : "Play"}
              shortcut="Space"
            >
              <button
                type="button"
                onClick={() => {
                  const audio = audioRef.current;
                  if (audio) {
                    if (isPlaying) {
                      audio.pause();
                    } else {
                      audio.play().catch((err) => {
                        if (err.name !== "AbortError")
                          console.warn("[Player] Manual play failed:", err);
                      });
                    }
                  }
                  playerActions.setIsPlaying(!isPlaying);
                }}
                className="w-9 h-9 rounded-full bg-white text-black hover:scale-105 flex items-center justify-center cursor-pointer transition-transform shadow-md"
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? (
                  <Pause size={18} fill="black" />
                ) : (
                  <Play size={18} fill="black" className="translate-x-0.5" />
                )}
              </button>
            </PlayerTooltip>

            <PlayerTooltip content="Next track" shortcut={["Ctrl", "→"]}>
              <button
                type="button"
                onClick={() => playerActions.next()}
                className="text-zinc-300 hover:text-white transition-colors cursor-pointer"
                aria-label="Next track"
              >
                <SkipForward size={18} fill="currentColor" />
              </button>
            </PlayerTooltip>

            <PlayerTooltip
              content={
                repeatMode === "none"
                  ? "Enable repeat"
                  : repeatMode === "all"
                    ? "Repeat one"
                    : "Disable repeat"
              }
            >
              <button
                type="button"
                onClick={() => {
                  playerActions.toggleRepeat();
                  const modes: Record<string, string> = {
                    none: "Repeat All",
                    all: "Repeat One",
                    one: "Repeat Off",
                  };
                  const next = modes[repeatMode] || "Repeat Off";
                  toast.success(next);
                }}
                className={`relative flex flex-col items-center justify-center p-1.5 transition-colors cursor-pointer ${
                  repeatMode !== "none"
                    ? "text-primary"
                    : "text-zinc-400 hover:text-white"
                }`}
                aria-label={`Repeat mode: ${repeatMode}`}
              >
                {repeatMode === "one" ? (
                  <Repeat1 size={16} />
                ) : (
                  <Repeat size={16} />
                )}
                {repeatMode !== "none" && (
                  <span className="absolute -bottom-0.5 w-1 h-1 bg-primary rounded-full" />
                )}
              </button>
            </PlayerTooltip>
          </div>

          {/* Timeline Bar */}
          <div className="w-full max-w-lg">
            <PlayerProgressBar
              currentTime={localTime}
              duration={duration}
              bufferedTime={buffered}
              onChange={handleSeekChange}
            />
          </div>
        </div>

        {/* Right Section: Equalizer, Lyrics, Queue, Quality, Volume */}
        <div className="flex items-center justify-end gap-2.5 w-[35%] max-w-[360px]">
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

          <PlayerTooltip content="Lyrics" shortcut="L">
            <button
              type="button"
              onClick={() => playerActions.toggleLyrics()}
              className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                isLyricsOpen ? "text-primary bg-[#282828]" : "text-zinc-400 hover:text-white"
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
                showQueuePanel ? "text-primary bg-[#282828]" : "text-zinc-400 hover:text-white"
              }`}
              aria-label="Queue"
            >
              <ListMusic size={16} />
            </button>
          </PlayerTooltip>

          <PlayerQualitySelector
            selectedQuality={selectedQuality}
            qualityTracks={qualityTracks}
            showQualityMenu={showQualityMenu}
            setShowQualityMenu={setShowQualityMenu}
            onSelectQuality={(q) => playerActions.setSelectedQuality(q)}
          />

          <div className="flex items-center gap-2.5 min-w-[110px]">
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
        </div>
      </footer>

      {/* Equalizer & Visualizer Modal */}
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

      {/* Playlist Picker Modal */}
      <PlaylistPickerModal
        isOpen={isPlaylistModalOpen}
        onClose={() => setIsPlaylistModalOpen(false)}
        songId={currentSong.id}
        songTitle={currentSong.title}
      />

      {/* Queue Drawer */}
      <PlayerQueuePanel
        open={showQueuePanel}
        onClose={() => setShowQueuePanel(false)}
      />
    </>
  );
}
