"use client";

import React from "react";
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
  return (
    <div
      style={{ backgroundColor: solidBgColor }}
      className="fixed left-0 md:left-[64px] xl:left-[192px] right-0 lg:right-[290px] xl:right-[320px] 2xl:right-[340px]  top-16 bottom-20 rounded-2xl mx-5 my-3 z-40 flex flex-col p-2 sm:p-4 md:p-6 overflow-y-auto no-scrollbar animate-in fade-in duration-300 transition-[left,right] duration-200"
    >
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden  relative">
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
};
