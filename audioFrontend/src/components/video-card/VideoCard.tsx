"use client";

import React from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Film, Play } from "lucide-react";
import { toast } from "sonner";
import { useAppSelector } from "@/store/hooks";
import { getImageUrl } from "@/lib/image-utils";
import { formatDuration, mapToPlayerSong } from "@/lib/player-utils";
import { previewPlayer } from "@/lib/preview-player";
import { playerActions, playerStore } from "@/store/player.store";
import { cn } from "@/lib/utils";
import type { Song } from "@/lib/api/types";

export interface VideoCardProps {
  song: Song;
  className?: string;
  priority?: boolean;
}

export function VideoCard({ song, className, priority = false }: VideoCardProps) {
  const systemUser = useAppSelector((s) => s.auth.systemUser);
  const currentSong = useAppSelector((s) => s.player.currentSong);
  const isPlaying = useAppSelector((s) => s.player.isPlaying);
  const isFullVideoOpen = useAppSelector((s) => s.ui.isFullVideoOpen);

  const isCurrentActive = currentSong?.id === song.id;
  const isCurrentlyPlayingVideo = isCurrentActive && isFullVideoOpen && isPlaying;

  const rawImageKey = song.imageKey || (song as any).coverImageKey;
  const thumbnailUrl = rawImageKey
    ? getImageUrl(rawImageKey, {
        width: 800,
        height: 450,
        focus: "auto",
        aspectRatio: "16-9",
      })
    : (song as any).posterUrl || "";

  const handleWatchVideo = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();

    if (!systemUser) {
      toast.error("Authentication required", {
        description: "Please sign in to watch full music videos.",
      });
      playerStore.setState((s) => ({ ...s, isAuthModalOpen: true }));
      return;
    }

    // Stop 30s preview if playing
    previewPlayer.stopPreview(true);

    const playerSong = mapToPlayerSong(song);

    // If a different track is currently loaded in the player, start playback for this song
    if (playerStore.state.currentSong?.id !== song.id) {
      playerActions.playWithRadio(playerSong);
    } else if (!playerStore.state.isPlaying) {
      playerActions.setIsPlaying(true);
    }

    // Immediately open high-definition full video view
    playerActions.openFullVideo();
  };

  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "group relative flex flex-col cursor-pointer select-none rounded-2xl bg-zinc-900/50 hover:bg-zinc-900/90 p-3.5 transition-all duration-300 border border-white/8 hover:border-white/25 hover:shadow-2xl hover:shadow-black/70",
        className,
      )}
      onClick={handleWatchVideo}
    >
      {/* 16:9 Widescreen Video Thumbnail Container (+30% Larger Visual Surface) */}
      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-zinc-950 border border-white/10 shadow-inner">
        {thumbnailUrl ? (
          <Image
            src={thumbnailUrl}
            alt={song.title}
            fill
            sizes="(max-width: 640px) 90vw, (max-width: 1024px) 55vw, 35vw"
            priority={priority}
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-zinc-800 to-zinc-950 text-zinc-500">
            <Film className="h-12 w-12 stroke-[1.5]" />
          </div>
        )}

        {/* Ambient Dark Gradient Vignette for Readability */}
        <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/90 via-black/25 to-black/35 transition-opacity duration-300 group-hover:opacity-85" />

        {/* Top-Left: "Music Video" Badge (Pure White Monochrome) */}
        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 rounded-full bg-black/75 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur-md border border-white/20 shadow-md">
          <Film className="h-3.5 w-3.5 text-white shrink-0" />
          <span className="tracking-wider uppercase text-[9px] font-extrabold text-white">Video</span>
        </div>

        {/* Bottom-Right: Duration Badge */}
        {song.duration ? (
          <div className="absolute bottom-2.5 right-2.5 rounded-md bg-black/85 px-2 py-0.5 font-mono text-[11px] font-semibold text-white backdrop-blur-md border border-white/15 tabular-nums">
            {formatDuration(song.duration)}
          </div>
        ) : null}

        {/* Center Hover Play Button (Pure White & Glowing) */}
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            whileHover={{ scale: 1.1 }}
            animate={
              isCurrentlyPlayingVideo
                ? { scale: 1, opacity: 1 }
                : { scale: 1, opacity: 0 }
            }
            className="group-hover:opacity-100 flex h-14 w-14 items-center justify-center rounded-full bg-white text-black shadow-2xl shadow-white/40 transition-all duration-300 group-hover:scale-100 cursor-pointer"
          >
            <Play className="h-6 w-6 fill-black translate-x-0.5 text-black" />
          </motion.div>
        </div>
      </div>

      {/* Video Metadata (+30% Proportional Typography) */}
      <div className="mt-3 flex flex-col px-0.5">
        <h3
          className={cn(
            "truncate text-base font-semibold tracking-tight transition-colors duration-150",
            isCurrentActive ? "text-white font-bold underline decoration-white/50 underline-offset-4" : "text-white group-hover:text-white",
          )}
          title={song.title}
        >
          {song.title}
        </h3>

        <div className="mt-1 flex items-center justify-between text-sm text-zinc-400">
          <p className="truncate text-zinc-400 group-hover:text-zinc-200 transition-colors">
            {song.artistName || "Unknown Artist"}
          </p>
          {song.album && (
            <span className="ml-1.5 hidden truncate text-xs text-zinc-500 sm:inline" title={song.album}>
              • {song.album}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default VideoCard;
