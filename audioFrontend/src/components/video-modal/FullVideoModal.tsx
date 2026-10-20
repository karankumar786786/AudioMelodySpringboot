"use client";

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FC,
} from "react";
import Hls from "hls.js";
import { useStore } from "@tanstack/react-store";
import { playerActions, playerStore } from "@/store/player.store";
import { getVideoABRUrl, getVideoUrl } from "@/lib/image-utils";
import { resolveHlsUrl } from "@/lib/player-utils";
import type { FullVideoModalProps } from "./types";
import { PlayerTooltip } from "@/components/player/PlayerTooltip";
import {
  Check,
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  RotateCcw,
  RotateCw,
  Settings,
  Volume1,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";

const IMAGEKIT_ID = process.env.NEXT_PUBLIC_IMAGEKIT_ID || "hc29ms4ul";

interface QualityOption {
  id: number;
  height: number;
  bitrate: number;
  label: string;
}

export const FullVideoModal: FC<FullVideoModalProps> = ({
  hlsUrl,
  dashUrl,
  fullVideoKey,
  videoKey,
  title,
  artistName,
  posterUrl,
  songId,
  initialTime,
  onClose,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const seekbarRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const playPromiseRef = useRef<Promise<void> | null>(null);

  // TanStack player store subscriptions
  const storeVolume = useStore(playerStore, (s) => s.volume);
  const storeIsMuted = useStore(playerStore, (s) => s.isMuted);

  const isCurrentSong = songId
    ? playerStore.state.currentSong?.id === songId
    : true;

  const startTimeRef = useRef<number>(
    typeof initialTime === "number" && initialTime >= 0
      ? initialTime
      : isCurrentSong
        ? playerStore.state.currentTime || 0
        : 0,
  );
  const currentTimeRef = useRef<number>(startTimeRef.current);

  // Local playback states
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isBuffering, setIsBuffering] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<number>(startTimeRef.current);
  const [duration, setDuration] = useState<number>(0);
  const [bufferedPct, setBufferedPct] = useState<number>(0);
  const [volume, setVolume] = useState<number>(
    Math.max(0, Math.min(1, storeVolume ?? 1)),
  );
  const [isMuted, setIsMuted] = useState<boolean>(storeIsMuted ?? false);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [areControlsVisible, setAreControlsVisible] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isPipAvailable, setIsPipAvailable] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [qualities, setQualities] = useState<QualityOption[]>([]);
  const [selectedQuality, setSelectedQuality] = useState<number>(-1); // -1 = Auto
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [settingsTab, setSettingsTab] = useState<"menu" | "quality" | "speed">(
    "menu",
  );

  // Seekbar hover preview state
  const [isHoveringSeek, setIsHoveringSeek] = useState<boolean>(false);
  const [hoverTime, setHoverTime] = useState<number>(0);
  const [hoverPreviewX, setHoverPreviewX] = useState<number>(0);
  const [hoverThumbUrl, setHoverThumbUrl] = useState<string>("");
  const frameCache = useRef<Map<number, string>>(new Map());
  const isDraggingSeekbar = useRef<boolean>(false);

  // Double-tap ripple effect state
  const [skipNotice, setSkipNotice] = useState<{
    side: "left" | "right";
    text: string;
  } | null>(null);
  const skipNoticeTimeout = useRef<NodeJS.Timeout | null>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Helper: auto-hide controls after 2.6s
  const resetControlsTimeout = useCallback(() => {
    setAreControlsVisible(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      const v = videoRef.current;
      if (v && !v.paused && !isSettingsOpen) {
        setAreControlsVisible(false);
      }
    }, 2600);
  }, [isSettingsOpen]);

  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      if (skipNoticeTimeout.current) clearTimeout(skipNoticeTimeout.current);
    };
  }, []);

  // Safe play & pause helpers to avoid AbortError
  const safePlay = useCallback(async () => {
    const v = videoRef.current;
    if (!v) return;
    try {
      const p = v.play();
      playPromiseRef.current = p;
      await p;
      setIsPlaying(true);
      playerActions.setIsPlaying(true);
    } catch (err: unknown) {
      if ((err as Error)?.name !== "AbortError") {
        console.warn("Video playback error:", err);
      }
    } finally {
      playPromiseRef.current = null;
    }
  }, []);

  const safePause = useCallback(async () => {
    const v = videoRef.current;
    if (!v) return;
    if (playPromiseRef.current) {
      try {
        await playPromiseRef.current;
      } catch {}
    }
    v.pause();
    setIsPlaying(false);
    playerActions.setIsPlaying(false);
  }, []);

  const togglePlayPause = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      safePlay();
      resetControlsTimeout();
    } else {
      safePause();
      setAreControlsVisible(true);
    }
  }, [safePlay, safePause, resetControlsTimeout]);

  // Resolve best video source
  const resolveEffectiveSource = useCallback(() => {
    const effectiveKey = fullVideoKey || videoKey;
    if (
      effectiveKey &&
      (effectiveKey.startsWith("/songs/") || effectiveKey.startsWith("songs/"))
    ) {
      const ikAbr = getVideoABRUrl(effectiveKey);
      if (ikAbr) return { src: ikAbr, isHls: true };
      const ikDirect = getVideoUrl(effectiveKey);
      if (ikDirect) return { src: ikDirect, isHls: false };
    }
    if (hlsUrl) {
      return { src: hlsUrl, isHls: true };
    }
    if (dashUrl) {
      return { src: dashUrl, isHls: false };
    }
    if (effectiveKey) {
      const cldHls = resolveHlsUrl(effectiveKey);
      if (cldHls) return { src: cldHls, isHls: true };
    }
    return { src: "", isHls: false };
  }, [fullVideoKey, videoKey, hlsUrl, dashUrl]);

  // Activate video mode in store
  useEffect(() => {
    playerActions.setIsVideoActive(true);
    return () => {
      const v = videoRef.current;
      const finalTime =
        v && isFinite(v.currentTime) ? v.currentTime : currentTimeRef.current;
      if (
        isCurrentSong &&
        typeof finalTime === "number" &&
        isFinite(finalTime) &&
        finalTime >= 0
      ) {
        playerActions.seek(finalTime);
        playerActions.setCurrentTime(finalTime);
      }
      playerActions.setIsVideoActive(false);
    };
  }, [isCurrentSong]);

  // Initialize HLS.js or native HTML5 video
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const { src, isHls } = resolveEffectiveSource();
    if (!src) {
      setError("No valid video stream URL available for this track.");
      setIsBuffering(false);
      return;
    }

    setIsBuffering(true);
    setError(null);

    // Initial audio volume & mute
    video.volume = volume;
    video.muted = isMuted;

    let hlsInstance: Hls | null = null;

    if (isHls && Hls.isSupported()) {
      hlsInstance = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90,
      });
      hlsRef.current = hlsInstance;

      hlsInstance.loadSource(src);
      hlsInstance.attachMedia(video);

      hlsInstance.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
        setIsBuffering(false);
        if (data.levels && data.levels.length > 0) {
          const mapped: QualityOption[] = data.levels.map((lvl, index) => ({
            id: index,
            height: lvl.height || 0,
            bitrate: lvl.bitrate || 0,
            label: lvl.height ? `${lvl.height}p` : `Level ${index + 1}`,
          }));
          setQualities(mapped);
        }

        if (startTimeRef.current > 0) {
          video.currentTime = startTimeRef.current;
        }
        safePlay();
      });

      hlsInstance.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hlsInstance?.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hlsInstance?.recoverMediaError();
              break;
            default:
              hlsInstance?.destroy();
              setError("Video playback encountered an error. Please try again.");
              setIsBuffering(false);
              break;
          }
        }
      });
    } else if (
      video.canPlayType("application/vnd.apple.mpegurl") ||
      !isHls
    ) {
      // Native Safari HLS or direct MP4 playback
      video.src = src;
      video.addEventListener("loadedmetadata", () => {
        setIsBuffering(false);
        if (startTimeRef.current > 0) {
          video.currentTime = startTimeRef.current;
        }
        safePlay();
      });
    } else {
      setError("Your browser does not support HLS video playback.");
      setIsBuffering(false);
    }

    // Check Picture-in-Picture capability
    if (document.pictureInPictureEnabled) {
      setIsPipAvailable(true);
    }

    return () => {
      if (hlsInstance) {
        hlsInstance.destroy();
        hlsRef.current = null;
      }
      if (video) {
        video.pause();
        video.removeAttribute("src");
        video.load();
      }
    };
  }, [resolveEffectiveSource, safePlay, volume, isMuted]);

  // Native video event listeners
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const handleTimeUpdate = () => {
      if (!isDraggingSeekbar.current) {
        setCurrentTime(v.currentTime);
        currentTimeRef.current = v.currentTime;
      }
      if (v.buffered.length > 0 && v.duration > 0) {
        const end = v.buffered.end(v.buffered.length - 1);
        setBufferedPct(Math.min(100, (end / v.duration) * 100));
      }
    };

    const handleDurationChange = () => {
      if (isFinite(v.duration) && v.duration > 0) {
        setDuration(v.duration);
      }
    };

    const handleWaiting = () => setIsBuffering(true);
    const handlePlaying = () => {
      setIsBuffering(false);
      setIsPlaying(true);
      playerActions.setIsPlaying(true);
    };
    const handlePause = () => {
      setIsPlaying(false);
      playerActions.setIsPlaying(false);
    };
    const handleEnded = () => {
      playerActions.setCurrentTime(0);
      playerActions.setSeekTarget(null);
      if (typeof window !== "undefined") {
        localStorage.setItem("last_current_time", "0");
      }
      playerActions.setIsVideoActive(false);
      onClose(0);
      playerActions.next();
    };

    v.addEventListener("timeupdate", handleTimeUpdate);
    v.addEventListener("durationchange", handleDurationChange);
    v.addEventListener("waiting", handleWaiting);
    v.addEventListener("playing", handlePlaying);
    v.addEventListener("pause", handlePause);
    v.addEventListener("ended", handleEnded);

    return () => {
      v.removeEventListener("timeupdate", handleTimeUpdate);
      v.removeEventListener("durationchange", handleDurationChange);
      v.removeEventListener("waiting", handleWaiting);
      v.removeEventListener("playing", handlePlaying);
      v.removeEventListener("pause", handlePause);
      v.removeEventListener("ended", handleEnded);
    };
  }, [onClose]);

  // Fullscreen change listener
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  // Format MM:SS helper
  const formatTime = (secs: number) => {
    if (!isFinite(secs) || secs < 0) return "0:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  // Close modal and cleanly hand off playback position to background audio
  const handleClose = useCallback(() => {
    const v = videoRef.current;
    const finalTime =
      v && isFinite(v.currentTime) ? v.currentTime : currentTimeRef.current;

    if (v) {
      v.pause();
    }

    if (
      isCurrentSong &&
      typeof finalTime === "number" &&
      isFinite(finalTime) &&
      finalTime >= 0
    ) {
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

  // Seekbar thumbnail URL resolver
  const getThumbnailUrl = useCallback(
    (second: number) => {
      const effectiveKey = fullVideoKey || videoKey || "";
      const isImageKit =
        effectiveKey.startsWith("/songs/") || effectiveKey.startsWith("songs/");
      const cleanKey = effectiveKey.startsWith("/")
        ? effectiveKey.slice(1)
        : effectiveKey;

      if (isImageKit && cleanKey) {
        return `https://ik.imagekit.io/${IMAGEKIT_ID}/${cleanKey}/ik-thumbnail.jpg?tr=so-${second},w-160,h-90`;
      }

      const rawId = songId || fullVideoKey || "";
      const match = String(rawId).match(
        /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
      );
      const cleanAssetId = match
        ? match[1]
        : String(rawId)
            .replace(/^(videos|audios|assets|songs)\//, "")
            .replace(/\.[^/.]+$/, "");

      if (cleanAssetId) {
        return `https://res.cloudinary.com/m2c8oqxz/video/upload/so_${second},w_160,h_90,c_fill,q_auto,f_jpg/videos/${cleanAssetId}.jpg`;
      }
      return "";
    },
    [fullVideoKey, videoKey, songId],
  );

  // Seekbar mouse move & hover preview
  const handleSeekMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const sb = seekbarRef.current;
    if (!sb || !duration || duration <= 0) return;

    const rect = sb.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const targetSec = Math.floor(pct * duration);

    setHoverTime(targetSec);
    setIsHoveringSeek(true);

    // Clamp preview box horizontally
    const halfBox = 80;
    let clampedX = e.clientX - rect.left;
    if (clampedX < halfBox) clampedX = halfBox;
    if (clampedX > rect.width - halfBox) clampedX = rect.width - halfBox;
    setHoverPreviewX(clampedX);

    // Fetch or cache frame image
    const thumbUrl = getThumbnailUrl(targetSec);
    if (thumbUrl) {
      if (frameCache.current.has(targetSec)) {
        setHoverThumbUrl(frameCache.current.get(targetSec)!);
      } else {
        const img = new Image();
        img.src = thumbUrl;
        img.onload = () => {
          frameCache.current.set(targetSec, thumbUrl);
          setHoverThumbUrl(thumbUrl);
        };
      }
    }
  };

  const handleSeekMouseLeave = () => {
    if (!isDraggingSeekbar.current) {
      setIsHoveringSeek(false);
    }
  };

  // Perform seek to clientX percentage
  const performSeek = (clientX: number) => {
    const sb = seekbarRef.current;
    const v = videoRef.current;
    if (!sb || !v || !duration || duration <= 0) return;

    const rect = sb.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const targetSec = pct * duration;

    v.currentTime = targetSec;
    setCurrentTime(targetSec);
    currentTimeRef.current = targetSec;
    playerActions.setCurrentTime(targetSec);
  };

  const handleSeekMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    isDraggingSeekbar.current = true;
    performSeek(e.clientX);

    const onMouseMove = (ev: MouseEvent) => {
      if (isDraggingSeekbar.current) {
        performSeek(ev.clientX);
      }
    };

    const onMouseUp = () => {
      isDraggingSeekbar.current = false;
      setIsHoveringSeek(false);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  // Skip relative seconds (+/- 10s)
  const skipSeconds = (seconds: number) => {
    const v = videoRef.current;
    if (!v || !duration) return;
    const nextTime = Math.max(0, Math.min(duration, v.currentTime + seconds));
    v.currentTime = nextTime;
    setCurrentTime(nextTime);
    currentTimeRef.current = nextTime;
    playerActions.setCurrentTime(nextTime);

    setSkipNotice({
      side: seconds < 0 ? "left" : "right",
      text: `${seconds > 0 ? "+" : ""}${seconds}s`,
    });
    if (skipNoticeTimeout.current) clearTimeout(skipNoticeTimeout.current);
    skipNoticeTimeout.current = setTimeout(() => {
      setSkipNotice(null);
    }, 600);
  };

  // Volume & Mute handling
  const handleVolumeChange = (newVol: number) => {
    const v = videoRef.current;
    if (!v) return;
    const clamped = Math.max(0, Math.min(1, newVol));
    v.volume = clamped;
    v.muted = clamped === 0;
    setVolume(clamped);
    setIsMuted(clamped === 0);
    playerActions.setVolume(clamped);
    playerActions.setIsMuted(clamped === 0);
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    const nextMuted = !v.muted;
    v.muted = nextMuted;
    setIsMuted(nextMuted);
    playerActions.setIsMuted(nextMuted);
  };

  // Picture in Picture
  const togglePip = async () => {
    const v = videoRef.current;
    if (!v) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await v.requestPictureInPicture();
      }
    } catch (err) {
      console.warn("Picture in Picture error:", err);
    }
  };

  // Fullscreen toggle
  const toggleFullscreen = async () => {
    const container = containerRef.current;
    if (!container) return;
    try {
      if (!document.fullscreenElement) {
        await container.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.warn("Fullscreen toggle error:", err);
    }
  };

  // Quality switch (Hls.js)
  const handleQualityChange = (levelIndex: number) => {
    if (hlsRef.current) {
      hlsRef.current.currentLevel = levelIndex;
      setSelectedQuality(levelIndex);
      setIsSettingsOpen(false);
      setSettingsTab("menu");
    }
  };

  // Playback speed switch
  const handleSpeedChange = (speed: number) => {
    const v = videoRef.current;
    if (v) {
      v.playbackRate = speed;
      setPlaybackSpeed(speed);
      setIsSettingsOpen(false);
      setSettingsTab("menu");
    }
  };

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable ||
        target.getAttribute("role") === "textbox"
      ) {
        return;
      }

      switch (e.code) {
        case "Space":
          e.preventDefault();
          e.stopPropagation();
          togglePlayPause();
          break;
        case "ArrowLeft":
          e.preventDefault();
          skipSeconds(-5);
          break;
        case "ArrowRight":
          e.preventDefault();
          skipSeconds(5);
          break;
        case "ArrowUp":
          e.preventDefault();
          handleVolumeChange(volume + 0.1);
          break;
        case "ArrowDown":
          e.preventDefault();
          handleVolumeChange(volume - 0.1);
          break;
        case "KeyM":
          e.preventDefault();
          toggleMute();
          break;
        case "KeyF":
          e.preventDefault();
          toggleFullscreen();
          break;
        case "Escape":
          e.preventDefault();
          handleClose();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [togglePlayPause, volume, handleClose]);

  // Video canvas click handler (single click = play/pause, double click = skip)
  const clickTimeout = useRef<NodeJS.Timeout | null>(null);
  const handleVideoCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const widthRatio = clickX / rect.width;

    if (e.detail === 2) {
      // Double click
      if (clickTimeout.current) clearTimeout(clickTimeout.current);
      if (widthRatio < 0.35) {
        skipSeconds(-10);
      } else if (widthRatio > 0.65) {
        skipSeconds(10);
      } else {
        toggleFullscreen();
      }
    } else if (e.detail === 1) {
      // Single click
      clickTimeout.current = setTimeout(() => {
        togglePlayPause();
      }, 220);
    }
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      onMouseMove={resetControlsTimeout}
      onPointerMove={resetControlsTimeout}
      className={`fixed inset-0 z-150 w-screen h-screen bg-black overflow-hidden select-none flex items-center justify-center ${
        areControlsVisible ? "cursor-default" : "cursor-none"
      }`}
    >
      {/* ─── Top Header Overlay ─── */}
      <div
        className={`absolute top-0 left-0 right-0 z-30 flex items-center justify-between p-4 sm:p-6 bg-linear-to-b from-black/90 via-black/40 to-transparent transition-opacity duration-300 pointer-events-auto ${
          areControlsVisible
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex flex-col min-w-0">
            <h2 className="text-white text-base sm:text-lg font-bold tracking-tight truncate max-w-xs sm:max-w-md md:max-w-xl">
              {title}
            </h2>
            <p className="text-zinc-400 text-xs sm:text-sm font-medium truncate">
              {artistName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Close Button */}
          <PlayerTooltip content="Close (Esc)" side="bottom">
            <button
              onClick={handleClose}
              className="p-2.5 rounded-full text-zinc-300 hover:text-white bg-white/10 hover:bg-white/20 backdrop-blur-md transition-all active:scale-95 focus:outline-none"
              aria-label="Close Full Video"
            >
              <X className="w-4 h-4" />
            </button>
          </PlayerTooltip>
        </div>
      </div>

      {/* ─── Edge-to-Edge Video Canvas ─── */}
      <div
        onClick={handleVideoCanvasClick}
        className="absolute inset-0 w-full h-full bg-black flex items-center justify-center cursor-pointer"
      >
        <video
          ref={videoRef}
          poster={posterUrl}
          playsInline
          crossOrigin="anonymous"
          className="w-full h-full object-contain pointer-events-none"
        />

        {/* Double-tap ripple notification */}
        {skipNotice && (
          <div
            className={`absolute z-20 flex items-center justify-center pointer-events-none transition-all duration-300 ${
              skipNotice.side === "left"
                ? "left-12 sm:left-24"
                : "right-12 sm:right-24"
            }`}
          >
            <div className="flex flex-col items-center gap-1.5 p-4 rounded-full bg-black/60 border border-white/20 backdrop-blur-md animate-pulse">
              {skipNotice.side === "left" ? (
                <RotateCcw className="w-8 h-8 text-white" />
              ) : (
                <RotateCw className="w-8 h-8 text-white" />
              )}
              <span className="text-xs font-bold font-mono text-white tracking-wider">
                {skipNotice.text}
              </span>
            </div>
          </div>
        )}

        {/* Single Sleek Minimalist Loading Spinner */}
        {isBuffering && !error && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
            <div className="w-14 h-14 rounded-full border-3 border-white/15 border-t-white animate-spin shadow-2xl" />
          </div>
        )}
      </div>

      {/* ─── Bottom Floating Glassmorphism Controls Dock ─── */}
      <div
        className={`absolute bottom-0 left-0 right-0 z-30 flex flex-col justify-end p-4 sm:p-6 bg-linear-to-t from-black/95 via-black/50 to-transparent transition-opacity duration-300 ${
          areControlsVisible
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
      >
        {/* Seekbar Container */}
        <div
          ref={seekbarRef}
          onMouseMove={handleSeekMouseMove}
          onMouseLeave={handleSeekMouseLeave}
          onMouseDown={handleSeekMouseDown}
          className="relative w-full py-3 cursor-pointer group flex items-center"
        >
          {/* Hover Frame Thumbnail Preview Box */}
          {isHoveringSeek && duration > 0 && (
            <div
              style={{ left: `${hoverPreviewX}px` }}
              className="absolute bottom-9 transform -translate-x-1/2 pointer-events-none z-50 flex flex-col items-center animate-in fade-in zoom-in-95 duration-150"
            >
              <div className="w-40 h-[90px] rounded-lg border border-white/40 shadow-2xl overflow-hidden bg-black relative flex flex-col justify-end">
                {hoverThumbUrl ? (
                  <div
                    style={{ backgroundImage: `url("${hoverThumbUrl}")` }}
                    className="absolute inset-0 bg-cover bg-center bg-no-repeat"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-zinc-900 text-zinc-500 text-[10px]">
                    Previewing...
                  </div>
                )}
                {/* Time pill inside preview */}
                <div className="relative z-10 self-center mb-1.5 px-2 py-0.5 rounded bg-black/85 border border-white/25 text-[11px] font-mono font-bold text-white shadow-md">
                  {formatTime(hoverTime)}
                </div>
              </div>
            </div>
          )}

          {/* Seekbar Track */}
          <div className="relative w-full h-1.5 group-hover:h-2 rounded-full bg-white/20 transition-all duration-150 overflow-hidden">
            {/* Buffered bar */}
            <div
              style={{ width: `${bufferedPct}%` }}
              className="absolute top-0 bottom-0 left-0 bg-white/30 rounded-full transition-all duration-300"
            />
            {/* Played progress bar */}
            <div
              style={{ width: `${progressPercent}%` }}
              className="absolute top-0 bottom-0 left-0 bg-white rounded-full"
            />
          </div>

          {/* Seekbar Thumb */}
          <div
            style={{ left: `${progressPercent}%` }}
            className="absolute w-3.5 h-3.5 bg-white rounded-full shadow-lg transform -translate-x-1/2 scale-0 group-hover:scale-100 transition-transform duration-150 pointer-events-none"
          />
        </div>

        {/* Control Bar Actions */}
        <div className="flex items-center justify-between pt-1 text-white">
          {/* Left Controls */}
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Play / Pause Button */}
            <button
              onClick={togglePlayPause}
              className="p-2 sm:p-2.5 rounded-full hover:bg-white/15 active:scale-95 transition-all text-white focus:outline-none"
              aria-label={isPlaying ? "Pause (Space)" : "Play (Space)"}
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 fill-current" />
              ) : (
                <Play className="w-5 h-5 fill-current ml-0.5" />
              )}
            </button>

            {/* Skip Backward 10s */}
            <button
              onClick={() => skipSeconds(-10)}
              className="p-2 rounded-full hover:bg-white/15 active:scale-95 transition-all text-zinc-300 hover:text-white hidden sm:flex items-center justify-center focus:outline-none"
              aria-label="Skip backward 10s"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Skip Forward 10s */}
            <button
              onClick={() => skipSeconds(10)}
              className="p-2 rounded-full hover:bg-white/15 active:scale-95 transition-all text-zinc-300 hover:text-white hidden sm:flex items-center justify-center focus:outline-none"
              aria-label="Skip forward 10s"
            >
              <RotateCw className="w-4 h-4" />
            </button>

            {/* Volume Control */}
            <div className="flex items-center gap-2 group/volume relative">
              <button
                onClick={toggleMute}
                className="p-2 rounded-full hover:bg-white/15 active:scale-95 transition-all text-zinc-300 hover:text-white focus:outline-none"
                aria-label={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-5 h-5" />
                ) : volume < 0.5 ? (
                  <Volume1 className="w-5 h-5" />
                ) : (
                  <Volume2 className="w-5 h-5" />
                )}
              </button>

              <div className="w-0 group-hover/volume:w-20 sm:group-hover/volume:w-24 overflow-hidden transition-all duration-200 flex items-center">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.02"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className="w-full h-1 bg-white/20 accent-white rounded-lg cursor-pointer"
                  aria-label="Volume Slider"
                />
              </div>
            </div>

            {/* Timestamps */}
            <div className="text-xs font-mono font-medium tracking-wider text-zinc-300 flex items-center gap-1 select-none">
              <span>{formatTime(currentTime)}</span>
              <span className="text-zinc-600">/</span>
              <span className="text-zinc-500">{formatTime(duration)}</span>
            </div>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-2 sm:gap-3 relative">
            {/* Settings Menu Button (Quality & Speed) */}
            <div className="relative">
              <button
                onClick={() => {
                  setIsSettingsOpen(!isSettingsOpen);
                  setSettingsTab("menu");
                }}
                className={`p-2 rounded-full transition-all focus:outline-none ${
                  isSettingsOpen
                    ? "bg-white text-black"
                    : "text-zinc-300 hover:text-white hover:bg-white/15"
                }`}
                aria-label="Settings"
              >
                <Settings className="w-4 h-4" />
              </button>

              {/* Settings Dropdown Popover */}
              {isSettingsOpen && (
                <div className="absolute right-0 bottom-12 w-48 rounded-xl bg-zinc-950/95 border border-white/15 backdrop-blur-2xl p-1.5 shadow-2xl flex flex-col gap-1 z-50 text-xs">
                  {settingsTab === "menu" && (
                    <>
                      {qualities.length > 0 && (
                        <button
                          onClick={() => setSettingsTab("quality")}
                          className="flex items-center justify-between px-3 py-2 rounded-lg text-zinc-300 hover:text-white hover:bg-white/10 transition text-left"
                        >
                          <span>Quality</span>
                          <span className="text-zinc-500 font-mono">
                            {selectedQuality === -1
                              ? "Auto"
                              : qualities[selectedQuality]?.label || "Auto"}
                          </span>
                        </button>
                      )}
                      <button
                        onClick={() => setSettingsTab("speed")}
                        className="flex items-center justify-between px-3 py-2 rounded-lg text-zinc-300 hover:text-white hover:bg-white/10 transition text-left"
                      >
                        <span>Playback Speed</span>
                        <span className="text-zinc-500 font-mono">
                          {playbackSpeed === 1 ? "Normal" : `${playbackSpeed}x`}
                        </span>
                      </button>
                    </>
                  )}

                  {settingsTab === "quality" && (
                    <>
                      <div className="flex items-center gap-2 px-2 py-1 border-b border-white/10 text-zinc-400 font-semibold mb-1">
                        <button
                          onClick={() => setSettingsTab("menu")}
                          className="hover:text-white"
                        >
                          ←
                        </button>
                        <span>Select Quality</span>
                      </div>
                      <button
                        onClick={() => handleQualityChange(-1)}
                        className={`flex items-center justify-between px-3 py-1.5 rounded-lg transition ${
                          selectedQuality === -1
                            ? "bg-white/20 text-white font-bold"
                            : "text-zinc-300 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        <span>Auto</span>
                        {selectedQuality === -1 && <Check className="w-3.5 h-3.5" />}
                      </button>
                      {qualities.map((lvl) => (
                        <button
                          key={lvl.id}
                          onClick={() => handleQualityChange(lvl.id)}
                          className={`flex items-center justify-between px-3 py-1.5 rounded-lg transition ${
                            selectedQuality === lvl.id
                              ? "bg-white/20 text-white font-bold"
                              : "text-zinc-300 hover:bg-white/10 hover:text-white"
                          }`}
                        >
                          <span>{lvl.label}</span>
                          {selectedQuality === lvl.id && (
                            <Check className="w-3.5 h-3.5" />
                          )}
                        </button>
                      ))}
                    </>
                  )}

                  {settingsTab === "speed" && (
                    <>
                      <div className="flex items-center gap-2 px-2 py-1 border-b border-white/10 text-zinc-400 font-semibold mb-1">
                        <button
                          onClick={() => setSettingsTab("menu")}
                          className="hover:text-white"
                        >
                          ←
                        </button>
                        <span>Playback Speed</span>
                      </div>
                      {[0.5, 0.75, 1, 1.25, 1.5, 2].map((spd) => (
                        <button
                          key={spd}
                          onClick={() => handleSpeedChange(spd)}
                          className={`flex items-center justify-between px-3 py-1.5 rounded-lg transition ${
                            playbackSpeed === spd
                              ? "bg-white/20 text-white font-bold"
                              : "text-zinc-300 hover:bg-white/10 hover:text-white"
                          }`}
                        >
                          <span>{spd === 1 ? "Normal (1x)" : `${spd}x`}</span>
                          {playbackSpeed === spd && (
                            <Check className="w-3.5 h-3.5" />
                          )}
                        </button>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Picture in Picture */}
            {isPipAvailable && (
              <PlayerTooltip content="Picture-in-Picture" side="top">
                <button
                  onClick={togglePip}
                  className="p-2 rounded-full hover:bg-white/15 active:scale-95 transition-all text-zinc-300 hover:text-white focus:outline-none"
                  aria-label="Picture-in-Picture"
                >
                  <PictureInPicture2 className="w-4 h-4" />
                </button>
              </PlayerTooltip>
            )}

            {/* Fullscreen Button */}
            <PlayerTooltip
              content={isFullscreen ? "Exit Fullscreen (F)" : "Fullscreen (F)"}
              side="top"
            >
              <button
                onClick={toggleFullscreen}
                className="p-2 rounded-full hover:bg-white/15 active:scale-95 transition-all text-zinc-300 hover:text-white focus:outline-none"
                aria-label="Toggle Fullscreen"
              >
                {isFullscreen ? (
                  <Minimize className="w-4 h-4" />
                ) : (
                  <Maximize className="w-4 h-4" />
                )}
              </button>
            </PlayerTooltip>
          </div>
        </div>
      </div>

      {/* ─── Error Overlay ─── */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/90 z-40 p-6">
          <div className="max-w-md text-center p-6 rounded-2xl bg-zinc-950 border border-white/15 shadow-2xl flex flex-col items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center font-bold text-sm">
              !
            </div>
            <p className="text-white font-semibold text-base">
              Video Playback Error
            </p>
            <p className="text-zinc-400 text-xs leading-relaxed">{error}</p>
            <button
              onClick={handleClose}
              className="mt-2 px-5 py-2 rounded-xl bg-white text-black text-xs font-bold hover:bg-zinc-200 transition"
            >
              Return to Audio
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
