"use client";

import React from "react";
import { Mic2, Languages, ChevronDown, Check, X } from "lucide-react";
import { toast } from "sonner";
import { playerActions } from "@/store/player.store";
import { SUPPORTED_LANGUAGES } from "@/lib/google-translate";
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
  isTranslating: boolean;
  lyricsTargetLang: string;
  setLyricsTargetLang: (lang: string) => void;
  showLangMenu: boolean;
  setShowLangMenu: React.Dispatch<React.SetStateAction<boolean>>;
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
  isTranslating,
  lyricsTargetLang,
  setLyricsTargetLang,
  showLangMenu,
  setShowLangMenu,
  onSeek,
}) => {
  return (
    <div
      style={{ backgroundColor: solidBgColor }}
      className="fixed left-0 md:left-[72px] xl:left-[240px] right-0 lg:right-[290px] xl:right-[320px] 2xl:right-[340px] top-0 bottom-20 z-40 flex flex-col p-4 sm:p-6 md:p-8 overflow-y-auto no-scrollbar animate-in fade-in duration-300 transition-all duration-200"
    >
      {/* Header pinned at top */}
      <div className="sticky top-0 z-50 flex items-center justify-between pb-4 border-b border-[#282828] bg-inherit backdrop-blur-md shrink-0 pt-2">
        <div className="flex items-center gap-3">
          <Mic2 className="text-primary" size={20} />
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">
              Lyrics
            </h2>
            <p className="text-xs text-zinc-400 font-medium">
              {currentSong.title} • {currentSong.artistName}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Google Lyrics Translator Language Selector Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowLangMenu((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-md border transition-all cursor-pointer ${
                lyricsTargetLang !== "original"
                  ? "bg-primary text-black border-primary font-bold shadow-md shadow-primary/20"
                  : "bg-[#282828]/80 text-zinc-300 border-white/10 hover:text-white hover:bg-[#333]"
              }`}
              title="Translate Lyrics (Google Translate)"
              aria-label="Translate Lyrics"
            >
              <Languages
                size={15}
                className={isTranslating ? "animate-spin" : ""}
              />
              <span className="max-w-[120px] truncate">
                {SUPPORTED_LANGUAGES.find((l) => l.code === lyricsTargetLang)
                  ?.name.split(" ")[0] || "Translate"}
              </span>
              <ChevronDown
                size={14}
                className={`transition-transform duration-200 ${
                  showLangMenu ? "rotate-180" : ""
                }`}
              />
            </button>

            {showLangMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowLangMenu(false)}
                />
                <div className="absolute right-0 top-full mt-2 w-56 max-h-72 overflow-y-auto no-scrollbar rounded-xl bg-[#1e1e1e] border border-white/10 shadow-2xl z-50 p-1.5 backdrop-blur-xl">
                  <div className="px-2.5 py-1.5 text-[11px] font-bold text-zinc-400 uppercase tracking-wider border-b border-white/5 mb-1 flex items-center justify-between">
                    <span>Translate Lyrics</span>
                  </div>
                  {SUPPORTED_LANGUAGES.map((lang) => {
                    const isSelected = lyricsTargetLang === lang.code;
                    return (
                      <button
                        key={lang.code}
                        type="button"
                        onClick={() => {
                          setLyricsTargetLang(lang.code);
                          setShowLangMenu(false);
                          if (lang.code !== "original") {
                            toast.success(`Translating to ${lang.name}`);
                          } else {
                            toast.success("Original lyrics restored");
                          }
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                          isSelected
                            ? "bg-primary text-black font-bold"
                            : "text-zinc-200 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        <span className="flex items-center gap-2 truncate">
                          <span>{lang.flag}</span>
                          <span className="truncate">{lang.name}</span>
                        </span>
                        {isSelected && <Check size={14} />}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
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
      </div>

      <div className="flex-1 flex items-center justify-center py-6">
        <PlayerLyricsOverlay
          currentCaption={currentCaption}
          transcriptions={displayTranscriptions}
          plainLyrics={displayPlainLyrics}
          localTime={localTime}
          analyser={analyser}
          isLoading={isLyricsLoading || isTranslating}
          onSeek={onSeek}
        />
      </div>
    </div>
  );
};
