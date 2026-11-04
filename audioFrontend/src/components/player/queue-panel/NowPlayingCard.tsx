"use client";

import React from "react";
import { Music } from "lucide-react";
import { getImageUrl } from "@/lib/image-utils";
import { formatDuration } from "@/lib/player-utils";
import type { Song } from "@/lib/api/types";

interface NowPlayingCardProps {
  currentSong: Song;
}

export const NowPlayingCard: React.FC<NowPlayingCardProps> = ({ currentSong }) => {
  const nowPlayingImage = currentSong?.imageKey
    ? getImageUrl(currentSong.imageKey, {
        width: 120,
        height: 120,
        aspectRatio: "1-1",
      })
    : (currentSong as any)?.posterUrl || "";

  return (
    <div className="space-y-1.5 w-full min-w-0">
      <h4 className="text-[11px] font-bold text-zinc-400 tracking-wider uppercase px-0.5">
        Now Playing
      </h4>
      <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/[0.08] p-2.5 transition-colors w-full min-w-0 shadow-sm">
        <div className="w-12 h-12 rounded-lg overflow-hidden bg-zinc-900 shrink-0 shadow-md">
          {nowPlayingImage ? (
            <img
              src={nowPlayingImage}
              alt={currentSong.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zinc-500">
              <Music size={18} />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold text-white truncate leading-snug">
            {currentSong.title}
          </p>
          <p className="text-[11.5px] text-zinc-300 truncate leading-normal">
            <span className="text-zinc-200 font-medium">{currentSong.artistName}</span>
            {currentSong.album && (
              <span className="text-zinc-400 font-normal"> • {currentSong.album}</span>
            )}
            {currentSong.genre && (
              <span className="text-zinc-400 font-normal"> • {currentSong.genre}</span>
            )}
          </p>
        </div>
        <span className="text-[11.5px] font-mono font-medium text-zinc-300 tabular-nums shrink-0 pl-2">
          {formatDuration(currentSong.duration)}
        </span>
      </div>
    </div>
  );
};
