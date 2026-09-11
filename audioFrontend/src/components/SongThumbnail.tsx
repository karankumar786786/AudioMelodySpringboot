"use client";

import { motion } from "framer-motion";
import { Play, Pause, Music, Loader2 } from "lucide-react";
import { type Song } from "@/lib/api";
import { previewPlayer, previewStore } from "@/lib/preview-player";
import { playerStore } from "@/store/player.store";
import { useStore } from "@tanstack/react-store";
import { getImageUrl } from "@/lib/image-utils";

export interface SongThumbnailProps {
  song: Song | any;
  sizeClass?: string; // e.g. "w-10 h-10", "h-11 w-11", "w-9 h-9", "w-8 h-8"
  className?: string;
  roundedClass?: string; // e.g. "rounded-md", "rounded-lg"
  enablePreviewHover?: boolean;
  onPlayClick?: (e: React.MouseEvent) => void;
  priority?: boolean;
}

export function SongThumbnail({
  song,
  sizeClass = "w-10 h-10",
  className = "",
  roundedClass = "rounded-md",
  enablePreviewHover = true,
  onPlayClick,
  priority = false,
}: SongThumbnailProps) {
  const currentSong = useStore(playerStore, (s) => s.currentSong);
  const isPlaying = useStore(playerStore, (s) => s.isPlaying);
  const isAudioLoading = useStore(playerStore, (s) => s.isLoading);
  const previewState = useStore(previewStore, (s) => s);

  if (!song) return null;

  const isActiveSong = currentSong?.id === song.id;
  const isCurrentPlaying = isActiveSong && isPlaying;
  const isPreviewTarget = previewState.songId === song.id;
  const isCountingDown = isPreviewTarget && previewState.status === "countdown";
  const isPreviewLoading = isPreviewTarget && previewState.status === "loading";
  const isPreviewPlaying = isPreviewTarget && previewState.status === "playing";

  const rawImageKey = song.imageKey || song.coverImageKey;
  const imageUrl = rawImageKey
    ? getImageUrl(rawImageKey, {
        width: 120,
        height: 120,
        aspectRatio: "1-1",
      })
    : song.posterUrl || "";

  const handleMouseEnter = () => {
    if (enablePreviewHover && song.id && (!isActiveSong || !isPlaying)) {
      previewPlayer.startHoverCountdown(song);
    }
  };

  const handleMouseLeave = () => {
    if (enablePreviewHover) {
      previewPlayer.stopPreview();
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    previewPlayer.stopPreview(true);
    if (onPlayClick) {
      onPlayClick(e);
    }
  };

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      className={`relative overflow-hidden shrink-0 bg-zinc-900 group/thumb cursor-pointer select-none ${sizeClass} ${roundedClass} ${
        isPreviewPlaying
          ? "ring-2 ring-primary ring-offset-1 ring-offset-black"
          : isActiveSong
          ? "ring-1 ring-primary/60"
          : ""
      } ${className}`}
      title={
        isPreviewPlaying
          ? `Playing preview: ${song.title} (Click to play full track)`
          : isCountingDown
          ? `Hold to preview: ${song.title}`
          : isActiveSong && isPlaying
          ? "Pause"
          : "Hover to preview (Click to play)"
      }
    >
      {/* Background Image or Fallback */}
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={song.title || "Song thumbnail"}
          loading={priority ? "eager" : "lazy"}
          className="w-full h-full object-cover transition-transform duration-300 group-hover/thumb:scale-105"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-zinc-600 bg-zinc-800">
          <Music size={15} />
        </div>
      )}

      {/* 1. COUNTDOWN STATE OVERLAY */}
      {isCountingDown && (
        <div className="absolute inset-0 bg-black/75 backdrop-blur-[1px] flex items-center justify-center z-20 animate-in fade-in duration-100">
          <svg
            className="absolute inset-0 w-full h-full -rotate-90 p-0.5 pointer-events-none"
            viewBox="0 0 36 36"
          >
            <circle
              cx="18"
              cy="18"
              r="15"
              fill="none"
              stroke="rgba(255, 255, 255, 0.25)"
              strokeWidth="2.5"
            />
            <motion.circle
              cx="18"
              cy="18"
              r="15"
              fill="none"
              stroke="#ffffffff"
              strokeWidth="2.5"
              strokeDasharray={94.25}
              initial={{ strokeDashoffset: 94.25 }}
              animate={{ strokeDashoffset: 0 }}
              transition={{ duration: 1, ease: "linear" }}
              strokeLinecap="round"
            />
          </svg>
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
        </div>
      )}

      {/* 2. LOADING STATE OVERLAY */}
      {isPreviewLoading && (
        <div className="absolute inset-0 bg-black/75 backdrop-blur-[1px] flex items-center justify-center z-20">
          <Loader2 size={16} className="text-primary animate-spin" />
        </div>
      )}

      {/* 3. PLAYING PREVIEW STATE OVERLAY */}
      {isPreviewPlaying && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-[1px] flex items-center justify-center z-20">
          {/* Pulsing beat expansion ripple */}
          <span className="absolute inset-0 rounded-[inherit] border border-primary animate-ping opacity-40 pointer-events-none" />

          {/* Real-time Progress Ring */}
          <svg
            className="absolute inset-0 w-full h-full -rotate-90 p-0.5 pointer-events-none drop-shadow-[0_0_6px_rgba(30,215,96,0.6)]"
            viewBox="0 0 36 36"
          >
            <circle
              cx="18"
              cy="18"
              r="15"
              fill="none"
              stroke="rgba(255, 255, 255, 1)"
              strokeWidth="2.5"
            />
            <circle
              cx="18"
              cy="18"
              r="15"
              fill="none"
              stroke="#ffffffff"
              strokeWidth="2.5"
              strokeDasharray={94.25}
              strokeDashoffset={
                94.25 *
                (1 - Math.min(1, Math.max(0, previewState.progress || 0)))
              }
              strokeLinecap="round"
              className="transition-[stroke-dashoffset] duration-150 ease-linear"
            />
          </svg>

          {/* Dancing Spotify-style Equalizer Bars */}
          <div className="flex items-end justify-center gap-[2px] h-3.5 w-3.5 relative z-10">
            <motion.span
              animate={{ height: ["20%", "100%", "30%"] }}
              transition={{
                duration: 0.5,
                repeat: Infinity,
                repeatType: "reverse",
                ease: "easeInOut",
              }}
              className="w-[2px] bg-primary rounded-full"
            />
            <motion.span
              animate={{ height: ["80%", "20%", "90%"] }}
              transition={{
                duration: 0.4,
                repeat: Infinity,
                repeatType: "reverse",
                ease: "easeInOut",
                delay: 0.1,
              }}
              className="w-[2px] bg-primary rounded-full"
            />
            <motion.span
              animate={{ height: ["30%", "90%", "20%"] }}
              transition={{
                duration: 0.45,
                repeat: Infinity,
                repeatType: "reverse",
                ease: "easeInOut",
                delay: 0.2,
              }}
              className="w-[2px] bg-primary rounded-full"
            />
          </div>
        </div>
      )}

      {/* 4. ACTIVE SONG FULL PLAYBACK STATE */}
      {!isPreviewPlaying && !isCountingDown && !isPreviewLoading && isCurrentPlaying && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10">
          {isAudioLoading ? (
            <Loader2 size={16} className="text-primary animate-spin" />
          ) : (
            <Pause size={14} className="text-primary" fill="currentColor" />
          )}
        </div>
      )}

      {/* 5. DEFAULT HOVER PLAY ICON */}
      {!isPreviewPlaying &&
        !isCountingDown &&
        !isPreviewLoading &&
        !isCurrentPlaying && (
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center text-white transition-opacity duration-200 z-10">
            <Play size={14} fill="white" className="translate-x-0.5" />
          </div>
        )}
    </div>
  );
}
