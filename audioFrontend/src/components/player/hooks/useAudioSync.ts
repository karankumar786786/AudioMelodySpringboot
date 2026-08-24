import { useEffect, useRef, useCallback, MutableRefObject } from "react";
import { playerActions } from "../../../store/player.store";

export function useAudioSync(
  audioElement: HTMLAudioElement | null,
  isInternalChange: MutableRefObject<boolean>,
  currentSong: any,
  isPlaying: boolean,
  volume: number,
  isMuted: boolean,
  duration: number,
  setLocalTime: (t: number) => void,
  setBuffered: (t: number) => void,
  fadeIn?: (dur?: number) => void,
  fadeOut?: (dur?: number) => void,
  crossfadeDuration: number = 2,
) {
  const animFrameRef = useRef<number>(0);
  const hasFadedOutRef = useRef<boolean>(false);
  const lastStateRef = useRef<{ id: string; time: number; duration: number }>({
    id: "",
    time: 0,
    duration: 0,
  });
  // Keep refs of values the ended handler needs to avoid stale closures
  const currentSongRef = useRef(currentSong);
  currentSongRef.current = currentSong;

  // Keep a ref for isPlaying so event listeners have the latest value
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  // 1. Sync Volume
  useEffect(() => {
    if (!audioElement) return;

    // Explicitly set both to ensure browser sync
    const targetVolume = Math.max(0, Math.min(1, volume));
    audioElement.volume = targetVolume;
    audioElement.muted = isMuted || targetVolume === 0;
  }, [audioElement, volume, isMuted]);

  // 2. Sync Play/Pause state to the audio element
  useEffect(() => {
    if (!audioElement) return;
    if (isPlaying) {
      if (audioElement.paused && audioElement.readyState >= 2) {
        audioElement.play().catch((err) => {
          if (err.name !== "AbortError")
            console.warn("[Player] Play failed:", err);
        });
      }
    } else {
      if (!audioElement.paused && !isInternalChange.current) {
        audioElement.pause();
      }
    }
  }, [audioElement, isPlaying, isInternalChange]);

  // 3. Native Event Listeners
  useEffect(() => {
    if (!audioElement) return;

    const onPlay = () => {
      if (isInternalChange.current || audioElement.readyState === 0) return;
      playerActions.setIsPlaying(true);
    };
    const onPause = () => {
      if (isInternalChange.current || audioElement.readyState === 0) return;
      playerActions.setIsPlaying(false);
    };
    const handleEnded = () => {
      // Robust check: Only trigger 'next' if we are actually at/near the end of the song.
      // This prevents the common browser issue where interruptions or source changes
      // fire an 'ended' event prematurely.
      if (audioElement.duration && isFinite(audioElement.duration)) {
        const isNearEnd =
          Math.abs(audioElement.currentTime - audioElement.duration) < 1.5;
        if (!isNearEnd) {
          console.debug(
            "[Player] Ignoring 'ended' event (not at end of duration)",
          );
          return;
        }
      }

      const last = lastStateRef.current;
      if (last.id) {
        playerActions.recordListen(last.id, 1);
        lastStateRef.current = { id: "", time: 0, duration: 0 };
      }
      playerActions.next();
    };

    // Handle when the audio element can play after a pause -> play toggle
    const onCanPlay = () => {
      if (isPlayingRef.current && audioElement.paused) {
        audioElement.play().catch((err) => {
          if (err.name !== "AbortError")
            console.warn("[Player] Play on canplay failed:", err);
        });
      }
    };

    audioElement.addEventListener("play", onPlay);
    audioElement.addEventListener("playing", onPlay);
    audioElement.addEventListener("pause", onPause);
    audioElement.addEventListener("ended", handleEnded);
    audioElement.addEventListener("canplay", onCanPlay);

    return () => {
      audioElement.removeEventListener("play", onPlay);
      audioElement.removeEventListener("playing", onPlay);
      audioElement.removeEventListener("pause", onPause);
      audioElement.removeEventListener("ended", handleEnded);
      audioElement.removeEventListener("canplay", onCanPlay);
    };
  }, [audioElement, isInternalChange]);

  // 4. Listen Recording & Fade-In Logic
  useEffect(() => {
    const last = lastStateRef.current;
    if (currentSong?.id !== last.id) {
      hasFadedOutRef.current = false;
      if (fadeIn && crossfadeDuration > 0) {
        fadeIn(crossfadeDuration);
      }

      if (last.id && last.duration > 0) {
        const ratio = Math.min(1, last.time / last.duration);
        if (ratio > 0.01 || last.time > 5) {
          playerActions.recordListen(last.id, ratio);
        }
      }
      lastStateRef.current = {
        id: currentSong?.id || "",
        time: 0,
        duration: currentSong?.duration || 0,
      };
    }
  }, [currentSong?.id, fadeIn, crossfadeDuration]);

  // Record on unmount
  useEffect(() => {
    return () => {
      const last = lastStateRef.current;
      if (last.id && last.duration > 0) {
        const ratio = Math.min(1, last.time / last.duration);
        if (ratio > 0.01 || last.time > 5) {
          playerActions.recordListen(last.id, ratio);
        }
      }
    };
  }, []);

  // 5. High Precision Sync & Fade-Out (RAF)
  const syncTime = useCallback(() => {
    if (!audioElement) {
      animFrameRef.current = requestAnimationFrame(syncTime);
      return;
    }
    const t = audioElement.currentTime;
    setLocalTime(t);
    playerActions.setCurrentTime(t);

    if (audioElement.buffered.length) {
      setBuffered(audioElement.buffered.end(audioElement.buffered.length - 1));
    }

    if (
      audioElement.duration &&
      isFinite(audioElement.duration) &&
      audioElement.duration !== duration
    ) {
      playerActions.setDuration(audioElement.duration);
    }

    // Trigger smooth fade-out before the track ends
    if (
      crossfadeDuration > 0 &&
      fadeOut &&
      !hasFadedOutRef.current &&
      audioElement.duration &&
      isFinite(audioElement.duration) &&
      audioElement.duration > crossfadeDuration * 2
    ) {
      const remaining = audioElement.duration - t;
      if (remaining <= crossfadeDuration && remaining > 0) {
        hasFadedOutRef.current = true;
        fadeOut(remaining);
      }
    }

    if (
      currentSongRef.current &&
      lastStateRef.current.id === currentSongRef.current.id
    ) {
      lastStateRef.current.time = t;
      lastStateRef.current.duration =
        audioElement.duration || duration || lastStateRef.current.duration;
    }

    animFrameRef.current = requestAnimationFrame(syncTime);
  }, [audioElement, duration, setLocalTime, setBuffered, fadeOut, crossfadeDuration]);

  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(syncTime);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [syncTime]);
}
