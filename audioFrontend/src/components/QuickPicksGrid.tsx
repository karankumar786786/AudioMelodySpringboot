"use client";

import { useStore } from "@tanstack/react-store";
import { motion } from "framer-motion";
import { Pause, Play } from "lucide-react";
import type React from "react";
import type { Song } from "../lib/api";
import { getImageUrl } from "../lib/image-utils";
import { mapToPlayerSong } from "../lib/player-utils";
import { playerActions, playerStore } from "../store/player.store";

interface QuickPicksGridProps {
  songs: Song[];
  isLoading?: boolean;
}

export function QuickPicksGrid({
  songs,
  isLoading = false,
}: QuickPicksGridProps) {
  const currentSong = useStore(playerStore, (s) => s.currentSong);
  const isPlaying = useStore(playerStore, (s) => s.isPlaying);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-2.5 sm:gap-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="h-14 sm:h-16 rounded-lg bg-zinc-900/80 border border-white/5 flex items-center gap-3 overflow-hidden animate-pulse"
          >
            <div className="w-14 sm:w-16 h-full bg-zinc-800 shrink-0" />
            <div className="flex-1 space-y-1.5 pr-4">
              <div className="h-3 w-3/5 bg-zinc-800 rounded" />
              <div className="h-2.5 w-2/5 bg-zinc-850 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Display top 6 to 8 items
  const displaySongs = songs.slice(0, 8);

  if (displaySongs.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-2.5 sm:gap-3 select-none">
      {displaySongs.map((song, index) => {
        const isCurrent = currentSong?.id === song.id;
        const isCurrentActive = isCurrent && isPlaying;

        const rawImageKey = song.imageKey || (song as any).coverImageKey;
        const imageUrl = rawImageKey
          ? getImageUrl(rawImageKey, {
              width: 160,
              height: 160,
              focus: "auto",
              aspectRatio: "1-1",
            })
          : (song as any).posterUrl || "";

        const handlePlayClick = (e: React.MouseEvent) => {
          e.stopPropagation();
          if (isCurrent) {
            playerActions.setIsPlaying(!isPlaying);
          } else {
            playerActions.playWithRadio(mapToPlayerSong(song));
          }
        };

        const handleCardClick = () => {
          if (isCurrent) {
            playerActions.setIsPlaying(!isPlaying);
          } else {
            playerActions.playWithRadio(mapToPlayerSong(song));
          }
        };

        return (
          <motion.div
            key={`quick-pick-${song.id}-${index}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: index * 0.03 }}
            onClick={handleCardClick}
            className={`group relative flex items-center rounded-lg overflow-hidden transition-all duration-200 cursor-pointer border ${
              isCurrent
                ? "bg-white/15 border-white/20 shadow-md"
                : "bg-white/[0.06] hover:bg-white/[0.12] border-white/5 hover:border-white/10"
            }`}
          >
            {/* Left Cover Artwork */}
            <div className="w-14 sm:w-16 h-14 sm:h-16 shrink-0 relative bg-zinc-800 overflow-hidden">
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={song.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-zinc-850 text-zinc-500 text-xs font-semibold">
                  ♪
                </div>
              )}

              {/* Mini playing equalizer overlay on thumbnail if currently playing */}
              {isCurrentActive && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center gap-0.5">
                  <span className="w-1 h-3 bg-[#ffffff] rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1 h-4 bg-[#ffffff] rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1 h-2.5 bg-[#ffffff] rounded-full animate-bounce" />
                </div>
              )}
            </div>

            {/* Song Info */}
            <div className="flex-1 min-w-0 px-3 py-2 flex flex-col justify-center">
              <p
                className={`text-xs sm:text-sm font-bold truncate leading-tight transition-colors ${
                  isCurrent
                    ? "text-[#ffffff]"
                    : "text-white group-hover:text-white"
                }`}
              >
                {song.title}
              </p>
              <p className="text-[11px] sm:text-xs text-zinc-400 truncate mt-0.5 font-medium">
                {song.artistName || "Unknown Artist"}
              </p>
            </div>

            {/* Floating Play / Pause Action Button (Spotify Style) */}
            <div className="pr-3 pl-1 shrink-0 flex items-center">
              <button
                type="button"
                onClick={handlePlayClick}
                aria-label={isCurrentActive ? "Pause track" : "Play track"}
                className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#ffffff] hover:bg-[#20e266] text-black flex items-center justify-center shadow-lg transition-all duration-200 cursor-pointer active:scale-95 ${
                  isCurrentActive
                    ? "opacity-100 scale-100"
                    : "opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 group-focus-within:opacity-100 group-focus-within:translate-y-0 hover:scale-105"
                }`}
              >
                {isCurrentActive ? (
                  <Pause size={17} className="fill-black text-black" />
                ) : (
                  <Play
                    size={17}
                    className="fill-black text-black translate-x-0.5"
                  />
                )}
              </button>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
