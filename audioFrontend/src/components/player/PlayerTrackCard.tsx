"use client";

import React from "react";
import Link from "next/link";
import { Music, Play, Radio, Share2, Plus, Ban, Video } from "lucide-react";
import { playerActions } from "@/store/player.store";
import { type PlayerSong } from "@/lib/player-utils";
import { useAppDispatch } from "@/store/hooks";
import { openModal } from "@/store/slices/uiSlice";
import { toast } from "sonner";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

interface PlayerTrackCardProps {
  currentSong: PlayerSong;
  posterUrl?: string;
}

export const PlayerTrackCard: React.FC<PlayerTrackCardProps> = ({
  currentSong,
  posterUrl,
}) => {
  const dispatch = useAppDispatch();
  const hasFullVideo = Boolean(
    currentSong.fullVideoKey || (currentSong as any).full_video_key,
  );

  const handleStartRadio = () => {
    playerActions.playWithRadio(currentSong);
    toast.success("Playing Song Radio", {
      description: `Starting infinite radio for "${currentSong.title}"...`,
    });
  };

  const handleShare = () => {
    dispatch(openModal("shareSong"));
  };

  const handleDislike = () => {
    playerActions.dislikeSong(currentSong.id);
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 w-[28%] md:w-[30%] max-w-60 md:max-w-[320px] select-none">
          <div
            onClick={() => {
              if (hasFullVideo) {
                playerActions.openFullVideo();
              }
            }}
            className={`w-12 h-12 sm:w-14 sm:h-14 shrink-0 rounded-lg overflow-hidden bg-zinc-900 shadow-md relative group border border-white/10 ${
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
              {currentSong.album && (
                <Link
                  href={`/albums/${encodeURIComponent(currentSong.album)}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-zinc-400 hover:text-white hover:underline transition-colors"
                  title={`View Album: ${currentSong.album}`}
                >
                  {" "}• {currentSong.album}
                </Link>
              )}
              {currentSong.genre && (
                <span className="text-zinc-500"> • {currentSong.genre}</span>
              )}
            </p>
          </div>
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent className="w-52 bg-[#181818]/95 border-white/10 backdrop-blur-xl">
        <ContextMenuItem
          onClick={handleStartRadio}
          className="gap-2.5 text-xs text-zinc-200 focus:bg-white/10 cursor-pointer"
        >
          <Radio size={14} className="text-cyan-400" />
          <span>Start song radio</span>
        </ContextMenuItem>

        {hasFullVideo && (
          <ContextMenuItem
            onClick={() => playerActions.openFullVideo()}
            className="gap-2.5 text-xs text-zinc-200 focus:bg-white/10 cursor-pointer"
          >
            <Video size={14} className="text-primary" />
            <span>Watch full video</span>
          </ContextMenuItem>
        )}

        <ContextMenuItem
          onClick={handleShare}
          className="gap-2.5 text-xs text-zinc-200 focus:bg-white/10 cursor-pointer"
        >
          <Share2 size={14} className="text-primary" />
          <span>Share track</span>
        </ContextMenuItem>

        <ContextMenuSeparator className="bg-white/10" />

        <ContextMenuItem
          onClick={handleDislike}
          className="gap-2.5 text-xs text-zinc-400 focus:text-red-400 focus:bg-red-500/10 cursor-pointer"
        >
          <Ban size={14} className="text-zinc-400" />
          <span>Don't play this again</span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};
