import { useEffect, useRef, useCallback, MutableRefObject } from "react";
import { playerActions, playerStore } from "../../../store/player.store";
import { toast } from "sonner";

export function useAudioSync(
  audioElement: HTMLAudioElement | null,
  isInternalChange: MutableRefObject<boolean>,
  currentSong: any,
  isPlaying: boolean,
  volume: number,
  isMuted: boolean,
  duration: number,
  isVideoActive: boolean,
  setLocalTime: (t: number) => void,
  setBuffered: (t: number) => void,
  fadeIn?: (dur?: number) => void,
  fadeOut?: (dur?: number) => void,
  crossfadeDuration: number = 0.5,
) {
  const animFrameRef = useRef<number>(0);
  const hasFadedOutRef = useRef<boolean>(false);
  const lastSavedTimeRef = useRef<number>(0);
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
    audioElement.muted = isVideoActive || isMuted || targetVolume === 0;
  }, [audioElement, volume, isMuted, isVideoActive]);

  // 2. Sync Play/Pause state to the audio element (only when video is not actively driving playback)
  useEffect(() => {
    if (!audioElement) return;

    if (isVideoActive) {
      if (!audioElement.paused) {
        audioElement.pause();
      }
      audioElement.muted = true;
      return;
    }

    // Unmute when video becomes inactive
    audioElement.muted = isMuted || volume === 0;

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
  }, [audioElement, isPlaying, isInternalChange, isVideoActive, isMuted, volume]);

  // 3. Native Event Listeners
  useEffect(() => {
    if (!audioElement) return;

    const onPlay = () => {
      if (
        isInternalChange.current ||
        audioElement.readyState === 0 ||
        isVideoActive ||
        playerStore.state.isVideoActive
      )
        return;
      playerActions.setIsPlaying(true);
    };
    const onPause = () => {
      if (
        isInternalChange.current ||
        audioElement.readyState === 0 ||
        isVideoActive ||
        playerStore.state.isVideoActive
      )
        return;
      playerActions.setIsPlaying(false);
      if (typeof window !== "undefined" && isFinite(audioElement.currentTime)) {
        localStorage.setItem(
          "last_current_time",
          audioElement.currentTime.toFixed(2),
        );
      }
    };
    const handleEnded = () => {
      if (isVideoActive || playerStore.state.isVideoActive) return;

      // Robust check: Only trigger 'next' if we are actually at/near the end of the song.
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

      // If repeatMode is "one", loop the current song cleanly from start
      const { repeatMode, sleepTimer } = playerStore.state;

      // Check if Sleep Timer end_of_track mode is active
      if (sleepTimer?.mode === "end_of_track") {
        console.log(
          "[Player] Sleep Timer 'end_of_track' triggered. Stopping playback.",
        );
        playerActions.setIsPlaying(false);
        playerActions.clearSleepTimer();
        toast("Sleep timer finished", {
          description: "Playback stopped at end of track. Sweet dreams!",
          icon: "🌙",
        });
        return;
      }

      if (repeatMode === "one") {
        console.log(
          "[Player] Repeat Mode 'one' active. Looping current track.",
        );
        hasFadedOutRef.current = false;
        if (fadeIn) fadeIn(crossfadeDuration > 0 ? crossfadeDuration : 0.2);
        audioElement.currentTime = 0;
        setLocalTime(0);
        playerActions.setCurrentTime(0);
        if (typeof window !== "undefined") {
          localStorage.setItem("last_current_time", "0");
        }
        audioElement.play().catch((err) => {
          if (err.name !== "AbortError")
            console.warn("[Player] Loop play failed:", err);
        });
        playerActions.setIsPlaying(true);
        return;
      }

      playerActions.next();
    };

    // Handle when the audio element can play after a pause -> play toggle
    const onCanPlay = () => {
      if (isVideoActive) return;
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
  }, [audioElement, isInternalChange, isVideoActive, fadeIn, crossfadeDuration]);

  // 4. Listen Recording & Fade-In Logic
  useEffect(() => {
    const last = lastStateRef.current;
    if (currentSong?.id !== last.id) {
      hasFadedOutRef.current = false;
      if (last.id) {
        setLocalTime(0);
        setBuffered(0);
        playerActions.setCurrentTime(0);
        if (typeof window !== "undefined") {
          localStorage.setItem("last_current_time", "0");
        }
      }

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
  }, [currentSong?.id, fadeIn, crossfadeDuration, setLocalTime, setBuffered]);

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
      if (typeof window !== "undefined" && last.time > 0) {
        localStorage.setItem("last_current_time", last.time.toFixed(2));
      }
    };
  }, []);

  const isInitialMountRef = useRef<boolean>(true);

  // 5. High Precision Sync & Fade-Out (RAF)
  const syncTime = useCallback(() => {
    if (!audioElement || playerStore.state.isVideoActive) {
      animFrameRef.current = requestAnimationFrame(syncTime);
      return;
    }

    // Protect saved time during initial mount until audio metadata is ready
    if (isInitialMountRef.current) {
      if (audioElement.readyState >= 1) {
        isInitialMountRef.current = false;
      } else {
        animFrameRef.current = requestAnimationFrame(syncTime);
        return;
      }
    }

    const t = audioElement.currentTime;
    setLocalTime(t);
    playerActions.setCurrentTime(t);

    const now = Date.now();
    if (now - lastSavedTimeRef.current > 1000) {
      lastSavedTimeRef.current = now;
      if (typeof window !== "undefined" && isFinite(t) && t > 0) {
        localStorage.setItem("last_current_time", t.toFixed(2));
      }
    }

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
    } else if (
      hasFadedOutRef.current &&
      audioElement.duration &&
      audioElement.duration - t > crossfadeDuration * 2
    ) {
      // If user seeks back or track replayed: restore volume immediately
      hasFadedOutRef.current = false;
      if (fadeIn) {
        fadeIn(0.2);
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
  }, [audioElement, duration, setLocalTime, setBuffered, fadeIn, fadeOut, crossfadeDuration]);

  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(syncTime);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [syncTime]);
}
