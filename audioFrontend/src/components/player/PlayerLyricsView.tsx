"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { PlayerLyricsOverlay } from "./PlayerLyricsOverlay";
import { type TranscriptionEntry } from "./hooks/useLyrics";

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

  const content = (
    <div
      style={{ backgroundColor: solidBgColor }}
      className="absolute inset-x-2 top-16 bottom-20 z-40 flex flex-col px-2 sm:px-4 md:px-6 py-2 sm:py-4 md:py-6 overflow-hidden rounded-2xl animate-in fade-in duration-300 select-none"
    >
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
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

