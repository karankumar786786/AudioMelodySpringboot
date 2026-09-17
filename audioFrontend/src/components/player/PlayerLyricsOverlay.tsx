"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { useStore } from "@tanstack/react-store";
import { playerStore } from "../../store/player.store";
import { type TranscriptionEntry } from "./hooks/useLyrics";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";

interface AudioVisualizerFallbackProps {
  analyser?: AnalyserNode | null;
  isPlaying: boolean;
}

function AudioVisualizerFallback({
  analyser,
  isPlaying,
}: AudioVisualizerFallbackProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastDataArrayRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const currentSong = useStore(playerStore, (s) => s.currentSong);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const bufferLength = analyser ? analyser.frequencyBinCount : 64;
    if (
      !lastDataArrayRef.current ||
      lastDataArrayRef.current.length !== bufferLength
    ) {
      const initialArray: Uint8Array<ArrayBuffer> = new Uint8Array(
        new ArrayBuffer(bufferLength),
      );
      for (let i = 0; i < bufferLength; i++) {
        initialArray[i] = 16;
      }
      lastDataArrayRef.current = initialArray;
    }
    const dataArray = lastDataArrayRef.current;

    const render = () => {
      const width = rect.width;
      const height = rect.height;

      ctx.clearRect(0, 0, width, height);

      // When playing, capture live frequency data. When paused, maintain exact current state.
      if (analyser && isPlaying) {
        analyser.getByteFrequencyData(dataArray);
      }

      // Live 46-band stereo equalizer spectrum
      const barCount = 46;
      const spacing = 6;
      const totalSpacing = spacing * (barCount - 1);
      const barWidth = Math.max(2, (width - totalSpacing) / barCount);

      for (let i = 0; i < barCount; i++) {
        const index = Math.floor((i / barCount) * (bufferLength * 0.75));
        const value = dataArray[index] || 0;
        const percent = Math.min(1, value / 255);
        const barHeight = Math.max(4, percent * height * 0.92);
        const x = i * (barWidth + spacing);
        const y = height - barHeight;

        // Solid color bars
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, [3, 3, 3, 3]);
        ctx.fill();
      }

      if (isPlaying) {
        animationFrameRef.current = requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [analyser, isPlaying]);

  return (
    <div className="flex flex-col items-center justify-center gap-6 py-8 w-full max-w-3xl my-auto px-4">
      {/* Live Equalizer Canvas (Transparent Background blending into song ambient color) */}
      <div className="relative w-full overflow-hidden flex items-center justify-center">
        <canvas ref={canvasRef} className="w-full h-52 sm:h-64 block" />
      </div>

      {/* Info Badge */}
      <div className="text-center space-y-1.5">
        <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight drop-shadow-md">
          {currentSong?.title || "Audio Melody"}
        </h3>
        <p className="text-xs font-semibold text-white/70 tracking-wide uppercase">
          {isPlaying ? "Live Audio Spectrum Visualizer" : "Playback Paused"}
        </p>
      </div>
    </div>
  );
}

interface PlayerLyricsOverlayProps {
  currentCaption: TranscriptionEntry | null;
  transcriptions?: TranscriptionEntry[];
  plainLyrics?: string | null;
  localTime: number;
  analyser?: AnalyserNode | null;
  onSeek?: (time: number) => void;
  isLoading?: boolean;
}

