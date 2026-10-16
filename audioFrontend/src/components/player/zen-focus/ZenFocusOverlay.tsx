"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useStore } from "@tanstack/react-store";
import { playerStore, playerActions } from "@/store/player.store";
import { getImageUrl, getVideoUrl } from "@/lib/image-utils";
import { useLyrics } from "../hooks/useLyrics";
import { toast } from "sonner";
import type { ZenFocusOverlayProps } from "./types";
import { ZenBackground } from "./ZenBackground";
import { ZenExitButton } from "./ZenExitButton";
import { ZenTrackInfo } from "./ZenTrackInfo";
import { ZenLyricsView } from "./ZenLyricsView";
import { ZenControlsBar } from "./ZenControlsBar";

export const ZenFocusOverlay: React.FC<ZenFocusOverlayProps> = ({
  analyser: _analyser,
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

  // Auto-hide Exit (Esc/Z) button on inactivity for deep Zen Focus
  const [showExitButton, setShowExitButton] = useState(true);
  const hideButtonTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef(Date.now());

  const resetHideTimer = useCallback(() => {
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
        const target = e.target as HTMLElement;
        if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
        playerActions.closeZenMode();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isZenMode]);

  // Auto-exit Zen Mode if lyrics finish loading and there are none
  useEffect(() => {
    if (isZenMode && !isLyricsLoading && !transcriptions.length && !plainLyrics) {
      playerActions.closeZenMode();
    }
  }, [isZenMode, isLyricsLoading, transcriptions.length, plainLyrics]);

  if (!isZenMode || !currentSong || (!isLyricsLoading && !transcriptions.length && !plainLyrics)) {
    return null;
  }

  const coverUrl = currentSong.imageKey
    ? getImageUrl(currentSong.imageKey, {
        width: 800,
        height: 800,
        aspectRatio: "1-1",
      })
    : (currentSong as any).posterUrl || "";

  const hasSyncedLyrics = transcriptions && transcriptions.length > 0;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="fixed inset-0 z-100 bg-black/90 backdrop-blur-3xl text-white flex flex-col justify-between p-4 sm:p-8 lg:p-10 select-none overflow-hidden"
      >
        <ZenBackground
          currentSong={currentSong}
          videoKey={videoKey}
          canvasVideoUrl={canvasVideoUrl}
          videoRef={videoRef}
          solidBgColor={solidBgColor}
          isPlaying={isPlaying}
          coverUrl={coverUrl}
        />

        <ZenExitButton
          showExitButton={showExitButton}
          onHover={() => setShowExitButton(true)}
        />

        <main className="relative z-10 flex-1 flex flex-col lg:grid lg:grid-cols-12 gap-4 sm:gap-6 lg:gap-14 items-center min-h-0 overflow-hidden w-full max-w-7xl mx-auto my-auto">
          <ZenTrackInfo
            currentSong={currentSong}
            coverUrl={coverUrl}
            isPlaying={isPlaying}
          />

          <ZenLyricsView
            lyricsContainerRef={lyricsContainerRef}
            activeLineRef={activeLineRef}
            onScroll={handleScroll}
            onManualScroll={handleManualUserScroll}
            isLyricsLoading={isLyricsLoading}
            hasSyncedLyrics={hasSyncedLyrics}
            transcriptions={transcriptions}
            activeIndex={activeIndex}
            currentTime={currentTime}
            onSeek={onSeek}
            handleResync={handleResync}
            plainLyrics={plainLyrics}
            isUserScrolled={isUserScrolled}
          />
        </main>

        <ZenControlsBar
          currentTime={currentTime}
          duration={duration}
          buffered={buffered}
          onSeek={onSeek}
          volume={volume}
          isMuted={isMuted}
          isPlaying={isPlaying}
        />
      </motion.div>
    </AnimatePresence>
  );
};
