"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { PlayerLyricsOverlay } from "./PlayerLyricsOverlay";
import { type TranscriptionEntry } from "./hooks/useLyrics";
import { getImageUrl } from "@/lib/image-utils";

interface PlayerLyricsViewProps {
  currentSong?: any;
  solidBgColor: string;
  currentCaption: TranscriptionEntry | null;
  displayTranscriptions: TranscriptionEntry[];
  displayPlainLyrics: string | null;
  localTime: number;
  analyser: AnalyserNode | null;
  isLyricsLoading: boolean;
  onSeek: (time: number) => void;
}

export const PlayerLyricsView: React.FC<PlayerLyricsViewProps> = ({
  currentSong,
  solidBgColor,
  currentCaption,
  displayTranscriptions,
  displayPlainLyrics,
  localTime,
  analyser,
  isLyricsLoading,
  onSeek,
}) => {
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(() => {
    if (typeof document !== "undefined") {
      return document.getElementById("main-section");
    }
    return null;
  });

  useEffect(() => {
    if (!targetElement && typeof document !== "undefined") {
      setTargetElement(document.getElementById("main-section"));
    }
  }, [targetElement]);

  const rawImageKey =
    currentSong?.imageKey || (currentSong as any)?.coverImageKey;
  const songImageUrl = rawImageKey
    ? getImageUrl(rawImageKey, {
        width: 800,
        height: 800,
        quality: 85,
        aspectRatio: "1-1",
      })
    : currentSong?.posterUrl || currentSong?.coverUrl;

  const content = (
    <div className="absolute inset-x-2 top-16 bottom-20 z-40 flex flex-col px-2 sm:px-4 md:px-6 py-2 sm:py-4 md:py-6 overflow-hidden rounded-2xl backdrop-blur-2xl border border-white/10 shadow-2xl animate-in fade-in zoom-in-[0.99] duration-300 select-none bg-black">
      {/* ─── Aesthetic Blurred Song Image Background ─── */}
      {songImageUrl ? (
        <div className="absolute inset-0 overflow-hidden pointer-events-none -z-0">
          <img
            key={`lyrics-blur-img-${currentSong?.id || "default"}`}
            src={songImageUrl}
            alt=""
            aria-hidden="true"
            className="w-full h-full object-cover object-center scale-125 blur-[65px] sm:blur-[85px] opacity-45 saturate-[170%] transition-all duration-700 ease-out"
          />
          {/* Atmospheric Radial Vignette Overlay for Crisp Lyrics Readability */}
          <div
            style={{
              background: `radial-gradient(ellipse 100% 85% at 50% 25%, ${solidBgColor}40 0%, rgba(0,0,0,0.6) 55%, rgba(0,0,0,0.92) 100%)`,
            }}
            className="absolute inset-0"
          />
        </div>
      ) : (
        /* Fallback gradient if no song image */
        <div
          style={{
            background: `radial-gradient(ellipse 110% 85% at 50% 12%, ${solidBgColor}f0 0%, ${solidBgColor}99 42%, #0e0f14 82%, #050507 100%)`,
          }}
          className="absolute inset-0 pointer-events-none -z-0"
        />
      )}

      {/* Synchronized Lyrics Overlay Container */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative z-10">
        <PlayerLyricsOverlay
          currentCaption={currentCaption}
          transcriptions={displayTranscriptions}
          plainLyrics={displayPlainLyrics}
          localTime={localTime}
          analyser={analyser}
          isLoading={isLyricsLoading}
          onSeek={onSeek}
        />
      </div>
    </div>
  );

  if (targetElement) {
    return createPortal(content, targetElement);
  }

  return null;
};

