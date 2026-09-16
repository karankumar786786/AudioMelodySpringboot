import { useEffect, useRef, useCallback, MutableRefObject } from "react";
import { playerActions, playerStore } from "../../../store/player.store";
import { previewStore } from "@/lib/preview-player";
import { useStore } from "@tanstack/react-store";
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
  crossfadeDuration: number = 3.0,
  fadeTo?: (targetGain: number, dur?: number) => void,
  setGainImmediate?: (val: number) => void,
) {
  const isPreviewPlaying = useStore(previewStore, (s) => s.status === "playing");
  const playbackRate = useStore(playerStore, (s) => s.playbackRate || 1);
  const animFrameRef = useRef<number>(0);
  const volumeAnimRef = useRef<number | null>(null);
  const hasFadedOutRef = useRef<boolean>(false);
  const lastSavedTimeRef = useRef<number>(0);
  const pauseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMicroFadingRef = useRef<boolean>(false);

  const lastStateRef = useRef<{ id: string; time: number; duration: number }>({
    id: "",
    time: 0,
    duration: 0,
  });

  // Keep refs of values the handlers need to avoid stale closures
  const currentSongRef = useRef(currentSong);
  currentSongRef.current = currentSong;

  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  const fadeInRef = useRef(fadeIn);
  fadeInRef.current = fadeIn;

  const fadeOutRef = useRef(fadeOut);
  fadeOutRef.current = fadeOut;

  // Dedicated Playback Rate Synchronizer
  useEffect(() => {
    if (!audioElement) return;
    try {
      audioElement.playbackRate = playbackRate;
      audioElement.preservesPitch = true;
      (audioElement as any).mozPreservesPitch = true;
      (audioElement as any).webkitPreservesPitch = true;
    } catch (e) {
      console.warn("[useAudioSync] Failed to set playbackRate:", e);
    }
  }, [audioElement, playbackRate]);

  // 1. Sync Volume & Smooth Audio Ducking when preview is playing
  useEffect(() => {
    if (!audioElement) return;

    const targetBase = isVideoActive || isMuted ? 0 : Math.max(0, Math.min(1, volume));
    // When a hover preview is active, duck main audio to 20% of its volume
    const target = isPreviewPlaying ? targetBase * 0.2 : targetBase;

    audioElement.muted = isVideoActive || isMuted || target === 0;

    if (volumeAnimRef.current) {
      cancelAnimationFrame(volumeAnimRef.current);
      volumeAnimRef.current = null;
    }

    const startVol = audioElement.volume;
    if (Math.abs(startVol - target) < 0.01) {
      audioElement.volume = target;
      return;
    }

    const startTime = performance.now();
    const durationMs = isPreviewPlaying ? 300 : 380; // 300ms smooth duck, 380ms smooth restore

    const animateVolume = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      // Cubic ease-out
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = startVol + (target - startVol) * ease;

      if (audioElement) {
        audioElement.volume = Math.max(0, Math.min(1, current));
      }

      if (progress < 1) {
        volumeAnimRef.current = requestAnimationFrame(animateVolume);
      } else {
        if (audioElement) audioElement.volume = target;
        volumeAnimRef.current = null;
      }
    };

    volumeAnimRef.current = requestAnimationFrame(animateVolume);

    return () => {
      if (volumeAnimRef.current) {
        cancelAnimationFrame(volumeAnimRef.current);
        volumeAnimRef.current = null;
      }
    };
  }, [audioElement, volume, isMuted, isVideoActive, isPreviewPlaying]);

  const prevIsVideoActiveRef = useRef(isVideoActive);
  const prevIsPlayingRef = useRef(isPlaying);

  // 2. Play / Pause Transition with Smooth Fade-In and Fade-Out
  useEffect(() => {
    if (!audioElement) return;

    const wasVideoActive = prevIsVideoActiveRef.current;
    prevIsVideoActiveRef.current = isVideoActive;

    const wasPlaying = prevIsPlayingRef.current;
    prevIsPlayingRef.current = isPlaying;

    if (isVideoActive) {
      if (!audioElement.paused) {
        audioElement.pause();
      }
      audioElement.muted = true;
      return;
    }

    // Unmute when video becomes inactive
    audioElement.muted = isMuted || volume === 0;

    // When transitioning from Video Active -> Audio Active, synchronize timestamp immediately
    if (wasVideoActive) {
      const targetTime = playerStore.state.seekTarget ?? playerStore.state.currentTime;
      if (typeof targetTime === "number" && isFinite(targetTime) && targetTime >= 0) {
        try {
          audioElement.currentTime = targetTime;
          setLocalTime(targetTime);
        } catch (err) {
          console.warn("[useAudioSync] Failed to set audio currentTime on video handoff:", err);
        }
      }
    }

    // Re-assert playback rate and pitch preservation
    if (audioElement.playbackRate !== playbackRate) {
      audioElement.playbackRate = playbackRate;
    }
    audioElement.preservesPitch = true;

    if (isPlaying) {
      // Clear any pending pause timeouts (user quickly toggled play back on)
      if (pauseTimeoutRef.current) {
        clearTimeout(pauseTimeoutRef.current);
        pauseTimeoutRef.current = null;
      }

      const fadeDuration = crossfadeDuration > 0 ? Math.min(0.4, crossfadeDuration) : 0.32;
      if (fadeInRef.current) {
        fadeInRef.current(fadeDuration);
      }

      if (audioElement.paused) {
        audioElement.play().catch((err) => {
          if (err.name !== "AbortError") {
            console.warn("[Player] Play failed:", err);
          }
        });
      }
    } else {
      // PAUSE: Smooth fade out before pausing
      if (!audioElement.paused && !isInternalChange.current) {
        const fadeOutDuration = 0.26; // 260ms smooth audio ramp down
        if (fadeOutRef.current) {
          fadeOutRef.current(fadeOutDuration);
        }

        if (pauseTimeoutRef.current) {
          clearTimeout(pauseTimeoutRef.current);
        }

        pauseTimeoutRef.current = setTimeout(() => {
          if (!isPlayingRef.current && audioElement && !audioElement.paused) {
            audioElement.pause();
          }
          pauseTimeoutRef.current = null;
        }, Math.round(fadeOutDuration * 1000));
      } else if (audioElement.paused && pauseTimeoutRef.current) {
        clearTimeout(pauseTimeoutRef.current);
        pauseTimeoutRef.current = null;
      }
    }
  }, [audioElement, isPlaying, isInternalChange, isVideoActive, isMuted, volume, playbackRate, setLocalTime, crossfadeDuration]);

  // Clean up pause timeout on unmount
  useEffect(() => {
    return () => {
      if (pauseTimeoutRef.current) {
        clearTimeout(pauseTimeoutRef.current);
        pauseTimeoutRef.current = null;
      }
    };
  }, []);

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

    const onPlaying = () => {
      if (
        isInternalChange.current ||
        isVideoActive ||
        playerStore.state.isVideoActive
      )
        return;
      playerActions.setIsLoading(false);
      playerActions.setIsPlaying(true);
      // Smooth fade in on actual audio output start
      if (fadeInRef.current) {
        fadeInRef.current(crossfadeDuration > 0 ? Math.min(0.4, crossfadeDuration) : 0.32);
      }
    };

    const onWaiting = () => {
      if (isPlayingRef.current && !isVideoActive && !playerStore.state.isVideoActive) {
        playerActions.setIsLoading(true);
      }
    };

    const onLoadStart = () => {
      if (isPlayingRef.current && !isVideoActive && !playerStore.state.isVideoActive) {
        playerActions.setIsLoading(true);
      }
    };

    const onSeeking = () => {
      if (isPlayingRef.current && !isVideoActive && !playerStore.state.isVideoActive) {
        playerActions.setIsLoading(true);
      }
    };

    const onSeeked = () => {
      if (audioElement.readyState >= 3) {
        playerActions.setIsLoading(false);
      }
      // Fade in smoothly after seek finishes
      if (isPlayingRef.current && fadeInRef.current) {
        fadeInRef.current(0.15);
      }
    };

    const onError = () => {
      playerActions.setIsLoading(false);
    };

    const onPause = () => {
      playerActions.setIsLoading(false);
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
      playerActions.setIsLoading(false);
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
      const curId = last.id || currentSongRef.current?.id;
      if (curId) {
        playerActions.recordListen(curId, 1.0);
        lastStateRef.current = { id: "", time: 0, duration: 0 };
      }

      // If repeatMode is "one", loop the current song cleanly from start with smooth crossfade
      const { repeatMode, sleepTimer } = playerStore.state;

      // Check if Sleep Timer end_of_track mode is active
      if (sleepTimer?.mode === "end_of_track") {
        console.log(
          "[Player] Sleep Timer 'end_of_track' triggered. Stopping playback with fade.",
        );
        if (fadeOutRef.current) fadeOutRef.current(0.3);
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
          "[Player] Repeat Mode 'one' active. Looping current track with fade.",
        );
        hasFadedOutRef.current = false;
        audioElement.currentTime = 0;
        setLocalTime(0);
        playerActions.setCurrentTime(0);
        if (typeof window !== "undefined") {
          localStorage.setItem("last_current_time", "0");
        }
        if (fadeInRef.current) {
          fadeInRef.current(crossfadeDuration > 0 ? crossfadeDuration : 0.35);
        }
        audioElement.play().catch((err) => {
          if (err.name !== "AbortError")
            console.warn("[Player] Loop play failed:", err);
        });
        playerActions.setIsPlaying(true);
        return;
      }

      playerActions.next(false);
    };

    // Handle when the audio element can play after a pause -> play toggle
    const onCanPlay = () => {
      if (isVideoActive || playerStore.state.isVideoActive) return;
      const target = playerStore.state.seekTarget ?? playerStore.state.currentTime;
      if (
        typeof target === "number" &&
        isFinite(target) &&
        target > 0 &&
        Math.abs(audioElement.currentTime - target) > 0.5
      ) {
        try {
          audioElement.currentTime = target;
        } catch {}
      }
      const rate = playerStore.state.playbackRate || 1;
      if (audioElement.playbackRate !== rate) {
        audioElement.playbackRate = rate;
      }
      audioElement.preservesPitch = true;
      if (!audioElement.paused) {
        playerActions.setIsLoading(false);
      }
      if (isPlayingRef.current && audioElement.paused) {
        if (fadeInRef.current) {
          fadeInRef.current(crossfadeDuration > 0 ? Math.min(0.4, crossfadeDuration) : 0.32);
        }
        audioElement.play().catch((err) => {
          if (err.name !== "AbortError")
            console.warn("[Player] Play on canplay failed:", err);
        });
      }
    };

    audioElement.addEventListener("play", onPlay);
    audioElement.addEventListener("playing", onPlaying);
    audioElement.addEventListener("waiting", onWaiting);
    audioElement.addEventListener("loadstart", onLoadStart);
    audioElement.addEventListener("seeking", onSeeking);
    audioElement.addEventListener("seeked", onSeeked);
    audioElement.addEventListener("canplay", onCanPlay);
    audioElement.addEventListener("canplaythrough", onCanPlay);
    audioElement.addEventListener("pause", onPause);
    audioElement.addEventListener("ended", handleEnded);
    audioElement.addEventListener("error", onError);

    return () => {
      audioElement.removeEventListener("play", onPlay);
      audioElement.removeEventListener("playing", onPlaying);
      audioElement.removeEventListener("waiting", onWaiting);
      audioElement.removeEventListener("loadstart", onLoadStart);
      audioElement.removeEventListener("seeking", onSeeking);
      audioElement.removeEventListener("seeked", onSeeked);
      audioElement.removeEventListener("canplay", onCanPlay);
      audioElement.removeEventListener("canplaythrough", onCanPlay);
      audioElement.removeEventListener("pause", onPause);
      audioElement.removeEventListener("ended", handleEnded);
      audioElement.removeEventListener("error", onError);
    };
  }, [audioElement, isInternalChange, isVideoActive, crossfadeDuration]);

  // 4. Listen Recording & Song Change Fade-In Logic
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

      // Smooth fade-in on track change
      if (fadeInRef.current && isPlayingRef.current) {
        fadeInRef.current(crossfadeDuration > 0 ? crossfadeDuration : 0.35);
      }

      if (last.id) {
        const rawDuration = last.duration > 0 ? last.duration : (audioElement?.duration || 0);
        const ratio = rawDuration > 0 ? Math.min(1.0, Math.max(0.01, last.time / rawDuration)) : 0.5;
        playerActions.recordListen(last.id, Number(ratio.toFixed(2)));
      }
      lastStateRef.current = {
        id: currentSong?.id || "",
        time: 0,
        duration: currentSong?.duration || 0,
      };
    }
  }, [currentSong?.id, crossfadeDuration, setLocalTime, setBuffered, audioElement]);

  // Record on unmount
  useEffect(() => {
    return () => {
      const last = lastStateRef.current;
      if (last.id) {
        const rawDuration = last.duration > 0 ? last.duration : 0;
        const ratio = rawDuration > 0 ? Math.min(1.0, Math.max(0.01, last.time / rawDuration)) : 0.5;
        playerActions.recordListen(last.id, Number(ratio.toFixed(2)));
      }
      if (typeof window !== "undefined" && last.time > 0) {
        localStorage.setItem("last_current_time", last.time.toFixed(2));
      }
    };
  }, []);

  const isInitialMountRef = useRef<boolean>(true);

  // 5. High Precision Sync & Outro Crossfade (RAF)
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

    // Avoid overwriting store currentTime while a seekTarget handoff is executing
    if (playerStore.state.seekTarget !== null) {
      animFrameRef.current = requestAnimationFrame(syncTime);
      return;
    }

    const t = audioElement.currentTime;
    setLocalTime(t);
    playerActions.setCurrentTime(t);

    if (playerStore.state.isLoading && !audioElement.paused && audioElement.readyState >= 3) {
      playerActions.setIsLoading(false);
    }

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

    // Trigger smooth fade-out before the track ends (Outro crossfade)
    const activeFadeDuration = crossfadeDuration > 0 ? crossfadeDuration : 0.5;
    if (
      activeFadeDuration > 0 &&
      fadeOutRef.current &&
      !hasFadedOutRef.current &&
      audioElement.duration &&
      isFinite(audioElement.duration) &&
      audioElement.duration > activeFadeDuration * 2
    ) {
      const remaining = audioElement.duration - t;
      if (remaining <= activeFadeDuration && remaining > 0) {
        hasFadedOutRef.current = true;
        fadeOutRef.current(remaining);
      }
    } else if (
      hasFadedOutRef.current &&
      audioElement.duration &&
      audioElement.duration - t > activeFadeDuration * 2
    ) {
      // If user seeks back or track replayed: restore volume immediately with fade-in
      hasFadedOutRef.current = false;
      if (fadeInRef.current) {
        fadeInRef.current(0.25);
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
  }, [audioElement, duration, setLocalTime, setBuffered, crossfadeDuration]);

  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(syncTime);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [syncTime]);
}
