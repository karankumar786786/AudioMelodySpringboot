"use client";

import React from "react";
import { Sparkles, Radio, RotateCcw } from "lucide-react";
import type { TranscriptionEntry } from "../hooks/useLyrics";

interface ZenLyricsViewProps {
  lyricsContainerRef: React.RefObject<HTMLDivElement | null>;
  activeLineRef: React.RefObject<HTMLDivElement | null>;
  onScroll: () => void;
  onManualScroll: () => void;
  isLyricsLoading: boolean;
  hasSyncedLyrics: boolean;
  transcriptions: TranscriptionEntry[];
  activeIndex: number;
  currentTime: number;
  onSeek: (time: number) => void;
  handleResync: (notify?: boolean) => void;
  plainLyrics?: string | null;
  isUserScrolled: boolean;
}

export const ZenLyricsView: React.FC<ZenLyricsViewProps> = ({
  lyricsContainerRef,
  activeLineRef,
  onScroll,
  onManualScroll,
  isLyricsLoading,
  hasSyncedLyrics,
  transcriptions,
  activeIndex,
  currentTime,
  onSeek,
  handleResync,
  plainLyrics,
  isUserScrolled,
}) => {
  return (
    <div className="flex-1 lg:col-span-7 h-full w-full flex flex-col justify-center min-h-0 overflow-hidden relative rounded-3xl">
      <div
        ref={lyricsContainerRef}
        onScroll={onScroll}
        onWheel={onManualScroll}
        onTouchMove={onManualScroll}
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
              className="w-20 h-20 rounded-3xl flex items-center justify-center border border-white/20 backdrop-blur-3xl backdrop-saturate-190"
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
          className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 text-white text-xs font-semibold px-4.5 py-2.5 rounded-full border border-white/25 backdrop-blur-3xl backdrop-saturate-190 hover:scale-105 active:scale-95 transition-all cursor-pointer z-30"
        >
          <RotateCcw size={14} className="animate-spin-once" />
          <span>Sync Lyrics</span>
        </button>
      )}
    </div>
  );
};
