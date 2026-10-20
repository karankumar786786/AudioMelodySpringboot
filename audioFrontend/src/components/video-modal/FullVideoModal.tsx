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
import { getVideoABRUrl, getVideoUrl } from "@/lib/image-utils";
import { resolveHlsUrl } from "@/lib/player-utils";
import type { FullVideoModalProps } from "./types";
import { Maximize2, Minimize2, PictureInPicture2, Sparkles, X } from "lucide-react";
import { PlayerTooltip } from "@/components/player/PlayerTooltip";
import "@imagekit/video-player/styles.css";

const IMAGEKIT_ID = process.env.NEXT_PUBLIC_IMAGEKIT_ID || "hc29ms4ul";

export const FullVideoModal: FC<FullVideoModalProps> = ({
  hlsUrl,
  dashUrl,
  fullVideoKey,
  title,
  artistName,
  posterUrl,
  songId,
  initialTime,
  onClose,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoWrapperRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playerRef = useRef<any>(null);

  // Subscribe to TanStack player store for bi-directional synchronization
  const storeIsPlaying = useStore(playerStore, (s) => s.isPlaying);
  const storeVolume = useStore(playerStore, (s) => s.volume);
  const storeIsMuted = useStore(playerStore, (s) => s.isMuted);
  const storeSeekTarget = useStore(playerStore, (s) => s.seekTarget);

  const isCurrentSong = songId
    ? playerStore.state.currentSong?.id === songId
    : true;

  // Starting time snapshot
  const startTimeRef = useRef<number>(
    typeof initialTime === "number" && initialTime >= 0
      ? initialTime
      : isCurrentSong
        ? playerStore.state.currentTime || 0
        : 0,
  );

  const currentTimeRef = useRef<number>(startTimeRef.current);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [areControlsVisible, setAreControlsVisible] = useState(true);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const toggleFullscreenRef = useRef<() => void>(() => {});

  const resetControlsTimeout = useCallback(() => {
    setAreControlsVisible(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      const p = playerRef.current;
      if (p && typeof p.paused === "function" && !p.paused()) {
        setAreControlsVisible(false);
      }
    }, 2800);
  }, []);

  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, []);

  // Resolve best video source (Cloudinary HLS, DASH, or ImageKit ABR)
  const resolveEffectiveSource = useCallback(() => {
    // 1. Explicit HLS URL (e.g. Cloudinary sp_auto HLS stream)
    if (hlsUrl) {
      return { src: hlsUrl, type: "application/x-mpegURL" };
    }
    // 2. DASH URL
    if (dashUrl) {
      return { src: dashUrl, type: "application/dash+xml" };
    }
    // 3. ImageKit stored videos
    if (fullVideoKey && (fullVideoKey.startsWith("/songs/") || fullVideoKey.startsWith("songs/"))) {
      const ikAbr = getVideoABRUrl(fullVideoKey);
      if (ikAbr) return { src: ikAbr, type: "application/x-mpegURL" };
      const ikDirect = getVideoUrl(fullVideoKey);
      if (ikDirect) return { src: ikDirect, type: "video/mp4" };
    }
    // 4. Cloudinary video key fallback
    if (fullVideoKey) {
      const cldHls = resolveHlsUrl(fullVideoKey);
      if (cldHls) return { src: cldHls, type: "application/x-mpegURL" };
    }
    return { src: "", type: "video/mp4" };
  }, [fullVideoKey, hlsUrl, dashUrl]);

  // Activate video mode in store
  useEffect(() => {
    playerActions.setIsVideoActive(true);
    return () => {
      const p = playerRef.current;
      const finalTime = p && typeof p.currentTime === "function" && isFinite(p.currentTime())
        ? p.currentTime()
        : currentTimeRef.current;

      if (isCurrentSong && typeof finalTime === "number" && isFinite(finalTime) && finalTime >= 0) {
        playerActions.seek(finalTime);
        playerActions.setCurrentTime(finalTime);
      }
      playerActions.setIsVideoActive(false);
    };
  }, [isCurrentSong]);

  // Initialize Video Player (ImageKit or Cloudinary HLS via Video.js)
  useEffect(() => {
    let isDisposed = false;
    const wrapper = videoWrapperRef.current;
    if (!wrapper) return;

    // Create video element dynamically for Video.js lifecycle
    const videoEl = document.createElement("video");
    videoEl.className = "video-js vjs-default-skin vjs-big-play-centered vjs-waiting w-full h-full object-contain";
    videoEl.setAttribute("playsinline", "true");
    videoEl.setAttribute("crossorigin", "anonymous");
    wrapper.appendChild(videoEl);

    setIsLoading(true);
    setError(null);

    const init = async () => {
      try {
        const { videoPlayer } = await import("@imagekit/video-player");
        if (isDisposed) return;

        const { src, type } = resolveEffectiveSource();
        if (!src) {
          setError("No valid video stream URL available for this track.");
          setIsLoading(false);
          return;
        }

        const isImageKitStream = Boolean(src && src.includes("ik.imagekit.io"));
        const ikPluginOptions = {
          imagekitId: IMAGEKIT_ID,
          seekThumbnails: isImageKitStream,
        };

        const player = videoPlayer(
          videoEl,
          ikPluginOptions,
          {
            autoplay: true,
            controls: true,
            fill: true,
            fluid: false,
            responsive: true,
            preload: "auto",
            playbackRates: [0.5, 0.75, 1, 1.25, 1.5, 2],
            controlBar: {
              pictureInPictureToggle: true,
              fullscreenToggle: true,
              playbackRateMenuButton: true,
              volumePanel: { inline: false },
            },
            poster: posterUrl,
          },
        );

        playerRef.current = player;

        player.ready(() => {
          if (isDisposed) return;

          player.src({ src, type });

          const startTime = startTimeRef.current;
          if (startTime > 0) {
            player.currentTime(startTime);
          }

          const targetVol = Math.max(0, Math.min(1, storeVolume));
          player.volume(targetVol);
          player.muted(storeIsMuted || targetVol === 0);

          player.play()?.catch(() => {
            // Autoplay policy fallback
          });

          setIsLoading(false);
        });

        // Route Video.js internal fullscreen button to container fullscreen
        player.requestFullscreen = () => {
          toggleFullscreenRef.current();
          return Promise.resolve();
        };
        player.exitFullscreen = () => {
          toggleFullscreenRef.current();
          return Promise.resolve();
        };

        player.on("timeupdate", () => {
          const t = player.currentTime();
          if (typeof t === "number" && isFinite(t)) {
            currentTimeRef.current = t;
          }
        });

        player.on("play", () => {
          playerActions.setIsPlaying(true);
          resetControlsTimeout();
        });

        player.on("pause", () => {
          playerActions.setIsPlaying(false);
          setAreControlsVisible(true);
        });

        player.on("waiting", () => {
          setIsLoading(true);
        });

        player.on("canplay", () => {
          setIsLoading(false);
        });

        player.on("playing", () => {
          setIsLoading(false);
        });

        player.on("error", () => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const err = (player.error && player.error()) as any;
          setError(err?.message || "Failed to load video stream.");
          setIsLoading(false);
        });

        player.on("ended", () => {
          playerActions.setCurrentTime(0);
          playerActions.setSeekTarget(null);
          if (typeof window !== "undefined") {
            localStorage.setItem("last_current_time", "0");
          }
          playerActions.setIsVideoActive(false);
          onClose(0);
          playerActions.next();
        });
      } catch (err: unknown) {
        if (!isDisposed) {
          setError((err as Error)?.message || "Failed to initialize ImageKit Video Player");
          setIsLoading(false);
        }
      }
    };

    init();

    return () => {
      isDisposed = true;
      if (playerRef.current) {
        try {
          playerRef.current.dispose();
        } catch {}
        playerRef.current = null;
      }
      if (wrapper) {
        wrapper.innerHTML = "";
      }
    };
  }, [resolveEffectiveSource, posterUrl, storeVolume, storeIsMuted, onClose]);

  // Two-way sync: external play/pause
  useEffect(() => {
    const p = playerRef.current;
    if (!p) return;
    try {
      if (storeIsPlaying && p.paused && p.paused()) {
        p.play()?.catch(() => {});
      } else if (!storeIsPlaying && p.paused && !p.paused()) {
        p.pause();
      }
    } catch {}
  }, [storeIsPlaying]);

  // Two-way sync: external seek
  useEffect(() => {
    if (typeof storeSeekTarget === "number" && isFinite(storeSeekTarget)) {
      const p = playerRef.current;
      if (p && typeof p.currentTime === "function") {
        try {
          if (Math.abs(p.currentTime() - storeSeekTarget) > 0.5) {
            p.currentTime(storeSeekTarget);
          }
        } catch {}
      }
    }
  }, [storeSeekTarget]);

  // Two-way sync: volume & mute
  useEffect(() => {
    const p = playerRef.current;
    if (!p) return;
    try {
      const targetVol = Math.max(0, Math.min(1, storeVolume));
      if (typeof p.volume === "function") p.volume(targetVol);
      if (typeof p.muted === "function") p.muted(storeIsMuted || targetVol === 0);
    } catch {}
  }, [storeVolume, storeIsMuted]);

  // Fullscreen state listener
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

  // Close handler with audio position handoff
  const handleClose = useCallback(() => {
    const p = playerRef.current;
    const finalTime = p && typeof p.currentTime === "function" && isFinite(p.currentTime())
      ? p.currentTime()
      : currentTimeRef.current;

    if (p) {
      try {
        p.pause();
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

  // Fullscreen toggle for entire modal container
  const toggleFullscreen = useCallback(() => {
    const doc = document as any;
    const isDocFs = Boolean(
      doc.fullscreenElement ||
      doc.webkitFullscreenElement ||
      doc.mozFullScreenElement ||
      doc.msFullscreenElement
    );

    if (isDocFs) {
      if (doc.exitFullscreen) {
        doc.exitFullscreen().catch(() => {});
      } else if (doc.webkitExitFullscreen) {
        doc.webkitExitFullscreen();
      }
    } else {
      const container = containerRef.current;
      if (container?.requestFullscreen) {
        container.requestFullscreen().catch(() => {
          const p = playerRef.current;
          if (p?.requestFullscreen) p.requestFullscreen();
        });
      } else if ((container as any)?.webkitRequestFullscreen) {
        (container as any).webkitRequestFullscreen();
      }
    }
  }, []);

  toggleFullscreenRef.current = toggleFullscreen;

  // PiP toggle
  const togglePip = useCallback(() => {
    const p = playerRef.current;
    if (p && p.tech_?.el_) {
      const videoEl = p.tech_.el_ as HTMLVideoElement;
      if (document.pictureInPictureEnabled && videoEl) {
        if (document.pictureInPictureElement) {
          document.exitPictureInPicture().catch(() => {});
        } else {
          videoEl.requestPictureInPicture().catch(() => {});
        }
      }
    }
  }, []);

  // Keyboard shortcut listener (ESC, F, P)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
      } else if (e.key.toLowerCase() === "f") {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key.toLowerCase() === "p") {
        e.preventDefault();
        togglePip();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleClose, toggleFullscreen, togglePip]);

  return (
    <div
      ref={containerRef}
      onMouseMove={resetControlsTimeout}
      onPointerMove={resetControlsTimeout}
      className={`fixed inset-0 z-150 w-screen h-screen bg-black overflow-hidden select-none flex items-center justify-center ${
        areControlsVisible ? "cursor-default" : "cursor-none"
      }`}
    >
      {/* Top Header Controls Overlay */}
      <div
        className={`absolute top-0 left-0 right-0 z-30 flex items-center justify-between p-4 sm:p-6 bg-linear-to-b from-black/90 via-black/40 to-transparent transition-opacity duration-300 pointer-events-auto ${
          areControlsVisible ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-white text-base sm:text-lg font-bold tracking-tight truncate max-w-xs sm:max-w-md md:max-w-xl">
                {title}
              </h2>
              <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-white/10 text-zinc-200 border border-white/20">
                <Sparkles className="w-3 h-3 text-white/80" />
                Thumbnail Seeker Active
              </span>
            </div>
            <p className="text-zinc-400 text-xs sm:text-sm font-medium truncate">
              {artistName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* PiP Button */}
          <PlayerTooltip content="Picture in Picture (P)" side="bottom">
            <button
              onClick={togglePip}
              className="p-2.5 rounded-full text-zinc-300 hover:text-white bg-white/10 hover:bg-white/20 backdrop-blur-md transition-all active:scale-95 focus:outline-none"
              aria-label="Picture in Picture"
            >
              <PictureInPicture2 className="w-4 h-4" />
            </button>
          </PlayerTooltip>

          {/* Fullscreen Button */}
          <PlayerTooltip content={isFullscreen ? "Exit Fullscreen (F)" : "Fullscreen (F)"} side="bottom">
            <button
              onClick={toggleFullscreen}
              className="p-2.5 rounded-full text-zinc-300 hover:text-white bg-white/10 hover:bg-white/20 backdrop-blur-md transition-all active:scale-95 focus:outline-none"
              aria-label="Toggle Fullscreen"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </PlayerTooltip>

          {/* Close Button */}
          <PlayerTooltip content="Close Video (Esc)" side="bottom">
            <button
              onClick={handleClose}
              className="p-2.5 rounded-full text-zinc-300  bg-white/10 hover:bg-rose-500/30 hover:text-rose-300 backdrop-blur-md transition-all active:scale-95 focus:outline-none"
              aria-label="Close Full Video"
            >
              <X className="w-4 h-4" />
            </button>
          </PlayerTooltip>
        </div>
      </div>

      {/* Edge-to-Edge Full-Screen Video Canvas */}
      <div
        ref={videoWrapperRef}
        onDoubleClick={toggleFullscreen}
        className="absolute inset-0 w-full h-full bg-black flex items-center justify-center overflow-hidden [&_.video-js]:w-full! [&_.video-js]:h-full! [&_.video-js]:max-w-full! [&_.video-js]:max-h-full! [&_.vjs-tech]:w-full! [&_.vjs-tech]:h-full! [&_.vjs-tech]:object-contain! [&_.vjs-poster]:bg-contain!"
      />



      {/* Error State */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/90 z-25 p-6">
          <div className="max-w-md text-center p-6 rounded-2xl bg-zinc-900/90 border border-white/10 shadow-2xl flex flex-col items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold">!</div>
            <p className="text-white font-semibold text-base">Video Playback Error</p>
            <p className="text-zinc-400 text-xs leading-relaxed">{error}</p>
            <button
              onClick={handleClose}
              className="mt-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition"
            >
              Return to Audio
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
