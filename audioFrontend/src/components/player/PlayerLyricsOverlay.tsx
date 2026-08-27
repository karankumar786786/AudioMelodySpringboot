"use client";

import React, { useRef, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useStore } from "@tanstack/react-store";
import { playerStore } from "../../store/player.store";
import { TranscriptionEntry } from "./hooks/useLyrics";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";

interface PlayerLyricsOverlayProps {
  currentCaption: TranscriptionEntry | null;
  transcriptions?: TranscriptionEntry[];
  plainLyrics?: string | null;
  localTime: number;
  onSeek?: (time: number) => void;
}

export const PlayerLyricsOverlay: React.FC<PlayerLyricsOverlayProps> = ({
  currentCaption,
  transcriptions = [],
  plainLyrics = null,
  localTime,
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
      activeLineRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    toast.success("Lyrics resynced with audio");
  };

  // Determine active transcription line index
  let activeIndex = -1;
  if (transcriptions && transcriptions.length > 0) {
    for (let i = 0; i < transcriptions.length; i++) {
      const line = transcriptions[i];
      const nextLine = transcriptions[i + 1];
      if (localTime >= line.start_time_seconds && (!nextLine || localTime < nextLine.start_time_seconds)) {
        activeIndex = i;
        break;
      }
    }
  }

  useEffect(() => {
    if (!isUserScrollingRef.current && activeLineRef.current && containerRef.current) {
      activeLineRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeIndex]);

  // EQ bar fallback — when no lyrics at all
  const EqualizerFallback = () => (
    <div className="flex flex-col items-center justify-center gap-5 py-12 w-full h-full my-auto">
      <div className="flex items-end gap-1.5 h-16 px-4">
        {[...Array(9)].map((_, i) => {
          const animDurations = [1.2, 0.8, 1.4, 0.9, 1.1, 1.3, 0.7, 1.0, 1.2];
          const heightSequence = [
            [16, 40, 16], [12, 56, 12], [20, 32, 20], [8, 48, 8],
            [16, 64, 16], [12, 40, 12], [20, 56, 20], [8, 32, 8], [16, 48, 16],
          ];
          return (
            <motion.div
              key={i}
              animate={isPlaying ? { height: heightSequence[i] } : { height: 8 }}
              transition={{ duration: animDurations[i], repeat: Infinity, ease: "easeInOut" }}
              className="w-1.5 bg-primary rounded-full"
              style={{ height: 8 }}
            />
          );
        })}
      </div>
      <p className="text-sm font-medium text-zinc-400">
        {isPlaying ? "Streaming High Quality Audio" : "Playback paused"}
      </p>
    </div>
  );

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
                    isActive ? "text-white" : "text-white/40 hover:text-white/80"
                  }`}
                >
                  {entry.words && entry.words.length > 0 ? (
                    <div className="flex flex-wrap gap-x-2.5 gap-y-1">
                      {entry.words.map((word, wIdx) => {
                        const isWordActive = localTime >= word.start && localTime <= word.end;
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
                    <p className={`text-2xl sm:text-3xl md:text-[32px] font-extrabold tracking-tight transition-colors duration-200 ${
                      isActive ? "text-white drop-shadow-md" : "text-white/40 hover:text-white/80"
                    }`}>
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
              className="fixed bottom-28 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-white/10 backdrop-blur-md text-white text-xs font-bold px-4 py-2 rounded-full border border-white/20 hover:bg-white/20 transition-all z-10"
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
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
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
                    ? "h-4"  // blank line spacing
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
        // ❌ No lyrics at all — EQ bars
        <EqualizerFallback />
      )}
    </div>
  );
};
