"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { useStore } from "@tanstack/react-store";
import { playerStore } from "@/store/player.store";
import { toast } from "sonner";
import type { PlayerLyricsOverlayProps } from "./types";
import { AudioVisualizerFallback } from "./AudioVisualizerFallback";
import { LyricsLoadingState } from "./LyricsLoadingState";
import { SyncedLyricsLines } from "./SyncedLyricsLines";
import { StaticLyricsView } from "./StaticLyricsView";

const USER_SCROLL_IDLE_AUTO_SYNC_MS = 4000;

export const PlayerLyricsOverlay: React.FC<PlayerLyricsOverlayProps> = ({
  currentCaption,
  transcriptions = [],
  plainLyrics = null,
  localTime,
  analyser,
  onSeek,
  isLoading = false,
}) => {
  const currentSong = useStore(playerStore, (s) => s.currentSong);
  const isPlaying = useStore(playerStore, (s) => s.isPlaying);
  const activeLineRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isUserScrolledRef = useRef(false);
  const isProgrammaticScrollRef = useRef(false);
  const programmaticScrollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const autoResyncTimerRef = useRef<NodeJS.Timeout | null>(null);
  const prevTimeRef = useRef(localTime);
  const lastActiveIndexRef = useRef(-1);

  const [isUserScrolled, setIsUserScrolled] = useState(false);

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
  const handleResync = useCallback(
    (notify = false) => {
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
    },
    [scrollToActiveLine],
  );

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
    }, USER_SCROLL_IDLE_AUTO_SYNC_MS);
  }, [scrollToActiveLine]);

  const handleScroll = useCallback(() => {
    if (isProgrammaticScrollRef.current) return;

    if (
      isUserScrolledRef.current &&
      activeLineRef.current &&
      containerRef.current
    ) {
      const activeRect = activeLineRef.current.getBoundingClientRect();
      const containerRect = containerRef.current.getBoundingClientRect();
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

  // Listen for global resync event (e.g. from 'R' keyboard shortcut)
  useEffect(() => {
    const onGlobalResync = () => handleResync(true);
    window.addEventListener("lyrics-resync", onGlobalResync);
    return () => {
      window.removeEventListener("lyrics-resync", onGlobalResync);
      if (autoResyncTimerRef.current) clearTimeout(autoResyncTimerRef.current);
      if (programmaticScrollTimerRef.current)
        clearTimeout(programmaticScrollTimerRef.current);
    };
  }, [handleResync]);

  // Determine active transcription line index
  let activeIndex = -1;
  if (transcriptions && transcriptions.length > 0) {
    for (let i = 0; i < transcriptions.length; i++) {
      const line = transcriptions[i];
      const nextLine = transcriptions[i + 1];
      if (
        localTime >= line.start_time_seconds &&
        (!nextLine || localTime < nextLine.start_time_seconds)
      ) {
        activeIndex = i;
        break;
      }
    }
  }

  // Auto-resync when playback seeks or jumps significantly
  useEffect(() => {
    const timeDelta = Math.abs(localTime - prevTimeRef.current);
    prevTimeRef.current = localTime;

    if (timeDelta > 1.5) {
      if (autoResyncTimerRef.current) {
        clearTimeout(autoResyncTimerRef.current);
        autoResyncTimerRef.current = null;
      }
      isUserScrolledRef.current = false;
      setIsUserScrolled(false);
      scrollToActiveLine(true);
    }
  }, [localTime, scrollToActiveLine]);

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

  // Immediately sync and scroll when lyrics language changes or finishing loading
  useEffect(() => {
    if (isLoading || !transcriptions || transcriptions.length === 0) return;

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
    }, 200);

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      clearTimeout(timer);
    };
  }, [isLoading, transcriptions, scrollToActiveLine]);

  const hasTranscriptions = transcriptions && transcriptions.length > 0;
  const hasPlainLyrics = !!plainLyrics;

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      onWheel={handleManualUserScroll}
      onTouchMove={handleManualUserScroll}
      className="flex-1 w-full overflow-y-auto no-scrollbar px-3 sm:px-6 md:px-10 py-6 md:py-8 flex flex-col items-center select-none relative mask-[linear-gradient(to_bottom,transparent_0%,black_10%,black_90%,transparent_100%)]"
    >
      {isLoading ? (
        <LyricsLoadingState />
      ) : hasTranscriptions ? (
        <SyncedLyricsLines
          transcriptions={transcriptions}
          activeIndex={activeIndex}
          localTime={localTime}
          activeLineRef={activeLineRef}
          isUserScrolled={isUserScrolled}
          onSeek={onSeek}
          onResync={handleResync}
        />
      ) : hasPlainLyrics ? (
        <StaticLyricsView plainLyrics={plainLyrics} />
      ) : currentCaption ? (
        <div className="my-auto text-left px-4 max-w-2xl lg:max-w-3xl">
          <p className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-extrabold text-white leading-relaxed">
            {currentCaption.transcript}
          </p>
        </div>
      ) : (
        <AudioVisualizerFallback analyser={analyser} isPlaying={isPlaying} />
      )}
    </div>
  );
};
