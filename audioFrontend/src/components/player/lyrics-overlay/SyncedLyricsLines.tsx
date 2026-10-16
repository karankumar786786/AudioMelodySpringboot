"use client";

import React from "react";
import { RotateCcw } from "lucide-react";
import type { TranscriptionEntry } from "../hooks/useLyrics";

interface SyncedLyricsLinesProps {
  transcriptions: TranscriptionEntry[];
  activeIndex: number;
  localTime: number;
  activeLineRef: React.RefObject<HTMLDivElement | null>;
  isUserScrolled: boolean;
  onSeek?: (time: number) => void;
  onResync: (notify?: boolean) => void;
}

export const SyncedLyricsLines: React.FC<SyncedLyricsLinesProps> = ({
  transcriptions,
  activeIndex,
  localTime,
  activeLineRef,
  isUserScrolled,
  onSeek,
  onResync,
}) => {
  return (
    <>
      <div className="space-y-6 sm:space-y-8 md:space-y-9 w-full max-w-2xl lg:max-w-3xl text-left py-24 sm:py-32 md:py-40">
        {transcriptions.map((entry, idx) => {
          const isActive = idx === activeIndex;
          const distance = activeIndex === -1 ? 0 : Math.abs(idx - activeIndex);

          // Calculate graduated blur and opacity based on distance from active line
          let focusStyle = "blur-0 opacity-100 scale-[1.03] origin-left drop-shadow-[0_4px_20px_rgba(255,255,255,0.2)]";
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
                onResync(false);
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
                              ? "text-white opacity-100 scale-[1.03] drop-shadow-[0_2px_14px_rgba(255,255,255,0.4)]"
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
                        ? "text-white opacity-100 drop-shadow-[0_2px_14px_rgba(255,255,255,0.3)]"
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
          onClick={() => onResync(true)}
          className="sticky bottom-6 mx-auto group flex items-center gap-2.5 bg-white/15 hover:bg-white/25 text-white text-xs font-semibold px-4.5 py-2.5 rounded-full border border-white/25 hover:border-white/40 backdrop-blur-xl shadow-[0_8px_32px_0_rgba(0,0,0,0.37),inset_0_1px_1px_0_rgba(255,255,255,0.25)] hover:shadow-[0_12px_40px_0_rgba(0,0,0,0.45),inset_0_1px_1px_0_rgba(255,255,255,0.35)] hover:scale-105 active:scale-95 transition-all duration-200 z-20 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5 transition-transform duration-300 group-hover:-rotate-45" />
          <span className="tracking-wide">Sync lyrics</span>
        </button>
      )}
    </>
  );
};
