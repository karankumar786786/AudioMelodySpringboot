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
        width: 90,
        height: 90,
        aspectRatio: "1-1",
      })
    : (currentSong as any)?.posterUrl || "";

  return (
    <div className="space-y-1.5">
      <h4 className="text-[11px] font-bold text-primary tracking-wider uppercase px-1">
        Now Playing
      </h4>
      <div className="flex items-center gap-3 rounded-lg border border-[#282828] bg-[#222222] p-2.5">
        <div className="w-11 h-11 rounded-md overflow-hidden bg-zinc-900 shrink-0">
          {nowPlayingImage ? (
            <img
              src={nowPlayingImage}
              alt={currentSong.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zinc-600">
              <Music size={18} />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-white truncate">
            {currentSong.title}
          </p>
          <p className="text-[11px] text-zinc-400 truncate">
            {currentSong.artistName}
            {currentSong.album && (
              <span className="text-zinc-400"> • {currentSong.album}</span>
            )}
            {currentSong.genre && (
              <span className="text-zinc-500"> • {currentSong.genre}</span>
            )}
          </p>
        </div>
        <span className="text-[11px] font-medium text-zinc-400 tabular-nums shrink-0 pr-1">
          {formatDuration(currentSong.duration)}
        </span>
      </div>
    </div>
  );
};
