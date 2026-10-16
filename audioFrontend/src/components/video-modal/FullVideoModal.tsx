"use client";

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FC,
} from "react";
import { useStore } from "@tanstack/react-store";
import { playerActions, playerStore } from "@/store/player.store";
import { loadShaka } from "./shaka-loader";
import type { FullVideoModalProps, QualityLevel } from "./types";
import { VideoControlsOverlay } from "./VideoControlsOverlay";
import { VideoPipPlayer } from "./VideoPipPlayer";

export const FullVideoModal: FC<FullVideoModalProps> = ({
  hlsUrl,
  dashUrl,
  title,
  artistName,
  posterUrl: _posterUrl,
  songId,
  initialTime,
  onClose,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Subscribe to store — used for two-way sync
  const storeIsPlaying = useStore(playerStore, (s) => s.isPlaying);
  const storeVolume = useStore(playerStore, (s) => s.volume);
  const storeIsMuted = useStore(playerStore, (s) => s.isMuted);
  const storeSeekTarget = useStore(playerStore, (s) => s.seekTarget);

  // Determine if this full video is for the currently active song in the audio player
  const isCurrentSong = songId
    ? playerStore.state.currentSong?.id === songId
    : true;

  // Capture the starting time at mount time so Shaka gets a stable value.
  const startTimeRef = useRef<number>(
    typeof initialTime === "number" && initialTime >= 0
      ? initialTime
      : isCurrentSong
        ? playerStore.state.currentTime || 0
        : 0,
  );

  // Keep a ref to the latest currentTime so unmount cleanup always has the exact timestamp
  const currentTimeRef = useRef<number>(startTimeRef.current);

  // Activate video playback mode in store on mount and reset on unmount
  useEffect(() => {
    playerActions.setIsVideoActive(true);
    return () => {
      const v = videoRef.current;
      const finalTime = v && isFinite(v.currentTime) ? v.currentTime : currentTimeRef.current;
      if (isCurrentSong && typeof finalTime === "number" && isFinite(finalTime) && finalTime >= 0) {
        playerActions.seek(finalTime);
        playerActions.setCurrentTime(finalTime);
      }
      playerActions.setIsVideoActive(false);
    };
  }, [isCurrentSong]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(startTimeRef.current);
  const [duration, setDuration] = useState(0);
  const [bufferedTime, setBufferedTime] = useState(0);
  const [qualityLevels, setQualityLevels] = useState<QualityLevel[]>([]);
  const [selectedQuality, setSelectedQuality] = useState<number>(-1);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPipMode, setIsPipMode] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync fullscreen state
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement || (document as any).webkitFullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
    };
  }, []);

  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => setShowControls(false), 3000);
  }, []);

  const manifestUrl = dashUrl || hlsUrl;
  const isBufferingRef = useRef<boolean>(false);

  /* ─── Shaka Player init ─── */
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !manifestUrl) {
      return;
    }
    let destroyed = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let player: any;

    // Reset UI state for new manifest
    setIsInitializing(true);
    setIsLoading(false);
    setError(null);
    setDuration(0);
    setBufferedTime(0);
    setQualityLevels([]);
    setSelectedQuality(-1);

    (async () => {
      try {
        const shaka = await loadShaka();
        if (shaka.polyfill?.installAll) shaka.polyfill.installAll();

        if (destroyed) return;

        if (shaka.Player?.isBrowserSupported && !shaka.Player.isBrowserSupported()) {
          setError("Your browser does not support adaptive streaming.");
          setIsInitializing(false);
          return;
        }

        // Destroy previous Shaka instance if it exists (for song transitions)
        if (playerRef.current) {
          try {
            await playerRef.current.destroy();
          } catch {}
          playerRef.current = null;
        }

        player = new shaka.Player();
        await player.attach(video);
        playerRef.current = player;

        if (destroyed) return;

        player.configure({ streaming: { bufferingGoal: 30, rebufferingGoal: 2 } });

        player.addEventListener("error", (e: Event) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const detail = (e as any).detail;
          if (!destroyed) setError(`Playback error: ${detail?.message ?? "Unknown"}`);
        });

        player.addEventListener("buffering", (e: Event) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const isBuffering = Boolean((e as any).buffering);
          isBufferingRef.current = isBuffering;
          if (!destroyed) setIsLoading(isBuffering);
        });

        const startTime = startTimeRef.current;
        await player.load(manifestUrl, startTime > 0 ? startTime : 0);

        if (destroyed) return;

        if (startTime > 0) {
          video.currentTime = startTime;
          setCurrentTime(startTime);
        }

        // Extract quality levels from variant tracks
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tracks: any[] = player.getVariantTracks?.() ?? [];
        const seen = new Set<number>();
        const levels: QualityLevel[] = [];
        tracks.forEach((t) => {
          const h: number = t.height ?? 0;
          if (h > 0 && !seen.has(h)) {
            seen.add(h);
            levels.push({ label: `${h}p`, bandwidth: t.bandwidth, height: h });
          }
        });
        levels.sort((a, b) => b.height - a.height);
        setQualityLevels(levels);
        setIsInitializing(false);

        try {
          await video.play();
          setIsPlaying(true);
          playerActions.setIsPlaying(true);
        } catch {
          // Autoplay may be blocked by browser policy
        }
      } catch (err: unknown) {
        if (!destroyed) {
          setError((err as Error)?.message ?? "Failed to load video");
          setIsInitializing(false);
        }
      }
    })();

    return () => {
      destroyed = true;
      if (player) {
        try { player.destroy(); } catch {}
      }
      if (playerRef.current === player) playerRef.current = null;
    };
  }, [manifestUrl]);

  /* ─── Two-Way Website Player Sync Listeners ─── */
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (storeIsPlaying && v.paused) {
      v.play().catch(() => {});
    } else if (!storeIsPlaying && !v.paused) {
      v.pause();
    }
  }, [storeIsPlaying]);

  useEffect(() => {
    if (typeof storeSeekTarget === "number" && isFinite(storeSeekTarget)) {
      const v = videoRef.current;
      if (v && Math.abs(v.currentTime - storeSeekTarget) > 0.5) {
        v.currentTime = storeSeekTarget;
        setCurrentTime(storeSeekTarget);
      }
    }
  }, [storeSeekTarget]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const targetVol = Math.max(0, Math.min(1, storeVolume));
    v.volume = targetVol;
    v.muted = storeIsMuted || targetVol === 0;
    setIsMuted(v.muted);
  }, [storeVolume, storeIsMuted]);

  /* ─── Video Native Events ─── */
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateBuffer = () => {
      if (!video) return;
      if (video.buffered && video.buffered.length > 0) {
        for (let i = 0; i < video.buffered.length; i++) {
          if (video.buffered.start(i) <= video.currentTime && video.currentTime <= video.buffered.end(i)) {
            setBufferedTime(video.buffered.end(i));
            return;
          }
        }
        setBufferedTime(video.buffered.end(video.buffered.length - 1));
      }
    };

    const onTimeUpdate = () => {
      const t = video.currentTime;
      currentTimeRef.current = t;
      setCurrentTime(t);
      if (isCurrentSong) {
        playerActions.setCurrentTime(t);
      }
      updateBuffer();
    };

    const onDurationChange = () => {
      const dur = video.duration || 0;
      setDuration(dur);
      if (isCurrentSong && dur > 0) {
        playerActions.setDuration(dur);
      }
      updateBuffer();
    };

    const onPlay = () => {
      if (isBufferingRef.current) return;
      setIsPlaying(true);
      playerActions.setIsPlaying(true);
    };

    const onPause = () => {
      if (video.seeking || video.ended || isBufferingRef.current) return;
      setIsPlaying(false);
      playerActions.setIsPlaying(false);
    };

    const onEnded = () => {
      if (isCurrentSong) {
        const v = videoRef.current;
        if (v) { try { v.pause(); } catch {} }
        playerActions.setCurrentTime(0);
        playerActions.setSeekTarget(null);
        if (typeof window !== "undefined") {
          localStorage.setItem("last_current_time", "0");
        }
        playerActions.setIsVideoActive(false);
        onClose(0);
        playerActions.next();
      }
    };

    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("progress", updateBuffer);
    video.addEventListener("seeking", updateBuffer);
    video.addEventListener("seeked", updateBuffer);
    video.addEventListener("durationchange", onDurationChange);
    video.addEventListener("loadedmetadata", updateBuffer);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("ended", onEnded);

    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("progress", updateBuffer);
      video.removeEventListener("seeking", updateBuffer);
      video.removeEventListener("seeked", updateBuffer);
      video.removeEventListener("durationchange", onDurationChange);
      video.removeEventListener("loadedmetadata", updateBuffer);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("ended", onEnded);
    };
  }, [isCurrentSong, onClose]);

  const togglePlay = useCallback(() => {
    playerActions.setIsPlaying(!storeIsPlaying);
  }, [storeIsPlaying]);

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    const nextMuted = !v.muted;
    v.muted = nextMuted;
    setIsMuted(nextMuted);
    playerActions.setIsMuted(nextMuted);
  }, []);

  const handleClose = useCallback(() => {
    const v = videoRef.current;
    const finalTime = v && isFinite(v.currentTime) ? v.currentTime : currentTimeRef.current;
    if (v) {
      try {
        v.pause();
      } catch {}
    }
    if (isCurrentSong && typeof finalTime === "number" && isFinite(finalTime) && finalTime >= 0) {
      playerActions.seek(finalTime);
      playerActions.setCurrentTime(finalTime);
      if (typeof window !== "undefined") {
        localStorage.setItem("last_current_time", finalTime.toFixed(2));
      }
    }
    playerActions.setIsPlaying(true);
    playerActions.setIsVideoActive(false);
    onClose(finalTime);
  }, [isCurrentSong, onClose]);

  const applyQuality = (height: number) => {
    const player = playerRef.current;
    if (!player) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tracks: any[] = player.getVariantTracks?.() ?? [];
    if (height === -1) {
      player.configure?.({ abr: { enabled: true } });
    } else {
      player.configure?.({ abr: { enabled: false } });
      const best = tracks
        .filter((t) => (t.height ?? 0) === height)
        .sort((a, b) => b.bandwidth - a.bandwidth)[0];
      if (best) player.selectVariantTrack?.(best, true);
    }
    setSelectedQuality(height);
    setShowQualityMenu(false);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = videoRef.current;
    if (!v) return;
    const targetTime = Number(e.target.value);
    v.currentTime = targetTime;
    setCurrentTime(targetTime);
    if (isCurrentSong) {
      playerActions.seek(targetTime);
    }
  };

  const toggleFullscreen = useCallback(() => {
    const isCurrentlyFullscreen = Boolean(
      document.fullscreenElement || (document as any).webkitFullscreenElement,
    );
    if (!isCurrentlyFullscreen) {
      const el = containerRef.current as HTMLElement | null;
      if (!el) return;
      if (el.requestFullscreen) {
        el.requestFullscreen().catch(() => {});
      } else if ((el as any).webkitRequestFullscreen) {
        (el as any).webkitRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      }
    }
  }, []);

  const togglePip = useCallback(async () => {
    if (document.pictureInPictureEnabled && videoRef.current) {
      if (document.pictureInPictureElement) {
        document.exitPictureInPicture().catch(() => {});
        setIsPipMode(false);
      } else {
        try {
          await videoRef.current.requestPictureInPicture();
          return;
        } catch {
          setIsPipMode((prev) => !prev);
        }
      }
    } else {
      setIsPipMode((prev) => !prev);
    }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        const inFullscreen = Boolean(
          document.fullscreenElement || (document as any).webkitFullscreenElement,
        );
        if (!inFullscreen) {
          handleClose();
        }
      }
      if (e.key === "v" || e.key === "V") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        handleClose();
      }
      if (e.key === "p" || e.key === "P") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        togglePip();
      }
      if (e.key === " " || e.key === "k" || e.key === "K") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        togglePlay();
      }
      if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        toggleMute();
      }
      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        toggleFullscreen();
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        const v = videoRef.current;
        if (v) {
          v.currentTime = Math.max(0, v.currentTime - 5);
          setCurrentTime(v.currentTime);
        }
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        const v = videoRef.current;
        if (v) {
          const maxDur = v.duration || duration || 0;
          v.currentTime = maxDur > 0 ? Math.min(maxDur, v.currentTime + 5) : v.currentTime + 5;
          setCurrentTime(v.currentTime);
        }
      }
    };
    window.addEventListener("keydown", handler, { capture: true });
    return () => window.removeEventListener("keydown", handler, { capture: true });
  }, [handleClose, togglePlay, toggleMute, toggleFullscreen, togglePip, duration]);

  const fmt = (s: number) => {
    if (!s || isNaN(s) || !isFinite(s) || s < 0) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const safeCurrentTime = Math.max(0, isFinite(currentTime) ? currentTime : 0);
  const safeDuration = Math.max(0, isFinite(duration) ? duration : 0);
  const progressPct =
    safeDuration > 0
      ? Math.min(100, Math.max(0, (safeCurrentTime / safeDuration) * 100))
      : 0;
  const bufferedPct =
    safeDuration > 0
      ? Math.min(100, Math.max(0, (bufferedTime / safeDuration) * 100))
      : 0;

  const qualityLabel = selectedQuality === -1 ? "Auto" : `${selectedQuality}p`;

  if (isPipMode) {
    return (
      <VideoPipPlayer
        containerRef={containerRef}
        videoRef={videoRef}
        title={title}
        artistName={artistName}
        isPlaying={isPlaying}
        bufferedPct={bufferedPct}
        progressPct={progressPct}
        safeCurrentTime={safeCurrentTime}
        safeDuration={safeDuration}
        fmt={fmt}
        resetControlsTimer={resetControlsTimer}
        onExpand={() => setIsPipMode(false)}
        onClose={handleClose}
        onTogglePlay={togglePlay}
      />
    );
  }

  return (
    <div
      className="fixed inset-0 z-[200] w-screen h-screen flex items-center justify-center bg-black overflow-hidden"
      style={{ animation: "fullVideoFadeIn 0.2s ease" }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <style>{`@keyframes fullVideoFadeIn { from { opacity: 0 } to { opacity: 1 } }`}</style>

      <div
        ref={containerRef}
        className="relative w-full h-full flex items-center justify-center bg-black overflow-hidden select-none"
        onMouseMove={resetControlsTimer}
        onMouseEnter={resetControlsTimer}
        onClick={togglePlay}
      >
        {isInitializing && !error && (
          <div
            className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/95 pointer-events-none"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative z-10 flex flex-col items-center gap-4">
              <div className="w-12 h-12 rounded-full border-[3px] border-white/10 border-t-white animate-spin" />
              <div className="flex flex-col items-center gap-1 max-w-xs px-6 text-center">
                <p className="text-white/90 font-semibold text-sm leading-tight truncate w-full">{title}</p>
                <p className="text-zinc-500 text-xs truncate w-full">{artistName}</p>
              </div>
            </div>
          </div>
        )}

        <video
          ref={videoRef}
          className="w-full h-full object-contain"
          playsInline
          preload="auto"
          crossOrigin="anonymous"
        />

        {isLoading && !isInitializing && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 pointer-events-none z-20">
            <div className="w-14 h-14 border-4 border-white/20 border-t-primary rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/90 z-30">
            <div className="text-center px-8">
              <p className="text-red-400 font-bold text-lg mb-2">Playback Error</p>
              <p className="text-zinc-400 text-sm">{error}</p>
            </div>
          </div>
        )}

        <VideoControlsOverlay
          showControls={showControls}
          isInitializing={isInitializing}
          title={title}
          artistName={artistName}
          isPlaying={isPlaying}
          isMuted={isMuted}
          isFullscreen={isFullscreen}
          safeCurrentTime={safeCurrentTime}
          safeDuration={safeDuration}
          progressPct={progressPct}
          bufferedPct={bufferedPct}
          qualityLevels={qualityLevels}
          selectedQuality={selectedQuality}
          showQualityMenu={showQualityMenu}
          qualityLabel={qualityLabel}
          fmt={fmt}
          onTogglePlay={togglePlay}
          onToggleMute={toggleMute}
          onTogglePip={togglePip}
          onToggleFullscreen={toggleFullscreen}
          onClose={handleClose}
          onSeek={handleSeek}
          onToggleQualityMenu={() => setShowQualityMenu((v) => !v)}
          onApplyQuality={applyQuality}
        />
      </div>
    </div>
  );
};
