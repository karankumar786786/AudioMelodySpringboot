"use client";

import React, { useRef, useEffect, useState } from "react";
import { useStore } from "@tanstack/react-store";
import { playerStore } from "../../store/player.store";
import { TranscriptionEntry } from "./hooks/useLyrics";
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
        <canvas
          ref={canvasRef}
          className="w-full h-52 sm:h-64 block"
        />
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
}

export const PlayerLyricsOverlay: React.FC<PlayerLyricsOverlayProps> = ({
  currentCaption,
  transcriptions = [],
  plainLyrics = null,
  localTime,
  analyser,
  onSeek,
}) => {
  const isPlaying = useStore(playerStore, (s) => s.isPlaying);
  const activeLineRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isUserScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isUserScrolled, setIsUserScrolled] = useState(false);

  const handleUserScroll = () => {
    isUserScrollingRef.current = true;
    setIsUserScrolled(true);
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      isUserScrollingRef.current = false;
      setIsUserScrolled(false);
    }, 5000);
  };

  const handleResync = () => {
    isUserScrollingRef.current = false;
    setIsUserScrolled(false);
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    if (activeLineRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
    toast.success("Lyrics resynced with audio");
  };

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

  useEffect(() => {
    if (
      !isUserScrollingRef.current &&
      activeLineRef.current &&
      containerRef.current
    ) {
      activeLineRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [activeIndex]);

  const hasTranscriptions = transcriptions && transcriptions.length > 0;
  const hasPlainLyrics = !!plainLyrics;

  return (
    <div
      ref={containerRef}
      onScroll={handleUserScroll}
      onWheel={handleUserScroll}
      onTouchMove={handleUserScroll}
      className="flex-1 w-full overflow-y-auto no-scrollbar px-6 sm:px-12 py-8 flex flex-col items-center select-none relative"
    >
      {hasTranscriptions ? (
        // ✅ Synced karaoke lyrics
        <>
          <div className="space-y-7 w-full max-w-2xl text-left py-8">
            {transcriptions.map((entry, idx) => {
              const isActive = idx === activeIndex;
              return (
                <div
                  key={`${entry.start_time_seconds}-${idx}`}
                  id={isActive ? "active-lyric-line" : undefined}
                  ref={isActive ? activeLineRef : null}
                  onClick={() => {
                    if (onSeek) onSeek(entry.start_time_seconds);
                    handleResync();
                  }}
                  className={`cursor-pointer transition-all duration-200 py-1 rounded-lg ${
                    isActive
                      ? "text-white"
                      : "text-white/40 hover:text-white/80"
                  }`}
                >
                  {entry.words && entry.words.length > 0 ? (
                    <div className="flex flex-wrap gap-x-2.5 gap-y-1">
                      {entry.words.map((word, wIdx) => {
                        const isWordActive =
                          localTime >= word.start && localTime <= word.end;
                        return (
                          <span
                            key={wIdx}
                            className={`text-2xl sm:text-3xl md:text-[32px] font-extrabold tracking-tight transition-colors duration-100 ${
                              isWordActive
                                ? "text-white drop-shadow-[0_0_16px_rgba(255,255,255,0.85)]"
                                : isActive
                                  ? "text-white"
                                  : "text-white/40 hover:text-white/80"
                            }`}
                          >
                            {word.text}
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    <p
                      className={`text-2xl sm:text-3xl md:text-[32px] font-extrabold tracking-tight transition-colors duration-200 ${
                        isActive
                          ? "text-white drop-shadow-md"
                          : "text-white/40 hover:text-white/80"
                      }`}
                    >
                      {entry.transcript}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Resync button */}
          {isUserScrolled && (
            <button
              onClick={handleResync}
              className="fixed bottom-28 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-white/10 backdrop-blur-md text-white text-xs font-bold px-4 py-2 rounded-full border border-white/20 hover:bg-white/20 transition-all z-10 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              Resync lyrics
            </button>
          )}
        </>
      ) : hasPlainLyrics ? (
        // ⚠️ Plain (non-synced) lyrics — static scrollable text
        <div className="w-full max-w-2xl py-8">
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
          <div className="space-y-1.5 text-left">
            {plainLyrics.split("\n").map((line, idx) => (
              <p
                key={idx}
                className={`text-lg sm:text-xl font-bold tracking-tight leading-relaxed ${
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
        <div className="my-auto text-left px-4 max-w-2xl">
          <p className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white leading-relaxed">
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
