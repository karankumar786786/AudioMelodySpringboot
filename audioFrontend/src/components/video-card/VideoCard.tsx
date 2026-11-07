"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
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
        width: 640,
        height: 360,
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
      whileHover={{ y: -3 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "group relative flex flex-col cursor-pointer select-none rounded-2xl bg-zinc-900/40 hover:bg-zinc-900/80 p-2.5 transition-all duration-300 border border-white/5 hover:border-white/15 hover:shadow-xl hover:shadow-black/60",
        className,
      )}
      onClick={handleWatchVideo}
    >
      {/* 16:9 Widescreen Video Thumbnail Container */}
      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-zinc-950 border border-white/10 shadow-inner">
        {thumbnailUrl ? (
          <Image
            src={thumbnailUrl}
            alt={song.title}
            fill
            sizes="(max-width: 640px) 80vw, (max-width: 1024px) 45vw, 30vw"
            priority={priority}
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-950 text-zinc-600">
            <Film className="h-10 w-10 stroke-[1.5]" />
          </div>
        )}

        {/* Ambient Dark Gradient Vignette for Readability */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/40 transition-opacity duration-300 group-hover:opacity-90" />

        {/* Top-Left: "Music Video" Badge */}
        <div className="absolute top-2 left-2 flex items-center gap-1.5 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 backdrop-blur-md border border-emerald-500/20 shadow-sm">
          <Film className="h-3 w-3 text-emerald-400 shrink-0" />
          <span className="tracking-wide uppercase text-[9px] font-bold">Video</span>
        </div>

        {/* Bottom-Right: Duration Badge */}
        {song.duration ? (
          <div className="absolute bottom-2 right-2 rounded-md bg-black/80 px-1.5 py-0.5 font-mono text-[10px] font-medium text-zinc-300 backdrop-blur-md border border-white/10 tabular-nums">
            {formatDuration(song.duration)}
          </div>
        ) : null}

        {/* Center Hover Play Button with Emerald Shimmer */}
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            whileHover={{ scale: 1.08 }}
            animate={
              isCurrentlyPlayingVideo
                ? { scale: 1, opacity: 1 }
                : { scale: 1, opacity: 0 }
            }
            className="group-hover:opacity-100 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-black shadow-lg shadow-emerald-500/40 transition-all duration-300 group-hover:scale-100 cursor-pointer"
          >
            <Play className="h-5 w-5 fill-black translate-x-0.5" />
          </motion.div>
        </div>
      </div>

      {/* Video Metadata */}
      <div className="mt-2.5 flex flex-col px-0.5">
        <h3
          className={cn(
            "truncate text-sm font-semibold tracking-tight transition-colors duration-150",
            isCurrentActive ? "text-emerald-400 font-bold" : "text-white group-hover:text-emerald-300",
          )}
          title={song.title}
        >
          {song.title}
        </h3>

        <div className="mt-0.5 flex items-center justify-between text-xs text-zinc-400">
          <p className="truncate text-zinc-400 group-hover:text-zinc-300 transition-colors">
            {song.artistName || "Unknown Artist"}
          </p>
          {song.album && (
            <span className="ml-1.5 hidden truncate text-[11px] text-zinc-500 sm:inline" title={song.album}>
              • {song.album}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default VideoCard;

