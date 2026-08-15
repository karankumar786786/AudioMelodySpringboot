"use client";

import React, { useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { useStore } from "@tanstack/react-store";
import { playerStore } from "../../store/player.store";
import { TranscriptionEntry } from "./hooks/useLyrics";

interface PlayerLyricsOverlayProps {
  currentCaption: TranscriptionEntry | null;
  transcriptions?: TranscriptionEntry[];
  localTime: number;
  onSeek?: (time: number) => void;
}

export const PlayerLyricsOverlay: React.FC<PlayerLyricsOverlayProps> = ({
  currentCaption,
  transcriptions = [],
  localTime,
  onSeek,
}) => {
  const isPlaying = useStore(playerStore, (s) => s.isPlaying);
  const activeLineRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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

  // Smooth auto-scroll active lyric line to center
  useEffect(() => {
    if (activeLineRef.current && containerRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [activeIndex]);

  // Fallback Equalizer component when no captions/transcriptions exist
  const EqualizerFallback = () => (
    <div className="flex flex-col items-center justify-center gap-5 py-12 w-full h-full my-auto">
      <div className="flex items-end gap-1.5 h-16 px-4">
        {[...Array(9)].map((_, i) => {
          const animDurations = [1.2, 0.8, 1.4, 0.9, 1.1, 1.3, 0.7, 1.0, 1.2];
          const heightSequence = [
            [16, 40, 16],
            [12, 56, 12],
            [20, 32, 20],
            [8, 48, 8],
            [16, 64, 16],
            [12, 40, 12],
            [20, 56, 20],
            [8, 32, 8],
            [16, 48, 16],
          ];
          return (
            <motion.div
              key={i}
              animate={
                isPlaying ? { height: heightSequence[i] } : { height: 8 }
              }
              transition={{
                duration: animDurations[i],
                repeat: Infinity,
                ease: "easeInOut",
              }}
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

  return (
    <div
      ref={containerRef}
      className="flex-1 w-full overflow-y-auto no-scrollbar px-6 py-12 flex flex-col items-center select-none"
    >
      {hasTranscriptions ? (
        <div className="space-y-6 w-full max-w-2xl text-center py-10">
          {transcriptions.map((entry, idx) => {
            const isActive = idx === activeIndex;
            const isPast = idx < activeIndex;

            return (
              <div
                key={`${entry.start_time_seconds}-${idx}`}
                ref={isActive ? activeLineRef : null}
                onClick={() => onSeek && onSeek(entry.start_time_seconds)}
                className={`cursor-pointer transition-all duration-300 px-4 py-2 rounded-xl ${
                  isActive
                    ? "scale-105"
                    : "hover:text-white/80 opacity-80 hover:opacity-100"
                }`}
              >
                {entry.words && entry.words.length > 0 ? (
                  <div className="flex flex-wrap justify-center gap-x-2 gap-y-1">
                    {entry.words.map((word, wIdx) => {
                      const isWordActive =
                        localTime >= word.start && localTime <= word.end;
                      const isWordPast = localTime > word.end;
                      return (
                        <span
                          key={wIdx}
                          className={`text-xl sm:text-2xl md:text-3xl font-bold transition-colors duration-150 ${
                            isWordActive
                              ? "text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.6)]"
                              : isActive
                              ? "text-white"
                              : isWordPast || isPast
                              ? "text-white/40"
                              : "text-white/20"
                          }`}
                        >
                          {word.text}
                        </span>
                      );
                    })}
                  </div>
                ) : (
                  <p
                    className={`text-xl sm:text-2xl md:text-3xl font-bold transition-colors duration-300 ${
                      isActive
                        ? "text-white scale-105"
                        : isPast
                        ? "text-white/40"
                        : "text-white/25"
                    }`}
                  >
                    {entry.transcript}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      ) : currentCaption ? (
        <div className="my-auto text-center px-4 max-w-2xl">
          <p className="text-2xl sm:text-3xl font-bold text-white leading-relaxed">
            {currentCaption.transcript}
          </p>
        </div>
      ) : (
        <EqualizerFallback />
      )}
    </div>
  );
};
