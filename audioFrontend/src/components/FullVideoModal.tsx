"use client";

import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  type FC,
} from "react";
import {
  X,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  ChevronDown,
  PictureInPicture2,
} from "lucide-react";

import { useStore } from "@tanstack/react-store";
import { playerStore, playerActions } from "@/store/player.store";
import { PlayerTooltip } from "./player/PlayerTooltip";

interface FullVideoModalProps {
  /** Shaka-packaged HLS URL e.g. https://…/videos/<songId>/master.m3u8 */
  hlsUrl: string;
  dashUrl?: string;
  title: string;
  artistName: string;
  posterUrl?: string;
  songId?: string;
  /** Audio player's current time to sync on open */
  initialTime?: number;
  onClose: (finalTime?: number) => void;
}

interface QualityLevel {
  label: string;
  bandwidth: number;
  height: number;
}

// Use any to avoid shaka-player compiled type namespace mismatches
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let shakaCache: any = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadShaka(): Promise<any> {
  if (shakaCache) return shakaCache;
  // shaka-player uses a UMD/namespace build; import as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod = await import("shaka-player" as any);
  shakaCache = mod.default ?? mod;
  return shakaCache;
}

export const FullVideoModal: FC<FullVideoModalProps> = ({
  hlsUrl,
  dashUrl,
  title,
  artistName,
  posterUrl,
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
  const [isLoading, setIsLoading] = useState(false); // mid-playback buffering
  const [isInitializing, setIsInitializing] = useState(true); // Shaka init / manifest fetch phase
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPipMode, setIsPipMode] = useState(false);
  // Controls overlay visibility — separate from the always-visible close button
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
      console.warn(`[VideoInit] ❌ SKIP: video=${!!video}, manifestUrl="${manifestUrl}"`);
      return;
    }
    console.log(`[VideoInit] ─── Starting Shaka init for: ${manifestUrl}`);
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
        console.log(`[VideoInit] 1️⃣ Loading shaka-player library...`);
        const shaka = await loadShaka();
        if (shaka.polyfill?.installAll) shaka.polyfill.installAll();
        console.log(`[VideoInit] 2️⃣ Shaka loaded. destroyed=${destroyed}`);

        if (destroyed) { console.log(`[VideoInit] ❌ Aborted (destroyed after shaka load)`); return; }

        if (shaka.Player?.isBrowserSupported && !shaka.Player.isBrowserSupported()) {
          setError("Your browser does not support adaptive streaming.");
          setIsInitializing(false);
          return;
        }

        // Destroy previous Shaka instance if it exists (for song transitions)
        if (playerRef.current) {
          console.log(`[VideoInit] 3️⃣ Destroying previous Shaka player...`);
          try {
            await playerRef.current.destroy();
          } catch {}
          playerRef.current = null;
        }

        console.log(`[VideoInit] 4️⃣ Creating new Shaka player + attaching to video element...`);
        player = new shaka.Player();
        await player.attach(video);
        playerRef.current = player;

        if (destroyed) { console.log(`[VideoInit] ❌ Aborted (destroyed after attach)`); return; }

        player.configure({ streaming: { bufferingGoal: 30, rebufferingGoal: 2 } });

        player.addEventListener("error", (e: Event) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const detail = (e as any).detail;
          console.error(`[VideoInit] ❌ Shaka error event:`, detail);
          if (!destroyed) setError(`Playback error: ${detail?.message ?? "Unknown"}`);
        });

        player.addEventListener("buffering", (e: Event) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const isBuffering = Boolean((e as any).buffering);
          isBufferingRef.current = isBuffering;
          if (!destroyed) setIsLoading(isBuffering);
        });

        // Pass the captured start time to Shaka
        const startTime = startTimeRef.current;
        console.log(`[VideoInit] 5️⃣ Loading manifest: ${manifestUrl} (startTime=${startTime})`);
        await player.load(manifestUrl, startTime > 0 ? startTime : 0);
        console.log(`[VideoInit] 6️⃣ Manifest loaded! destroyed=${destroyed}`);

        if (destroyed) { console.log(`[VideoInit] ❌ Aborted (destroyed after manifest load)`); return; }

        // Belt-and-suspenders: also set it on the video element after load
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
        // Done initializing
        setIsInitializing(false);
        console.log(`[VideoInit] 7️⃣ Init complete. Attempting video.play()...`);

        try {
          await video.play();
          setIsPlaying(true);
          playerActions.setIsPlaying(true);
          console.log(`[VideoInit] ✅ video.play() succeeded!`);
        } catch (playErr) {
          console.warn(`[VideoInit] ⚠️ video.play() failed (autoplay blocked?):`, playErr);
        }
      } catch (err: unknown) {
        console.error(`[VideoInit] ❌ Exception during init:`, err);
        if (!destroyed) {
          setError((err as Error)?.message ?? "Failed to load video");
          setIsInitializing(false);
        }
      }
    })();

    return () => {
      console.log(`[VideoInit] 🧹 Cleanup running for: ${manifestUrl}`);
      destroyed = true;
      if (player) {
        try { player.destroy(); } catch {}
      }
      if (playerRef.current === player) playerRef.current = null;
    };
  }, [manifestUrl]);

  /* ─── Two-Way Website Player Sync Listeners ─── */
  // 1. Sync external store play/pause -> video
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (storeIsPlaying && v.paused) {
      v.play().catch(() => {});
    } else if (!storeIsPlaying && !v.paused) {
      v.pause();
    }
  }, [storeIsPlaying]);

  // 2. Sync store seekTarget -> video
  useEffect(() => {
    if (typeof storeSeekTarget === "number" && isFinite(storeSeekTarget)) {
      const v = videoRef.current;
      if (v && Math.abs(v.currentTime - storeSeekTarget) > 0.5) {
        v.currentTime = storeSeekTarget;
        setCurrentTime(storeSeekTarget);
      }
    }
  }, [storeSeekTarget]);

  // 3. Sync store volume and mute -> video
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
        console.log(`[FullVideoModal] Video ended. Closing modal and advancing to next song.`);
        // Close the video modal first
        const v = videoRef.current;
        if (v) { try { v.pause(); } catch {} }
        // Reset time for the next song
        playerActions.setCurrentTime(0);
        playerActions.setSeekTarget(null);
        if (typeof window !== "undefined") {
          localStorage.setItem("last_current_time", "0");
        }
        playerActions.setIsVideoActive(false);
        onClose(0);
        // Advance to next song — audio player will handle playback
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
  }, [isCurrentSong]);

  const togglePlay = useCallback(() => {
    console.log("[FullVideoModal] togglePlay called. Current storeIsPlaying:", storeIsPlaying);
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

  // Seamless Close: sync the video's final time back to the single store state and resume audio playback
  const handleClose = useCallback(() => {
    const v = videoRef.current;
    const finalTime = v && isFinite(v.currentTime) ? v.currentTime : currentTimeRef.current;
    if (v) {
      try {
        v.pause();
      } catch {}
    }
    if (isCurrentSong && typeof finalTime === "number" && isFinite(finalTime) && finalTime >= 0) {
      // Write the video's current position into the single store state
      // so the audio player resumes from the exact same point
      playerActions.seek(finalTime);
      playerActions.setCurrentTime(finalTime);
      // Also persist to localStorage so it survives page reloads
      if (typeof window !== "undefined") {
        localStorage.setItem("last_current_time", finalTime.toFixed(2));
      }
    }
    // Always resume playback when closing video (user expects audio to continue)
    playerActions.setIsPlaying(true);
    playerActions.setIsVideoActive(false);
    onClose(finalTime);
  }, [isCurrentSong, onClose]);

  /* ─── Quality switching ─── */
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
    // If native PiP is supported, try native PiP first
    if (document.pictureInPictureEnabled && videoRef.current) {
      if (document.pictureInPictureElement) {
        document.exitPictureInPicture().catch(() => {});
        setIsPipMode(false);
      } else {
        try {
          await videoRef.current.requestPictureInPicture();
          return;
        } catch {
          // Fallback to in-app floating corner tile
          setIsPipMode((prev) => !prev);
        }
      }
    } else {
      setIsPipMode((prev) => !prev);
    }
  }, []);

  /* ─── Keyboard shortcuts ─── */
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

  /* ─────────────────────────────────────────────────────────────
     1. IN-APP FLOATING CORNER PICTURE-IN-PICTURE (PiP) MODE
     ───────────────────────────────────────────────────────────── */
  if (isPipMode) {
    return (
      <div
        ref={containerRef}
        className="fixed bottom-24 right-4 sm:right-6 z-[200] w-72 sm:w-80 md:w-96 aspect-video rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.95),inset_0_1px_1px_rgba(255,255,255,0.2)] ring-1 ring-white/20 bg-black animate-in fade-in slide-in-from-bottom-4 duration-300 select-none group"
        onMouseMove={resetControlsTimer}
        onMouseEnter={resetControlsTimer}
      >
        <video
          ref={videoRef}
          className="w-full h-full object-contain"
          playsInline
          preload="auto"
          crossOrigin="anonymous"
        />

        {/* Hover Controls Overlay */}
        <div
          className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/80 flex flex-col justify-between p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Top Header: Title & Actions */}
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h4 className="text-xs font-bold text-white truncate leading-tight">{title}</h4>
              <p className="text-[10px] text-zinc-300 truncate">{artistName}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <PlayerTooltip content="Expand to Modal" shortcut="P">
                <button
                  onClick={() => setIsPipMode(false)}
                  className="p-1.5 rounded-full bg-black/60 hover:bg-black/90 text-white transition-all cursor-pointer border border-white/20 backdrop-blur-md"
                  aria-label="Expand video"
                >
                  <Maximize2 size={13} />
                </button>
              </PlayerTooltip>
              <PlayerTooltip content="Close & Resume Audio" shortcut={["Esc", "V"]}>
                <button
                  onClick={handleClose}
                  className="p-1.5 rounded-full bg-black/60 hover:bg-black/90 text-white transition-all cursor-pointer border border-white/20 backdrop-blur-md"
                  aria-label="Close video"
                >
                  <X size={13} />
                </button>
              </PlayerTooltip>
            </div>
          </div>

          {/* Center Play/Pause button */}
          <div className="flex items-center justify-center">
            <button
              onClick={togglePlay}
              className="w-9 h-9 rounded-full bg-white/90 hover:bg-white flex items-center justify-center text-black shadow-xl hover:scale-110 active:scale-95 transition-all cursor-pointer"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <Pause size={16} fill="black" />
              ) : (
                <Play size={16} fill="black" style={{ marginLeft: 2 }} />
              )}
            </button>
          </div>

          {/* Bottom Progress Line */}
          <div className="space-y-1">
            <div className="relative h-1 w-full bg-white/20 rounded-full overflow-hidden">
              <div
                className="absolute left-0 top-0 bottom-0 bg-white/40 rounded-full"
                style={{ width: `${bufferedPct}%` }}
              />
              <div
                className="absolute left-0 top-0 bottom-0 bg-primary rounded-full"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono">
              <span>{fmt(safeCurrentTime)}</span>
              <span>{fmt(safeDuration)}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ─────────────────────────────────────────────────────────────
     2. FULL SCREEN / STANDARD MODAL OVERLAY
     ───────────────────────────────────────────────────────────── */
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
        {/* ── Full-screen initializing overlay — clean spinner, no album art ── */}
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

        {/* Mid-playback buffering spinner (not shown during init — that's handled above) */}
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

        {/* Controls overlay */}
        <div
          className="absolute inset-0 flex flex-col justify-between overflow-hidden pointer-events-none"
          style={{
            opacity: showControls && !isInitializing ? 1 : 0,
            transition: "opacity 0.3s ease",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Top: title + PiP/Close (all inside the auto-hiding controls overlay) */}
          <div
            className="flex items-center justify-between px-6 sm:px-8 pt-6 pb-16 pointer-events-auto"
            style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.85), transparent)" }}
          >
            <div className="min-w-0 flex-1 pr-4">
              <h2 className="text-white font-bold text-lg sm:text-xl leading-tight truncate">{title}</h2>
              <p className="text-zinc-300 text-xs sm:text-sm truncate mt-0.5">{artistName}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <PlayerTooltip content="Picture-in-Picture" shortcut="P" side="bottom">
                <button
                  onClick={(e) => { e.stopPropagation(); togglePip(); }}
                  className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer backdrop-blur-sm"
                  aria-label="Picture-in-Picture"
                >
                  <PictureInPicture2 size={16} />
                </button>
              </PlayerTooltip>
              <PlayerTooltip content="Close" shortcut={["Esc", "V"]} side="bottom" align="end">
                <button
                  onClick={(e) => { e.stopPropagation(); handleClose(); }}
                  className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer backdrop-blur-sm"
                  aria-label="Close full video"
                >
                  <X size={16} />
                </button>
              </PlayerTooltip>
            </div>
          </div>

          {/* Bottom: progress + controls */}
          <div
            className="px-6 sm:px-8 pb-6 sm:pb-8 pt-16 pointer-events-auto"
            style={{ background: "linear-gradient(to top, rgba(0,0,0,0.95), rgba(0,0,0,0.6), transparent)" }}
          >
            <div className="flex items-center gap-3 mb-3">
              <span className="text-xs text-zinc-300 font-mono w-10 text-right shrink-0 select-none">
                {fmt(safeCurrentTime)}
              </span>

              <div className="relative flex-1 h-5 flex items-center group cursor-pointer select-none">
                {/* Background Track */}
                <div className="absolute inset-x-0 h-1 group-hover:h-1.5 bg-white/20 rounded-full transition-all duration-150" />

                {/* Buffered Loaded Bar */}
                <div
                  className="absolute left-0 h-1 group-hover:h-1.5 bg-white/40 rounded-full pointer-events-none transition-all duration-150"
                  style={{ width: `${bufferedPct}%` }}
                />

                {/* Played Progress Bar */}
                <div
                  className="absolute left-0 h-1 group-hover:h-1.5 bg-white rounded-full pointer-events-none transition-all duration-150"
                  style={{ width: `${progressPct}%` }}
                />

                {/* Scrubber thumb circle */}
                <div
                  className="absolute w-3.5 h-3.5 bg-white rounded-full shadow-md -translate-x-1/2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                  style={{ left: `${progressPct}%` }}
                />

                {/* Native Slider Input */}
                <input
                  type="range"
                  min="0"
                  max={Math.max(1, safeDuration)}
                  step="0.1"
                  value={Math.min(safeCurrentTime, Math.max(1, safeDuration))}
                  onChange={handleSeek}
                  aria-label="Seek video"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 m-0 p-0 border-0 bg-transparent"
                />
              </div>

              <span className="text-xs text-zinc-300 font-mono w-10 shrink-0 select-none">
                {fmt(safeDuration)}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <PlayerTooltip content={isPlaying ? "Pause" : "Play"} shortcut={["Space", "K"]}>
                  <button
                    onClick={togglePlay}
                    className="w-9 h-9 rounded-full bg-white flex items-center justify-center text-black hover:scale-105 transition-transform cursor-pointer"
                    aria-label={isPlaying ? "Pause" : "Play"}
                  >
                    {isPlaying
                      ? <Pause size={18} fill="black" />
                      : <Play size={18} fill="black" style={{ marginLeft: 2 }} />}
                  </button>
                </PlayerTooltip>

                <PlayerTooltip content={isMuted ? "Unmute" : "Mute"} shortcut="M">
                  <button
                    onClick={toggleMute}
                    className="text-zinc-300 hover:text-white transition-colors p-1 cursor-pointer"
                    aria-label={isMuted ? "Unmute" : "Mute"}
                  >
                    {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                  </button>
                </PlayerTooltip>
              </div>

              <div className="flex items-center gap-2">
                {qualityLevels.length > 0 && (
                  <div className="relative">
                    <PlayerTooltip content="Video Quality">
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowQualityMenu((v) => !v); }}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all cursor-pointer"
                      >
                        {qualityLabel}
                        <ChevronDown size={12} />
                      </button>
                    </PlayerTooltip>
                    {showQualityMenu && (
                      <div
                        className="absolute bottom-full mb-2 right-0 bg-zinc-900 border border-zinc-700 rounded-xl overflow-hidden shadow-2xl min-w-[80px] z-20"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {[{ height: -1, label: "Auto" }, ...qualityLevels].map((q) => (
                          <button
                            key={q.height}
                            onClick={() => applyQuality(q.height)}
                            className={`w-full text-left px-3 py-2 text-xs font-bold transition-colors ${
                              selectedQuality === q.height
                                ? "text-white bg-white/15"
                                : "text-zinc-400 hover:text-white hover:bg-white/5"
                            }`}
                          >
                            {q.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <PlayerTooltip content={isFullscreen ? "Exit Fullscreen" : "Fullscreen"} shortcut="F" align="end">
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
                    className="text-zinc-300 hover:text-white transition-colors p-1 cursor-pointer"
                    aria-label={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                  >
                    {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                  </button>
                </PlayerTooltip>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
