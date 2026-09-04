"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { playerActions, playerStore } from "@/store/player.store";
import { type PlayerSong } from "@/lib/player-utils";

interface UsePlayerShortcutsProps {
  audioElement: HTMLAudioElement | null;
  currentSong: PlayerSong | null;
  isPlaying: boolean;
  isVideoActive: boolean;
  isMuted: boolean;
  isLyricsOpen: boolean;
  duration: number;
  volume: number;
  setLocalTime: (t: number) => void;
  setShowQueuePanel: React.Dispatch<React.SetStateAction<boolean>>;
  setShowEqualizerModal: React.Dispatch<React.SetStateAction<boolean>>;
}

export function usePlayerShortcuts({
  audioElement,
  currentSong,
  isPlaying,
  isVideoActive,
  isMuted,
  isLyricsOpen,
  duration,
  volume,
  setLocalTime,
  setShowQueuePanel,
  setShowEqualizerModal,
}: UsePlayerShortcutsProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        (activeEl as HTMLElement)?.isContentEditable;

      if (isInput || playerStore.state.isFullVideoOpen) return;

      // Space or K: Toggle Play/Pause
      if (e.code === "Space" || e.key === "k" || e.key === "K") {
        e.preventDefault();
        if (!currentSong) return;
        if (!isVideoActive && audioElement) {
          if (isPlaying) {
            audioElement.pause();
          } else {
            audioElement.play().catch((err) => {
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
        window.dispatchEvent(new CustomEvent("lyrics-resync"));
        const el = document.getElementById("active-lyric-line");
        if (!el && isLyricsOpen) {
          toast.info("No active lyric line at this timestamp");
        }
      }

      // V: Open Full Video
      if (
        (e.key === "v" || e.key === "V") &&
        (currentSong?.fullVideoKey || (currentSong as any)?.full_video_key)
      ) {
        e.preventDefault();
        playerActions.openFullVideo();
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
        if (audioElement) {
          const maxDur = duration || audioElement.duration || 0;
          const nextTime =
            maxDur > 0
              ? Math.min(maxDur, audioElement.currentTime + 10)
              : audioElement.currentTime + 10;
          audioElement.currentTime = nextTime;
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
        if (audioElement) {
          const prevTime = Math.max(0, audioElement.currentTime - 10);
          audioElement.currentTime = prevTime;
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

      // 0-9: Seek to percentage (0% to 90%)
      if (/^[0-9]$/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        const percent = parseInt(e.key, 10) / 10;
        if (audioElement && duration > 0) {
          const targetTime = duration * percent;
          audioElement.currentTime = targetTime;
          setLocalTime(targetTime);
          playerActions.setCurrentTime(targetTime);
          if (typeof window !== "undefined") {
            localStorage.setItem("last_current_time", targetTime.toFixed(2));
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    audioElement,
    currentSong,
    isPlaying,
    isVideoActive,
    isMuted,
    isLyricsOpen,
    duration,
    volume,
    setLocalTime,
    setShowQueuePanel,
    setShowEqualizerModal,
  ]);
}
