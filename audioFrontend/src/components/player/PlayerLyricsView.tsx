"use client";

import React from "react";
import { Mic2, X } from "lucide-react";
import { playerActions } from "@/store/player.store";
import { type PlayerSong } from "@/lib/player-utils";
import { PlayerLyricsOverlay } from "./PlayerLyricsOverlay";
import { type TranscriptionEntry } from "./hooks/useLyrics";

interface PlayerLyricsViewProps {
  currentSong: PlayerSong;
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
  return (
    <div
      style={{ backgroundColor: solidBgColor }}
      className="fixed left-0 md:left-[64px] xl:left-[192px] right-0 lg:right-[290px] xl:right-[320px] 2xl:right-[340px] top-0 bottom-20 z-40 flex flex-col p-4 sm:p-6 md:p-8 overflow-y-auto no-scrollbar animate-in fade-in duration-300 transition-all duration-200"
    >
      {/* Header pinned at top */}
      <div className="sticky top-0 z-50 flex items-center justify-between pb-4 border-b border-[#282828] bg-inherit backdrop-blur-md shrink-0 pt-2">
        <div className="flex items-center gap-3">
          <Mic2 className="text-primary" size={20} />
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">
              Lyrics
            </h2>
            <p className="text-xs text-white font-medium">
              {currentSong.title} • {currentSong.artistName}
            </p>
          </div>
        </div>

        {/* Close Lyrics Button */}
        <button
          type="button"
          onClick={() => playerActions.closeLyrics()}
          className="p-2 rounded-full text-zinc-300 hover:text-white hover:bg-[#282828] transition-colors cursor-pointer"
          title="Close Lyrics"
          aria-label="Close Lyrics"
        >
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center py-6">
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
