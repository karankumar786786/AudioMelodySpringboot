"use client";

import { useEffect, useRef } from "react";
import { playerActions } from "@/store/player.store";
import { getImageUrl } from "@/lib/image-utils";
import type { PlayerSong } from "@/lib/player-utils";

interface UseMediaSessionProps {
  currentSong: PlayerSong | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackRate?: number;
  audioElement: HTMLAudioElement | null;
  setLocalTime: (time: number) => void;
}

export function useMediaSession({
  currentSong,
  isPlaying,
  currentTime,
  duration,
  playbackRate = 1,
  audioElement,
  setLocalTime,
}: UseMediaSessionProps) {
  const latestPropsRef = useRef({
    currentSong,
    isPlaying,
    currentTime,
    duration,
    playbackRate,
    audioElement,
    setLocalTime,
  });

  useEffect(() => {
    latestPropsRef.current = {
      currentSong,
      isPlaying,
      currentTime,
      duration,
      playbackRate,
      audioElement,
      setLocalTime,
    };
  });

  // 1. Update Media Metadata when current song changes
  useEffect(() => {
    if (typeof window === "undefined" || !("mediaSession" in navigator)) return;

    if (!currentSong) {
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = "none";
      return;
    }

    const title = currentSong.title || "Audio Track";
    const artist = currentSong.artistName || (currentSong as any).artist || "Unknown Artist";
    const album = (currentSong as any).albumName || (currentSong as any).album || "AudioMelody";

    const artworkSizes = [96, 128, 192, 256, 384, 512];
    const artwork: MediaImage[] = [];

    for (const size of artworkSizes) {
      const src = currentSong.imageKey
        ? getImageUrl(currentSong.imageKey, {
            width: size,
            height: size,
            aspectRatio: "1-1",
          })
        : currentSong.posterUrl || "";

      if (src) {
        artwork.push({
          src,
          sizes: `${size}x${size}`,
          type: "image/jpeg",
        });
      }
    }

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title,
        artist,
        album,
        artwork,
      });
    } catch (err) {
      console.warn("[MediaSession] Failed to set metadata:", err);
    }
  }, [currentSong?.id, currentSong?.title, currentSong?.artistName, currentSong?.imageKey, currentSong?.posterUrl]);

  // 2. Synchronize Playback State
  useEffect(() => {
    if (typeof window === "undefined" || !("mediaSession" in navigator)) return;

    if (!currentSong) {
      navigator.mediaSession.playbackState = "none";
    } else {
      navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
    }
  }, [isPlaying, currentSong]);

  // 3. Synchronize Position State (Timeline / Progress on Lock Screen)
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("mediaSession" in navigator) ||
      typeof navigator.mediaSession.setPositionState !== "function"
    ) {
      return;
    }

    if (!currentSong || !duration || !isFinite(duration) || duration <= 0) {
      return;
    }

    const safePosition = Math.max(0, Math.min(duration, isFinite(currentTime) ? currentTime : 0));

    try {
      navigator.mediaSession.setPositionState({
        duration: Math.max(0.1, duration),
        playbackRate: Math.max(0.25, Math.min(4, playbackRate)),
        position: safePosition,
      });
    } catch {
      // Ignored: browser may throw if timestamp slightly exceeds duration
    }
  }, [currentTime, duration, playbackRate, currentSong]);

  // 4. Register Media Session Action Handlers
  useEffect(() => {
    if (typeof window === "undefined" || !("mediaSession" in navigator)) return;

    const actionHandlers: [MediaSessionAction, MediaSessionActionHandler | null][] = [
      [
        "play",
        () => {
          playerActions.setIsPlaying(true);
        },
      ],
      [
        "pause",
        () => {
          playerActions.setIsPlaying(false);
        },
      ],
      [
        "previoustrack",
        () => {
          playerActions.previous();
        },
      ],
      [
        "nexttrack",
        () => {
          playerActions.next();
        },
      ],
      [
        "seekto",
        (details) => {
          if (details.seekTime !== undefined && isFinite(details.seekTime)) {
            const target = details.seekTime;
            const audio = latestPropsRef.current.audioElement;
            if (audio) {
              audio.currentTime = target;
            }
            latestPropsRef.current.setLocalTime(target);
            playerActions.setCurrentTime(target);
            playerActions.setSeekTarget(target);
          }
        },
      ],
      [
        "seekbackward",
        (details) => {
          const offset = details.seekOffset || 10;
          const audio = latestPropsRef.current.audioElement;
          const current = audio?.currentTime ?? latestPropsRef.current.currentTime;
          const target = Math.max(0, current - offset);
          if (audio) {
            audio.currentTime = target;
          }
          latestPropsRef.current.setLocalTime(target);
          playerActions.setCurrentTime(target);
          playerActions.setSeekTarget(target);
        },
      ],
      [
        "seekforward",
        (details) => {
          const offset = details.seekOffset || 10;
          const audio = latestPropsRef.current.audioElement;
          const dur = latestPropsRef.current.duration || audio?.duration || 0;
          const current = audio?.currentTime ?? latestPropsRef.current.currentTime;
          const target = Math.min(dur, current + offset);
          if (audio) {
            audio.currentTime = target;
          }
          latestPropsRef.current.setLocalTime(target);
          playerActions.setCurrentTime(target);
          playerActions.setSeekTarget(target);
        },
      ],
      [
        "stop",
        () => {
          playerActions.setIsPlaying(false);
          const audio = latestPropsRef.current.audioElement;
          if (audio) {
            audio.pause();
          }
        },
      ],
    ];

    actionHandlers.forEach(([action, handler]) => {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        // Some actions might not be supported in certain browsers
      }
    });

    return () => {
      actionHandlers.forEach(([action]) => {
        try {
          navigator.mediaSession.setActionHandler(action, null);
        } catch {
          // Ignore
        }
      });
    };
  }, []);
}
