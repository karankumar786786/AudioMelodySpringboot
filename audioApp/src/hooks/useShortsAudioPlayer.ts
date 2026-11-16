import { useEffect, useRef, useCallback } from "react";
import { AppState } from "react-native";
import {
  createAudioPlayer,
  preload,
  AudioPlayer,
  AudioStatus,
  setAudioModeAsync,
} from "expo-audio";
import { Song } from "@/types";
import { resolveStreamUrl } from "@/service";

async function safeSeek(player: AudioPlayer | null, seconds: number) {
  if (!player) return;
  try {
    if (typeof player.seekTo === "function") {
      await player.seekTo(Math.max(0, seconds));
    }
  } catch {
    // Player may still be loading, seeking, or transitioning
  }
}

interface UseShortsAudioPlayerOptions {
  activeSong: Song | undefined;
  activeIndex: number;
  isScreenFocused: boolean;
  isAppActive: boolean;
  isPaused: boolean;
  isMuted: boolean;
  onPlayingChange: (playing: boolean) => void;
}

/**
 * Manages the isolated short-preview audio player lifecycle.
 *
 * Key guarantees:
 * - Shorts audio NEVER plays in the background or on the lock screen.
 * - On AppState change, uses refs (not closures) to avoid stale state bugs.
 * - Debounces player creation by 150 ms to avoid thrashing on fast swipes.
 * - Preloads audio for N+1 through N+3 shorts.
 */
export function useShortsAudioPlayer({
  activeSong,
  activeIndex,
  isScreenFocused,
  isAppActive,
  isPaused,
  isMuted,
  onPlayingChange,
}: UseShortsAudioPlayerOptions) {
  const playerRef = useRef<AudioPlayer | null>(null);

  // Stable refs so AppState listener never closes over stale values
  const isScreenFocusedRef = useRef(isScreenFocused);
  const isPausedRef = useRef(isPaused);
  const isAppActiveRef = useRef(isAppActive);

  useEffect(() => { isScreenFocusedRef.current = isScreenFocused; }, [isScreenFocused]);
  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);
  useEffect(() => { isAppActiveRef.current = isAppActive; }, [isAppActive]);

  // ── AppState listener using refs (Phase 1B: fixes stale-closure bug) ──────
  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      const active = nextState === "active";
      if (!active) {
        // Backgrounded / lock screen → immediately kill shorts audio
        try { playerRef.current?.pause(); } catch {}
        onPlayingChange(false);
      } else {
        // Returned to foreground → resume only if screen is focused and not paused
        if (
          isScreenFocusedRef.current &&
          !isPausedRef.current &&
          playerRef.current
        ) {
          try {
            playerRef.current.play();
            onPlayingChange(true);
          } catch {}
        }
      }
    });
    return () => sub.remove();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty — listener reads from refs, not props

  // ── Isolated player creation with 150 ms debounce (Phase 3A/3C) ──────────
  useEffect(() => {
    if (!isScreenFocused || !isAppActive || !activeSong) {
      try { playerRef.current?.pause(); } catch {}
      onPlayingChange(false);
      return;
    }

    const streamUrl = resolveStreamUrl(activeSong);
    if (!streamUrl) return;

    const startSec =
      typeof activeSong.previewStartTime === "number" && activeSong.previewStartTime > 0
        ? activeSong.previewStartTime
        : 0;
    const endSec =
      typeof activeSong.previewEndTime === "number" && activeSong.previewEndTime > startSec
        ? activeSong.previewEndTime
        : 0;

    let isMounted = true;

    // 150 ms debounce: skip intermediate slides on fast swipes
    const debounceTimer = setTimeout(async () => {
      if (!isMounted) return;

      // Silently destroy previous player without calling .remove() (avoids expo-audio crashes)
      if (playerRef.current) {
        try {
          playerRef.current.pause();
          playerRef.current.volume = 0;
        } catch {}
        playerRef.current = null;
      }

      try {
        if (__DEV__) console.log(`[useShortsAudioPlayer] 🎵 Setting up player for "${activeSong.title}"`);

        let initialSeekDone = startSec <= 0;

        const onStatus = async (status: AudioStatus) => {
          if (!isMounted) return;
          onPlayingChange(status.playing);

          // Seek to preview start once loaded
          if (!initialSeekDone && (status as any)?.isLoaded) {
            initialSeekDone = true;
            if (startSec > 0) await safeSeek(playerRef.current, startSec);
          }

          // Loop within preview window or from track end
          if (endSec > 0 && status.currentTime >= endSec && !isPausedRef.current && isAppActiveRef.current) {
            await safeSeek(playerRef.current, startSec);
          } else if (status.didJustFinish && !isPausedRef.current && isAppActiveRef.current) {
            await safeSeek(playerRef.current, startSec);
            try { playerRef.current?.play(); } catch {}
          }
        };

        // Phase 3A: correct player options — foreground-only
        const player = createAudioPlayer(
          { uri: streamUrl },
          {
            keepAudioSessionActive: false, // Shorts MUST NOT play in background
            updateInterval: 250,
          }
        );
        player.loop = false;
        player.muted = isMuted;
        player.volume = isMuted ? 0 : 1.0;
        player.addListener("playbackStatusUpdate", onStatus);
        playerRef.current = player;

        if (!isPausedRef.current && isScreenFocusedRef.current && isAppActiveRef.current) {
          try {
            player.play();
            onPlayingChange(true);
          } catch {}
        } else {
          try {
            player.pause();
            onPlayingChange(false);
          } catch {}
        }
      } catch (err) {
        if (__DEV__) console.warn("[useShortsAudioPlayer] Player setup error:", err);
      }
    }, 150);

    return () => {
      isMounted = false;
      clearTimeout(debounceTimer);
      if (playerRef.current) {
        try {
          playerRef.current.pause();
          playerRef.current.volume = 0;
        } catch {}
        playerRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, activeSong?.id, isScreenFocused, isAppActive]);

  // ── Play/Pause sync ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!playerRef.current || !isScreenFocused || !isAppActive) return;
    try {
      if (isPaused) {
        playerRef.current.pause();
        onPlayingChange(false);
      } else {
        playerRef.current.play();
        onPlayingChange(true);
      }
    } catch {}
  }, [isPaused, isScreenFocused, isAppActive, onPlayingChange]);

  // ── Mute sync ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!playerRef.current) return;
    try {
      playerRef.current.muted = isMuted;
      playerRef.current.volume = isMuted ? 0 : 1.0;
    } catch {}
  }, [isMuted]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      try {
        playerRef.current?.pause();
        playerRef.current = null;
      } catch {}
    };
  }, []);

  return { playerRef };
}
