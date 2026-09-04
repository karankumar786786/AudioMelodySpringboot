"use client";

import React from "react";
import { Music, Play } from "lucide-react";
import { playerActions } from "@/store/player.store";
import { type PlayerSong } from "@/lib/player-utils";

interface PlayerTrackCardProps {
  currentSong: PlayerSong;
  posterUrl?: string;
}

export const PlayerTrackCard: React.FC<PlayerTrackCardProps> = ({
  currentSong,
  posterUrl,
}) => {
  const hasFullVideo = Boolean(
    currentSong.fullVideoKey || (currentSong as any).full_video_key,
  );

  return (
    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 w-[28%] md:w-[30%] max-w-[240px] md:max-w-[320px]">
      <div
        onClick={() => {
          if (hasFullVideo) {
            playerActions.openFullVideo();
          }
        }}
        className={`w-12 h-12 sm:w-14 sm:h-14 shrink-0 rounded-md overflow-hidden bg-zinc-900 shadow-md relative group ${
          hasFullVideo ? "cursor-pointer" : ""
        }`}
        title={hasFullVideo ? "Watch Full Video (V)" : undefined}
      >
        {posterUrl ? (
          <img src={posterUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-zinc-600">
            <Music size={20} />
          </div>
        )}
        {hasFullVideo && (
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
            <Play
              size={16}
              fill="white"
              className="text-white translate-x-0.5"
            />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <h4 className="text-xs sm:text-sm font-semibold text-white truncate hover:underline cursor-pointer">
          {currentSong.title}
        </h4>
        <p className="text-[11px] sm:text-xs text-zinc-400 truncate hover:underline hover:text-white cursor-pointer mt-0.5 font-normal">
          {currentSong.artistName}
        </p>
      </div>
    </div>
  );
};
