"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import {
  X,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Maximize,
  Radio,
  Sparkles,
  RotateCcw,
  Share2,
} from "lucide-react";
import { useStore } from "@tanstack/react-store";
import { playerStore, playerActions } from "@/store/player.store";
import { getImageUrl, getVideoUrl } from "@/lib/image-utils";
import { useLyrics, type TranscriptionEntry } from "./hooks/useLyrics";
import { toast } from "sonner";
import { LyricCardModal } from "./LyricCardModal";

interface ZenFocusOverlayProps {
  analyser?: AnalyserNode | null;
  currentTime: number;
  duration: number;
  solidBgColor: string;
  onSeek: (time: number) => void;
  transcriptions?: TranscriptionEntry[];
  plainLyrics?: string | null;
  isLoading?: boolean;
  buffered?: number;
}

export const ZenFocusOverlay: React.FC<ZenFocusOverlayProps> = ({
  analyser,
  currentTime,
  duration,
  solidBgColor,
  onSeek,
  transcriptions: transcriptionsProp,
  plainLyrics: plainLyricsProp,
  isLoading: isLoadingProp,
  buffered = 0,
}) => {
  const isZenMode = useStore(playerStore, (s) => s.isZenMode);
  const currentSong = useStore(playerStore, (s) => s.currentSong);
  const isPlaying = useStore(playerStore, (s) => s.isPlaying);
  const volume = useStore(playerStore, (s) => s.volume);
  const isMuted = useStore(playerStore, (s) => s.isMuted);
  const radioSession = useStore(playerStore, (s) => s.radioSession);

  // Canvas Looping Video (Spotify-style short video loop)
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoKey = currentSong?.videoKey;
  const canvasVideoUrl = videoKey ? getVideoUrl(videoKey) : undefined;

  // Sync canvas video playback with audio player state
  useEffect(() => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.play().catch(() => {});
    } else {
      videoRef.current.pause();
    }
  }, [isPlaying, canvasVideoUrl]);

  // Fallback to internal hook if props are not supplied
  const fallbackLyrics = useLyrics(
    transcriptionsProp ? undefined : (currentSong?.lrclibId || currentSong?.captionUrl),
    currentTime
  );
  const transcriptions = transcriptionsProp ?? fallbackLyrics.transcriptions;
  const plainLyrics = plainLyricsProp ?? fallbackLyrics.plainLyrics;
  const isLyricsLoading = isLoadingProp ?? fallbackLyrics.isLoading;

  const activeLineRef = useRef<HTMLDivElement | null>(null);
  const lyricsContainerRef = useRef<HTMLDivElement | null>(null);
  const isUserScrolledRef = useRef(false);
  const isProgrammaticScrollRef = useRef(false);
  const programmaticScrollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const autoResyncTimerRef = useRef<NodeJS.Timeout | null>(null);
  const prevTimeRef = useRef(currentTime);
  const lastActiveIndexRef = useRef(-1);

  const [isUserScrolled, setIsUserScrolled] = useState(false);
  const [isLyricCardModalOpen, setIsLyricCardModalOpen] = useState(false);
  const [selectedLyricForCard, setSelectedLyricForCard] = useState("");

  // Auto-hide Exit (Esc/Z) button on inactivity for deep Zen Focus
  const [showExitButton, setShowExitButton] = useState(true);
  const hideButtonTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef(Date.now());

  const resetHideTimer = useCallback(() => {
    // Debounce: ignore calls within 200ms of the last one to prevent flicker from rapid events
    const now = Date.now();
    if (now - lastActivityRef.current < 200) return;
    lastActivityRef.current = now;

    setShowExitButton(true);
    if (hideButtonTimerRef.current) {
      clearTimeout(hideButtonTimerRef.current);
    }
    hideButtonTimerRef.current = setTimeout(() => {
      setShowExitButton(false);
    }, 2500);
  }, []);

  useEffect(() => {
    hideButtonTimerRef.current = setTimeout(() => {
      setShowExitButton(false);
    }, 2500);

    const onActivity = () => {
      resetHideTimer();
    };

    window.addEventListener("mousemove", onActivity);
    window.addEventListener("touchstart", onActivity);
    window.addEventListener("keydown", onActivity);

    return () => {
      if (hideButtonTimerRef.current) clearTimeout(hideButtonTimerRef.current);
      window.removeEventListener("mousemove", onActivity);
      window.removeEventListener("touchstart", onActivity);
      window.removeEventListener("keydown", onActivity);
    };
  }, [resetHideTimer]);

  // Determine active transcription line index with zero gap holes
  let activeIndex = -1;
  if (transcriptions && transcriptions.length > 0) {
    for (let i = 0; i < transcriptions.length; i++) {
      const line = transcriptions[i];
      const nextLine = transcriptions[i + 1];
      if (
        currentTime >= line.start_time_seconds &&
        (!nextLine || currentTime < nextLine.start_time_seconds)
      ) {
        activeIndex = i;
        break;
      }
    }
  }

  // Smoothly center the active lyric line in container
  const scrollToActiveLine = useCallback((smooth = true) => {
    if (!activeLineRef.current) return;
    isProgrammaticScrollRef.current = true;
    activeLineRef.current.scrollIntoView({
      behavior: smooth ? "smooth" : "auto",
      block: "center",
    });

    if (programmaticScrollTimerRef.current) {
      clearTimeout(programmaticScrollTimerRef.current);
    }
    programmaticScrollTimerRef.current = setTimeout(() => {
      isProgrammaticScrollRef.current = false;
    }, 800);
  }, []);

  // Manual or automatic resync back to live audio
  const handleResync = useCallback((notify = false) => {
    if (autoResyncTimerRef.current) {
      clearTimeout(autoResyncTimerRef.current);
      autoResyncTimerRef.current = null;
    }
    isUserScrolledRef.current = false;
    setIsUserScrolled(false);
    scrollToActiveLine(true);
    if (notify) {
      toast.success("Lyrics synced with audio");
    }
  }, [scrollToActiveLine]);

  // Reset user scroll state on song change
  useEffect(() => {
    if (autoResyncTimerRef.current) {
      clearTimeout(autoResyncTimerRef.current);
      autoResyncTimerRef.current = null;
    }
    isUserScrolledRef.current = false;
    setIsUserScrolled(false);
    isProgrammaticScrollRef.current = false;
    prevTimeRef.current = 0;
    lastActiveIndexRef.current = -1;
  }, [currentSong?.id]);

  // Handle user manual scroll interaction with automatic resync timer
  const handleManualUserScroll = useCallback(() => {
    isUserScrolledRef.current = true;
    setIsUserScrolled(true);

    if (autoResyncTimerRef.current) {
      clearTimeout(autoResyncTimerRef.current);
    }

    autoResyncTimerRef.current = setTimeout(() => {
      isUserScrolledRef.current = false;
      setIsUserScrolled(false);
      scrollToActiveLine(true);
    }, 4000);
  }, [scrollToActiveLine]);

  const handleScroll = useCallback(() => {
    if (isProgrammaticScrollRef.current) return;

    if (isUserScrolledRef.current && activeLineRef.current && lyricsContainerRef.current) {
      const activeRect = activeLineRef.current.getBoundingClientRect();
      const containerRect = lyricsContainerRef.current.getBoundingClientRect();
      const isNearCenter =
        activeRect.top >= containerRect.top + 60 &&
        activeRect.bottom <= containerRect.bottom - 60;
      if (isNearCenter) {
        if (autoResyncTimerRef.current) {
          clearTimeout(autoResyncTimerRef.current);
          autoResyncTimerRef.current = null;
        }
        isUserScrolledRef.current = false;
        setIsUserScrolled(false);
      }
    }
  }, []);

  // Auto-resync when playback seeks or jumps significantly (> 1.5s delta)
  useEffect(() => {
    const timeDelta = Math.abs(currentTime - prevTimeRef.current);
    prevTimeRef.current = currentTime;

    if (timeDelta > 1.5) {
      if (autoResyncTimerRef.current) {
        clearTimeout(autoResyncTimerRef.current);
        autoResyncTimerRef.current = null;
      }
      isUserScrolledRef.current = false;
      setIsUserScrolled(false);
      scrollToActiveLine(true);
    }
  }, [currentTime, scrollToActiveLine]);

  // Auto-resync when lyrics advance ahead while playing
  useEffect(() => {
    if (activeIndex === -1) return;

    if (
      isUserScrolledRef.current &&
      lastActiveIndexRef.current !== -1 &&
      Math.abs(activeIndex - lastActiveIndexRef.current) >= 2 &&
      isPlaying
    ) {
      if (autoResyncTimerRef.current) {
        clearTimeout(autoResyncTimerRef.current);
        autoResyncTimerRef.current = null;
      }
      isUserScrolledRef.current = false;
      setIsUserScrolled(false);
      scrollToActiveLine(true);
    }

    lastActiveIndexRef.current = activeIndex;

    if (!isUserScrolledRef.current) {
      scrollToActiveLine(true);
    }
  }, [activeIndex, isPlaying, scrollToActiveLine]);

  // Immediately sync and scroll when lyrics or Zen Mode mounts / finishes loading
  useEffect(() => {
    if (isLyricsLoading || !transcriptions || transcriptions.length === 0) return;

    isUserScrolledRef.current = false;
    setIsUserScrolled(false);

    let raf2: number;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        scrollToActiveLine(false);
      });
    });

    const timer = setTimeout(() => {
      scrollToActiveLine(true);
    }, 250);

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      clearTimeout(timer);
    };
  }, [isLyricsLoading, transcriptions, scrollToActiveLine]);

  // Handle ESC or Z key to exit
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === "Escape" || e.key === "z" || e.key === "Z") && isZenMode) {
        // Prevent typing into input triggering exit
        const target = e.target as HTMLElement;
        if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
        playerActions.closeZenMode();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isZenMode]);

  if (!isZenMode || !currentSong) return null;

  const coverUrl = currentSong.imageKey
    ? getImageUrl(currentSong.imageKey, {
        width: 800,
        height: 800,
        aspectRatio: "1-1",
      })
    : (currentSong as any).posterUrl || "";

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return "0:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const hasSyncedLyrics = transcriptions && transcriptions.length > 0;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-3xl text-white flex flex-col justify-between p-4 sm:p-8 lg:p-10 select-none overflow-hidden"
      >
        {/* ─── Aesthetic Ambient Background: Looping Canvas Video or Blurred Album Art ─── */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 select-none">
          <AnimatePresence mode="wait">
            {canvasVideoUrl ? (
              /* Looping Canvas Video in Low Brightness for Canvas-enabled tracks */
              <motion.div
                key={`zen-canvas-video-${currentSong.id}-${videoKey}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.8 }}
                className="absolute inset-0 w-full h-full"
              >
                <video
                  ref={videoRef}
                  src={canvasVideoUrl}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-cover scale-105 filter brightness-[0.45] contrast-[1.08] saturate-[1.25]"
                />
                {/* Color Tint Overlay over video */}
                <div
                  style={{
                    background: `radial-gradient(ellipse 90% 80% at 50% 35%, ${solidBgColor}40 0%, ${solidBgColor}15 60%, rgba(0,0,0,0.85) 100%)`,
                  }}
                  className="absolute inset-0 mix-blend-screen"
                />
              </motion.div>
            ) : coverUrl ? (
              /* Blurred Song Image with Majority Background Color Blur */
              <motion.div
                key={`zen-blur-bg-${currentSong.id}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.8 }}
                className="absolute inset-0 w-full h-full"
              >
                <Image
                  src={coverUrl}
                  alt={currentSong.title}
                  fill
                  priority
                  className="object-cover blur-[85px] scale-125 opacity-35 saturate-150"
                />
                {/* Majority Song Color Ambient Glow Backdrop with Blur */}
                <div
                  style={{
                    background: `radial-gradient(ellipse 90% 75% at 50% 35%, ${solidBgColor}55 0%, ${solidBgColor}25 50%, rgba(0,0,0,0.92) 85%)`,
                  }}
                  className="absolute inset-0"
                />
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* Dynamic Audio Pulsing Aura */}
          <div
            aria-hidden="true"
            style={{
              background: `radial-gradient(ellipse 75% 65% at 50% 40%, ${solidBgColor}45 0%, ${solidBgColor}18 50%, transparent 80%)`,
            }}
            className={`absolute inset-0 transition-all duration-1000 ease-out blur-3xl ${
              isPlaying ? "scale-105 opacity-100" : "scale-100 opacity-40"
            }`}
          />

          {/* Cinematic Dark Vignette Overlay for Ultra-Crisp Lyric Legibility */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/35 to-black/80 pointer-events-none" />
        </div>

        {/* Floating Top-Right Exit Button (Auto-hides on inactivity for Zen Focus immersion) */}
        <div
          onMouseEnter={() => setShowExitButton(true)}
          className={`fixed top-4 right-4 sm:top-6 sm:right-7 z-50 transition-all duration-500 ${
            showExitButton
              ? "opacity-100 translate-y-0 pointer-events-auto"
              : "opacity-0 -translate-y-2 pointer-events-none"
          }`}
        >
          <button
            onClick={() => playerActions.closeZenMode()}
            style={{
              background:
                "linear-gradient(135deg, rgba(255, 255, 255, 0.18) 0%, rgba(255, 255, 255, 0.05) 100%), rgba(20, 20, 25, 0.45)",
              boxShadow:
                "inset 0 1px 1px 0 rgba(255, 255, 255, 0.45), inset 0 -1px 1px 0 rgba(0, 0, 0, 0.25), 0 12px 28px rgba(0, 0, 0, 0.5)",
            }}
            className="flex items-center gap-2 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full border border-white/25 text-xs font-medium text-white/80 hover:text-white transition-all cursor-pointer backdrop-blur-3xl backdrop-saturate-[190%] active:scale-95 hover:scale-105"
            title="Exit Zen Mode (Esc or Z)"
          >
            <span>Exit</span>
            <kbd className="hidden sm:inline px-1.5 py-0.5 text-[10px] bg-black/40 rounded border border-white/15 font-mono text-white/90">
              Esc / Z
            </kbd>
            <X size={14} className="ml-0.5" />
          </button>
        </div>

        {/* Center Section: Responsive Mobile Strip & Desktop High-Res Grid */}
        <main className="relative z-10 flex-1 flex flex-col lg:grid lg:grid-cols-12 gap-4 sm:gap-6 lg:gap-14 items-center min-h-0 overflow-hidden w-full max-w-7xl mx-auto my-auto">
          {/* Mobile Only: Compact Horizontal Track Header (Saves vertical space for lyrics) */}
          <div
            style={{
              background:
                "linear-gradient(135deg, rgba(255, 255, 255, 0.16) 0%, rgba(255, 255, 255, 0.04) 100%), rgba(20, 20, 25, 0.4)",
              boxShadow:
                "inset 0 1px 1px 0 rgba(255, 255, 255, 0.35), inset 0 -1px 1px 0 rgba(0, 0, 0, 0.2), 0 12px 30px rgba(0, 0, 0, 0.4)",
            }}
            className="flex lg:hidden items-center gap-3.5 w-full px-2 py-2 shrink-0 rounded-2xl border border-white/20 backdrop-blur-3xl backdrop-saturate-[190%]"
          >
            <div
              style={{
                boxShadow:
                  "inset 0 1px 1px 0 rgba(255, 255, 255, 0.3), 0 6px 20px rgba(0, 0, 0, 0.5)",
              }}
              className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-xl overflow-hidden border border-white/20 bg-zinc-900 shrink-0"
            >
              {coverUrl ? (
                <Image
                  src={coverUrl}
                  alt={currentSong.title}
                  fill
                  priority
                  className="object-cover"
                  sizes="56px"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-zinc-800/80 text-zinc-500">
                  <Radio size={20} />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <h1 className="text-base sm:text-lg font-black tracking-tight text-white truncate">
                {currentSong.title}
              </h1>
              <p className="text-xs sm:text-sm font-semibold text-white/50 truncate">
                {currentSong.artistName}
              </p>
            </div>
          </div>

          {/* Desktop Only: Grand High-Res Artwork & Metadata Column */}
          <div className="hidden lg:flex lg:col-span-5 flex-col items-start text-left space-y-6 shrink-0">
            <motion.div
              animate={{ scale: isPlaying ? 1 : 0.97 }}
              transition={{ duration: 0.6, ease: "easeInOut" }}
              style={{
                boxShadow:
                  "inset 0 1.5px 1px 0 rgba(255, 255, 255, 0.35)",
              }}
              className="relative w-72 h-72 lg:w-80 lg:h-80 xl:w-[380px] xl:h-[380px] rounded-3xl overflow-hidden border border-white/20 bg-zinc-900 group"
            >
              {coverUrl ? (
                <Image
                  src={coverUrl}
                  alt={currentSong.title}
                  fill
                  priority
                  className="object-cover"
                  sizes="(max-width: 1280px) 320px, 380px"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-zinc-800/80 text-zinc-600">
                  <Radio size={64} />
                </div>
              )}
              {/* Glass reflection overlay on album art */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    "linear-gradient(165deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.04) 25%, transparent 50%)",
                }}
              />
            </motion.div>

            <div className="space-y-2 max-w-md">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white line-clamp-2">
                {currentSong.title}
              </h1>
              <p className="text-base sm:text-lg font-semibold text-white/50 line-clamp-1">
                {currentSong.artistName}
              </p>
            </div>
          </div>

          {/* Lyrics Column: Live Synced Karaoke Lyrics with Silky Gradient Fade Mask */}
          <div className="flex-1 lg:col-span-7 h-full w-full flex flex-col justify-center min-h-0 overflow-hidden relative rounded-3xl">
            <div
              ref={lyricsContainerRef}
              onScroll={handleScroll}
              onWheel={handleManualUserScroll}
              onTouchMove={handleManualUserScroll}
              style={{
                maskImage:
                  "linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)",
                WebkitMaskImage:
                  "linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)",
              }}
              className="h-full w-full overflow-y-auto no-scrollbar py-24 sm:py-36 lg:py-44 pr-2 sm:pr-4 space-y-6 sm:space-y-8 text-left select-none relative"
            >
              {isLyricsLoading ? (
                <div className="flex items-center gap-3 text-white/50 font-medium animate-pulse py-16 justify-center">
                  <Sparkles size={18} className="text-white/40" />
                  <span className="text-sm">Loading synchronized lyrics...</span>
                </div>
              ) : hasSyncedLyrics ? (
                transcriptions.map((entry, idx) => {
                  const isActive = idx === activeIndex;
                  return (
                    <div
                      key={`${entry.start_time_seconds}-${idx}`}
                      id={isActive ? "active-zen-lyric-line" : undefined}
                      ref={isActive ? activeLineRef : null}
                      onClick={() => {
                        onSeek(entry.start_time_seconds);
                        handleResync(false);
                      }}
                      className={`group flex items-center justify-between gap-4 cursor-pointer transition-all duration-300 py-1.5 rounded-xl ${
                        isActive
                          ? "text-white scale-[1.02] origin-left"
                          : "text-white/25 hover:text-white/70 scale-100"
                      }`}
                    >
                      <div className="flex-1">
                        {entry.words && entry.words.length > 0 ? (
                          <div className="flex flex-wrap gap-x-2.5 sm:gap-x-3.5 gap-y-1 sm:gap-y-2">
                            {entry.words.map((word, wIdx) => {
                              const isWordActive =
                                currentTime >= word.start && currentTime <= word.end;
                              return (
                                <span
                                  key={wIdx}
                                  className={`text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-extrabold tracking-tight transition-all duration-100 ${
                                    isWordActive
                                      ? "text-white opacity-100"
                                      : isActive
                                        ? "text-white/80"
                                        : "text-white/25 hover:text-white/70"
                                  }`}
                                >
                                  {word.text}
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <p
                            className={`text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-extrabold tracking-tight transition-all duration-300 leading-snug ${
                              isActive
                                ? "text-white opacity-100"
                                : "text-white/25 hover:text-white/70"
                            }`}
                          >
                            {entry.transcript}
                          </p>
                        )}
                      </div>

                      {/* 1-Click Share Lyric Quote Card Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedLyricForCard(entry.transcript);
                          setIsLyricCardModalOpen(true);
                        }}
                        style={{
                          boxShadow:
                            "inset 0 1px 1px 0 rgba(255, 255, 255, 0.3), 0 4px 12px rgba(0, 0, 0, 0.3)",
                        }}
                        className="opacity-0 group-hover:opacity-100 p-2 rounded-full hover:bg-white/15 border border-transparent hover:border-white/20 text-white/40 hover:text-white transition-all cursor-pointer shrink-0 backdrop-blur-xl"
                        title="Share Lyric Quote"
                      >
                        <Share2 size={16} />
                      </button>
                    </div>
                  );
                })
              ) : plainLyrics ? (
                <div className="space-y-4 text-white/70 font-medium text-base sm:text-lg leading-relaxed py-8">
                  <div
                    style={{
                      background:
                        "linear-gradient(135deg, rgba(255, 255, 255, 0.18) 0%, rgba(255, 255, 255, 0.06) 100%), rgba(20, 20, 25, 0.4)",
                      boxShadow:
                        "inset 0 1px 1px 0 rgba(255, 255, 255, 0.4), 0 4px 12px rgba(0, 0, 0, 0.3)",
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-white/20 text-white/60 text-xs font-semibold mb-4 backdrop-blur-xl"
                  >
                    <span>Static lyrics</span>
                  </div>
                  {plainLyrics.split("\n").map((line, i) => (
                    <p key={i}>{line}</p>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
                  <div
                    style={{
                      background:
                        "linear-gradient(135deg, rgba(255, 255, 255, 0.14) 0%, rgba(255, 255, 255, 0.04) 100%), rgba(20, 20, 25, 0.35)",
                      boxShadow:
                        "inset 0 1px 1px 0 rgba(255, 255, 255, 0.35), 0 12px 30px rgba(0, 0, 0, 0.4)",
                    }}
                    className="w-20 h-20 rounded-3xl flex items-center justify-center border border-white/20 backdrop-blur-3xl backdrop-saturate-[190%]"
                  >
                    <Radio size={36} className="text-white/40 animate-pulse" />
                  </div>
                  <p className="text-lg font-medium text-white/50">
                    Immerse in the sound
                  </p>
                  <p className="text-xs text-white/30 max-w-xs">
                    No synchronized lyrics available for this track. Relax and enjoy the flow.
                  </p>
                </div>
              )}
            </div>

            {/* Quick Resync button when user has scrolled manually */}
            {isUserScrolled && (
              <button
                onClick={() => handleResync(true)}
                style={{
                  background:
                    "linear-gradient(135deg, rgba(255, 255, 255, 0.22) 0%, rgba(255, 255, 255, 0.08) 100%), rgba(20, 20, 25, 0.5)",
                  boxShadow:
                    "inset 0 1px 1px 0 rgba(255, 255, 255, 0.5), inset 0 -1px 1px 0 rgba(0, 0, 0, 0.25), 0 16px 36px rgba(0, 0, 0, 0.6)",
                }}
                className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 text-white text-xs font-semibold px-4.5 py-2.5 rounded-full border border-white/25 backdrop-blur-3xl backdrop-saturate-[190%] hover:scale-105 active:scale-95 transition-all cursor-pointer z-30"
              >
                <RotateCcw size={14} className="animate-spin-once" />
                <span>Sync Lyrics</span>
              </button>
            )}
          </div>
        </main>

        {/* Bottom Floating Glass Player Dock */}
        <footer className="relative z-10 flex flex-col items-center max-w-xl mx-auto w-full space-y-2.5 sm:space-y-3 shrink-0 pt-2">
          {/* Progress Slider with Buffer & Hover effect */}
          <div className="w-full flex items-center gap-3 select-none px-1">
            <span className="text-[11px] font-medium text-white/60 tabular-nums select-none min-w-[32px] text-right">
              {formatTime(currentTime)}
            </span>
            <div
              className="flex-1 h-1.5 hover:h-2.5 bg-white/20 hover:bg-white/25 border border-white/10 rounded-full overflow-hidden cursor-pointer relative transition-all group/seek backdrop-blur-md"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                onSeek(pos * duration);
              }}
            >
              {/* Buffered Progress Bar */}
              <div
                style={{
                  width: `${duration > 0 ? Math.min(100, Math.max(0, (buffered / duration) * 100)) : 0}%`,
                }}
                className="absolute left-0 top-0 bottom-0 bg-white/35 rounded-full pointer-events-none transition-all duration-200"
              />
              {/* Active Progress Bar */}
              <div
                style={{
                  width: `${duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0}%`,
                }}
                className="absolute left-0 top-0 bottom-0 bg-white rounded-full pointer-events-none transition-all shadow-[0_0_8px_rgba(255,255,255,0.4)]"
              />
            </div>
            <span className="text-[11px] font-medium text-white/60 tabular-nums select-none min-w-[32px]">
              {formatTime(duration)}
            </span>
          </div>

          {/* Controls Bar (Apple Liquid Frosted Glass Dock) */}
          <div
            style={{
              background:
                "linear-gradient(135deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0.07) 50%, rgba(255, 255, 255, 0.02) 100%), rgba(22, 22, 26, 0.45)",
              boxShadow:
                "inset 0 1.25px 1px 0 rgba(255, 255, 255, 0.5), inset 0 -1px 1px 0 rgba(0, 0, 0, 0.25), 0 24px 48px -12px rgba(0, 0, 0, 0.7), 0 8px 20px -4px rgba(0, 0, 0, 0.4)",
            }}
            className="flex items-center justify-between w-full px-4 sm:px-6 py-2 sm:py-2.5 rounded-full border border-white/25 backdrop-blur-3xl backdrop-saturate-[190%] backdrop-brightness-105"
          >
            {/* Volume Control (Toggle + Desktop Slider with Fill) */}
            <div
              onWheel={(e) => {
                e.preventDefault();
                if (isMuted) playerActions.setIsMuted(false);
                const delta = e.deltaY < 0 ? 0.05 : -0.05;
                playerActions.setVolume(Math.min(1, Math.max(0, volume + delta)));
              }}
              className="flex items-center gap-2"
            >
              <button
                type="button"
                onClick={() => playerActions.setIsMuted(!isMuted)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/12 active:bg-white/20 active:scale-90 transition-all cursor-pointer"
                title={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted || volume === 0 ? <VolumeX size={17} /> : <Volume2 size={17} />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  playerActions.setVolume(val);
                  if (isMuted) playerActions.setIsMuted(false);
                }}
                style={{
                  background: `linear-gradient(to right, #ffffff ${
                    isMuted ? 0 : Math.round(volume * 100)
                  }%, rgba(255, 255, 255, 0.22) ${
                    isMuted ? 0 : Math.round(volume * 100)
                  }%)`,
                }}
                className="w-16 sm:w-20 h-1.5 rounded-full appearance-none cursor-pointer accent-white hidden sm:block transition-all focus:outline-none"
                title="Volume slider"
              />
            </div>

            {/* Transport Buttons */}
            <div className="flex items-center gap-3 sm:gap-4">
              <button
                onClick={() => playerActions.previous()}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-white/80 hover:text-white hover:bg-white/12 active:bg-white/20 hover:scale-105 active:scale-90 transition-all cursor-pointer"
                title="Previous track"
              >
                <SkipBack size={19} />
              </button>

              <button
                onClick={() => playerActions.setIsPlaying(!isPlaying)}
                className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-white text-black flex items-center justify-center shadow-[0_4px_16px_rgba(255,255,255,0.3),0_2px_6px_rgba(0,0,0,0.3)] hover:scale-105 active:scale-95 transition-all cursor-pointer hover:bg-white/95"
                title={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? (
                  <Pause size={19} fill="black" />
                ) : (
                  <Play size={19} fill="black" className="translate-x-0.5" />
                )}
              </button>

              <button
                onClick={() => playerActions.next(true)}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-white/80 hover:text-white hover:bg-white/12 active:bg-white/20 hover:scale-105 active:scale-90 transition-all cursor-pointer"
                title="Next track"
              >
                <SkipForward size={19} />
              </button>
            </div>

            {/* Fullscreen Toggle */}
            <button
              onClick={() => {
                if (!document.fullscreenElement) {
                  document.documentElement.requestFullscreen().catch(() => {});
                } else {
                  document.exitFullscreen().catch(() => {});
                }
              }}
              className="w-8 h-8 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/12 active:bg-white/20 active:scale-90 transition-all cursor-pointer"
              title="Toggle Fullscreen"
            >
              <Maximize size={17} />
            </button>
          </div>
        </footer>

        {/* Viral Lyric Card Generator Modal */}
        {currentSong && (
          <LyricCardModal
            isOpen={isLyricCardModalOpen}
            onClose={() => setIsLyricCardModalOpen(false)}
            song={currentSong}
            initialLyric={selectedLyricForCard}
          />
        )}
      </motion.div>
    </AnimatePresence>
  );
};

