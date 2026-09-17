"use client";

import { useStore } from "@tanstack/react-store";
import { motion } from "framer-motion";
import { Loader2, Pause, Play } from "lucide-react";
import type React from "react";
import type { Song } from "../lib/api";
import { getImageUrl } from "../lib/image-utils";
import { mapToPlayerSong } from "../lib/player-utils";
import { previewPlayer, previewStore } from "../lib/preview-player";
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
  const isAudioLoading = useStore(playerStore, (s) => s.isLoading);
  const previewState = useStore(previewStore, (s) => s);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 sm:gap-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="h-13 sm:h-14 rounded-lg bg-zinc-900/80 border border-white/5 flex items-center gap-3 overflow-hidden animate-pulse"
          >
            <div className="w-13 sm:w-14 h-full bg-zinc-800 shrink-0" />
            <div className="flex-1 space-y-1.5 pr-4">
              <div className="h-3 w-3/5 bg-zinc-800 rounded" />
              <div className="h-2.5 w-2/5 bg-zinc-850 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Display top 6 items (2 rows x 3 columns on desktop)
  const displaySongs = songs.slice(0, 6);

  if (displaySongs.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 sm:gap-3 select-none">
      {displaySongs.map((song, index) => {
        const isCurrent = currentSong?.id === song.id;
        const isCurrentActive = isCurrent && isPlaying;

        // Preview state for this specific song
        const isPreviewTarget = previewState.songId === song.id;
        const isCountingDown =
          isPreviewTarget && previewState.status === "countdown";
        const isPreviewLoading =
          isPreviewTarget && previewState.status === "loading";
        const isPreviewPlaying =
          isPreviewTarget && previewState.status === "playing";

        const showPlayButton =
          isCurrentActive ||
          isPreviewPlaying ||
          isCountingDown ||
          isPreviewLoading;

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
          previewPlayer.stopPreview(true);
          if (isCurrent) {
            playerActions.setIsPlaying(!isPlaying);
          } else {
            playerActions.playWithRadio(mapToPlayerSong(song));
          }
        };

        const handleCardClick = () => {
          previewPlayer.stopPreview(true);
          if (isCurrent) {
            playerActions.setIsPlaying(!isPlaying);
          } else {
            playerActions.playWithRadio(mapToPlayerSong(song));
          }
        };

        const handlePlayMouseEnter = () => {
          if (!isCurrent || !isPlaying) {
            previewPlayer.startHoverCountdown(song);
          }
        };

        const handlePlayMouseLeave = () => {
          previewPlayer.stopPreview();
        };

        return (
          <motion.div
            key={`quick-pick-${song.id}-${index}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: index * 0.03 }}
            onClick={handleCardClick}
            className={`group relative flex items-center rounded-lg overflow-hidden transition-all duration-200 cursor-pointer border ${
              isCurrent || isPreviewPlaying
                ? "bg-white/15 border-white/25 shadow-md"
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

              {/* Mini playing equalizer overlay on thumbnail if currently playing full track or preview */}
              {(isCurrentActive || isPreviewPlaying) && (
                <div className="absolute inset-0 bg-black/45 flex items-center justify-center gap-0.5 z-10">
                  <span className="w-1 h-3 bg-white rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1 h-4 bg-white rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1 h-2.5 bg-white rounded-full animate-bounce" />
                </div>
              )}
            </div>

            {/* Song Info */}
            <div className="flex-1 min-w-0 px-3 py-2 flex flex-col justify-center">
              <div className="flex items-center gap-1.5 min-w-0">
                <p
                  className={`text-xs sm:text-sm font-bold truncate leading-tight transition-colors ${
                    isCurrent || isPreviewPlaying
                      ? "text-white"
                      : "text-zinc-100 group-hover:text-white"
                  }`}
                >
                  {song.title}
                </p>
                {isPreviewPlaying && (
                  <span className="shrink-0 text-[9px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded bg-white text-black leading-none">
                    Preview
                  </span>
                )}
              </div>
              <p className="text-[11px] sm:text-xs text-zinc-400 truncate mt-0.5 font-medium">
                {song.artistName || "Unknown Artist"}
              </p>
            </div>

            {/* Floating Play / Pause Action Button with Hover Preview (SongCard Style) */}
            <div className="pr-3 pl-1 shrink-0 flex items-center justify-center">
              <div
                className={`relative w-10 h-10 flex items-center justify-center transition-all duration-200 ${
                  showPlayButton
                    ? "opacity-100 scale-100 translate-y-0"
                    : "opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 group-focus-within:opacity-100 group-focus-within:translate-y-0"
                }`}
              >
                {/* Circular SVG countdown ring when hovering before preview begins */}
                {isCountingDown && (
                  <svg
                    className="absolute -top-1 -left-1 w-12 h-12 -rotate-90 pointer-events-none z-20"
                    viewBox="0 0 48 48"
                    aria-hidden="true"
                  >
                    <circle
                      cx="24"
                      cy="24"
                      r="21"
                      fill="none"
                      stroke="rgba(255, 255, 255, 0.2)"
                      strokeWidth="2.5"
                    />
                    <motion.circle
                      cx="24"
                      cy="24"
                      r="21"
                      fill="none"
                      stroke="#ffffff"
                      strokeWidth="2.5"
                      strokeDasharray={132}
                      initial={{ strokeDashoffset: 132 }}
                      animate={{ strokeDashoffset: 0 }}
                      transition={{ duration: 1, ease: "linear" }}
                      strokeLinecap="round"
                    />
                  </svg>
                )}

                {/* Real-time Progress Ring & Pulsing Beat Expansion when preview is actively playing */}
                {isPreviewPlaying && (
                  <>
                    <span className="absolute -inset-1 rounded-full border border-white animate-ping opacity-50 pointer-events-none" />
                    <motion.span
                      className="absolute -inset-2 rounded-full border border-white/40 pointer-events-none"
                      animate={{ scale: [1, 1.15, 1], opacity: [0.6, 0, 0.6] }}
                      transition={{
                        duration: 1.2,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    />
                    <svg
                      className="absolute -top-1 -left-1 w-12 h-12 -rotate-90 pointer-events-none z-20 drop-shadow-[0_0_6px_rgba(255,255,255,0.7)]"
                      viewBox="0 0 48 48"
                      aria-hidden="true"
                    >
                      <circle
                        cx="24"
                        cy="24"
                        r="21"
                        fill="none"
                        stroke="rgba(255, 255, 255, 0.2)"
                        strokeWidth="2.5"
                      />
                      <circle
                        cx="24"
                        cy="24"
                        r="21"
                        fill="none"
                        stroke="#ffffff"
                        strokeWidth="2.5"
                        strokeDasharray={132}
                        strokeDashoffset={
                          132 *
                          (1 -
                            Math.min(
                              1,
                              Math.max(0, previewState.progress || 0),
                            ))
                        }
                        strokeLinecap="round"
                        className="transition-[stroke-dashoffset] duration-150 ease-linear"
                      />
                    </svg>
                  </>
                )}

                <button
                  type="button"
                  onClick={handlePlayClick}
                  onMouseEnter={handlePlayMouseEnter}
                  onMouseLeave={handlePlayMouseLeave}
                  aria-label={
                    isCurrentActive
                      ? "Pause track"
                      : isPreviewPlaying
                        ? "Play full track"
                        : "Play track"
                  }
                  title={
                    isCurrentActive
                      ? "Pause"
                      : isPreviewPlaying
                        ? "Playing Preview (Click for Full Track)"
                        : "Play Track (Hover for preview)"
                  }
                  className={`w-10 h-10 rounded-full bg-[#ffffff] hover:bg-zinc-200 text-black flex items-center justify-center shadow-lg transition-transform duration-200 cursor-pointer hover:scale-105 active:scale-95 relative z-10 ${
                    isPreviewPlaying
                      ? "ring-2 ring-white ring-offset-2 ring-offset-black"
                      : ""
                  }`}
                >
                  {isCurrentActive ? (
                    isAudioLoading ? (
                      <Loader2 size={16} className="animate-spin text-black" />
                    ) : (
                      <Pause size={17} className="fill-black text-black" />
                    )
                  ) : isPreviewLoading ? (
                    <Loader2 size={16} className="animate-spin text-black" />
                  ) : isPreviewPlaying ? (
                    <div className="flex items-end justify-center gap-0.5 h-3.5 w-3.5">
                      <motion.span
                        animate={{ height: ["30%", "100%", "40%"] }}
                        transition={{
                          duration: 0.5,
                          repeat: Infinity,
                          repeatType: "reverse",
                          ease: "easeInOut",
                        }}
                        className="w-0.5 bg-black rounded-full"
                      />
                      <motion.span
                        animate={{ height: ["80%", "30%", "100%"] }}
                        transition={{
                          duration: 0.4,
                          repeat: Infinity,
                          repeatType: "reverse",
                          ease: "easeInOut",
                          delay: 0.1,
                        }}
                        className="w-0.5 bg-black rounded-full"
                      />
                      <motion.span
                        animate={{ height: ["40%", "90%", "20%"] }}
                        transition={{
                          duration: 0.45,
                          repeat: Infinity,
                          repeatType: "reverse",
                          ease: "easeInOut",
                          delay: 0.2,
                        }}
                        className="w-0.5 bg-black rounded-full"
                      />
                    </div>
                  ) : (
                    <Play
                      size={17}
                      className="fill-black text-black translate-x-0.5"
                    />
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