const USER_SCROLL_IDLE_AUTO_SYNC_MS = 4000; // Automatically return to synced mode after 4s idle

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

    // Reset the auto-resync timer on every user interaction
    if (autoResyncTimerRef.current) {
      clearTimeout(autoResyncTimerRef.current);
    }

    // Schedule automatic resync after user stops scrolling
    autoResyncTimerRef.current = setTimeout(() => {
      isUserScrolledRef.current = false;
      setIsUserScrolled(false);
      scrollToActiveLine(true);
    }, USER_SCROLL_IDLE_AUTO_SYNC_MS);
  }, [scrollToActiveLine]);

  const handleScroll = useCallback(() => {
    // If scrolling was triggered programmatically by the player, ignore it
    if (isProgrammaticScrollRef.current) return;

    // Check if user manually scrolled back into center of active line
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

  // Auto-resync when playback seeks or jumps significantly (e.g. user clicked timeline or skipped track)
  useEffect(() => {
    const timeDelta = Math.abs(localTime - prevTimeRef.current);
    prevTimeRef.current = localTime;

    // If playback jumped more than 1.5s (seek event), automatically sync immediately
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

    // If active line moved significantly (> 2 lines) while user was scrolled, auto-sync back
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

    // Normal continuous auto-scroll when user has not manually overridden scroll
    if (!isUserScrolledRef.current) {
      scrollToActiveLine(true);
    }
  }, [activeIndex, isPlaying, scrollToActiveLine]);

  // Immediately sync and scroll when lyrics language changes or finishing loading.
  // Uses a double-RAF so activeLineRef is reliably attached to the new DOM before
  // scrollToActiveLine is called (single RAF fires before React commits refs).
  useEffect(() => {
    if (isLoading || !transcriptions || transcriptions.length === 0) return;

    // Clear any stale manual scroll locks when language is switched
    isUserScrolledRef.current = false;
    setIsUserScrolled(false);

    // Frame 1: React commits new DOM. Frame 2: refs are attached, scroll now.
    let raf2: number;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        scrollToActiveLine(false);
      });
    });

    // Fallback smooth scroll after DOM has settled
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
      className="flex-1 w-full overflow-y-auto no-scrollbar px-3 sm:px-6 md:px-10 py-6 md:py-8 flex flex-col items-center select-none relative"
    >
      {isLoading ? (
        // ⏳ Beautiful Animated Loading State
        <div className="flex-1 flex flex-col items-center justify-center gap-5 py-20 my-auto">
          <div className="relative flex items-center justify-center w-16 h-16">
            <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-ping opacity-25" />
            <div className="w-12 h-12 rounded-full border-2 border-transparent border-t-primary border-r-primary animate-spin" />
            <div className="absolute flex items-end justify-center gap-1">
              <span className="w-1 h-3 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]" />
              <span className="w-1 h-5 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]" />
              <span className="w-1 h-2 bg-primary rounded-full animate-bounce" />
            </div>
          </div>
          <p className="text-sm font-semibold text-white/70 tracking-wide animate-pulse">
            Loading lyrics...
          </p>
        </div>
      ) : hasTranscriptions ? (
        // ✅ Synced karaoke lyrics
        <>
          <div className="space-y-6 sm:space-y-8 md:space-y-9 w-full max-w-2xl lg:max-w-3xl text-left py-24 sm:py-32 md:py-40">
            {transcriptions.map((entry, idx) => {
              const isActive = idx === activeIndex;
              const distance = activeIndex === -1 ? 0 : Math.abs(idx - activeIndex);

              // Calculate graduated blur and opacity based on distance from active line
              let focusStyle = "blur-0 opacity-100 scale-[1.03] origin-left";
              if (!isActive && activeIndex !== -1) {
                if (distance === 1) {
                  focusStyle = "blur-[0.5px] opacity-55 scale-100 group-hover:blur-0 group-hover:opacity-90";
                } else if (distance === 2) {
                  focusStyle = "blur-[1.2px] opacity-35 scale-100 group-hover:blur-0 group-hover:opacity-90";
                } else {
                  focusStyle = "blur-[2px] opacity-20 scale-100 group-hover:blur-0 group-hover:opacity-90";
                }
              }

              return (
                <div
                  key={`${entry.start_time_seconds}-${idx}`}
                  id={isActive ? "active-lyric-line" : undefined}
                  ref={isActive ? activeLineRef : null}
                  onClick={() => {
                    if (onSeek) onSeek(entry.start_time_seconds);
                    handleResync(false);
                  }}
                  className={`group relative flex items-center justify-between gap-4 cursor-pointer transition-all duration-300 py-1.5 px-3 -mx-3 rounded-xl transform-gpu ${focusStyle}`}
                >
                  <div className="flex-1 min-w-0">
                    {entry.words && entry.words.length > 0 ? (
                      <div className="flex flex-wrap gap-x-2.5 sm:gap-x-3 gap-y-1.5 items-center">
                        {entry.words.map((word, wIdx) => {
                          const isWordActive =
                            localTime >= word.start && localTime <= word.end;
                          return (
                            <span
                              key={wIdx}
                              className={`text-2xl sm:text-3xl md:text-4xl lg:text-[36px] font-extrabold tracking-tight transition-all duration-150 inline-block transform-gpu ${
                                isWordActive
                                  ? "text-white opacity-100 scale-[1.02]"
                                  : isActive
                                    ? "text-white/85"
                                    : "text-white/60"
                              }`}
                            >
                              {word.text}
                            </span>
                          );
                        })}
                      </div>
                    ) : (
                      <p
                        className={`text-2xl sm:text-3xl md:text-4xl lg:text-[36px] font-extrabold tracking-tight transition-all duration-300 leading-snug transform-gpu ${
                          isActive
                            ? "text-white opacity-100"
                            : "text-white/70"
                        }`}
                      >
                        {entry.transcript}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Resync button with auto-sync indicator */}
          {isUserScrolled && (
            <button
              onClick={() => handleResync(true)}
              className="sticky bottom-6 mx-auto group flex items-center gap-2.5 bg-white/15 hover:bg-white/25 text-white text-xs font-semibold px-4.5 py-2.5 rounded-full border border-white/25 hover:border-white/40 backdrop-blur-xl shadow-[0_8px_32px_0_rgba(0,0,0,0.37),inset_0_1px_1px_0_rgba(255,255,255,0.25)] hover:shadow-[0_12px_40px_0_rgba(0,0,0,0.45),inset_0_1px_1px_0_rgba(255,255,255,0.35)] hover:scale-105 active:scale-95 transition-all duration-200 z-20 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 transition-transform duration-300 group-hover:-rotate-45" />
              <span className="tracking-wide">Sync lyrics</span>
            </button>
          )}
        </>
      ) : hasPlainLyrics ? (
        // ⚠️ Plain (non-synced) lyrics — static scrollable text
        <div className="w-full max-w-2xl lg:max-w-3xl py-4 md:py-8">
          {/* Badge */}
          <div className="flex items-center gap-2 mb-6">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold border border-amber-500/30">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              Synced lyrics not available
            </span>
          </div>

          {/* Plain lyrics text */}
          <div className="space-y-2 text-left">
            {(plainLyrics || "").split("\n").map((line, idx) => (
              <p
                key={idx}
                className={`text-base sm:text-lg md:text-xl font-bold tracking-tight leading-relaxed ${
                  line.trim() === ""
                    ? "h-4" // blank line spacing
                    : "text-white/70"
                }`}
              >
                {line || "\u00A0"}
              </p>
            ))}
          </div>
        </div>
      ) : currentCaption ? (
        // Direct caption fallback (URL-based)
        <div className="my-auto text-left px-4 max-w-2xl lg:max-w-3xl">
          <p className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-extrabold text-white leading-relaxed">
            {currentCaption.transcript}
          </p>
        </div>
      ) : (
        // 🎵 Live Audio Visualizer Equalizer when no lyrics present
        <AudioVisualizerFallback analyser={analyser} isPlaying={isPlaying} />
      )}
    </div>
  );
};
