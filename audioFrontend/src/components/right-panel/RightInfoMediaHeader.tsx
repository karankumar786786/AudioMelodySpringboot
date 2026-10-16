"use client";

import React from "react";
import Link from "next/link";
import { Disc, Music, Play, Plus } from "lucide-react";
import type { PlayerSong } from "@/lib/player-utils";
import { PlayerTooltip } from "@/components/player/PlayerTooltip";
import { HeartButton } from "@/components/HeartButton";
import { MarqueeTitle } from "./MarqueeTitle";

interface RightInfoMediaHeaderProps {
  currentSong: PlayerSong;
  directVideoUrl?: string;
  songImage?: string;
  mediaLoaded: boolean;
  setMediaLoaded: (loaded: boolean) => void;
  isFavourite: boolean;
  isFavLoading: boolean;
  onPlaylist: () => void;
  onFavourite: () => void;
  onOpenFullVideo: () => void;
}

export function RightInfoMediaHeader({
  currentSong,
  directVideoUrl,
  songImage,
  mediaLoaded,
  setMediaLoaded,
  isFavourite,
  isFavLoading,
  onPlaylist,
  onFavourite,
  onOpenFullVideo,
}: RightInfoMediaHeaderProps) {
  const activeVideoKey = currentSong.videoKey;

  return (
    <div className="relative w-full h-87.5 overflow-hidden rounded-t-2xl bg-zinc-900 shadow-2xl flex flex-col justify-end group">
      {directVideoUrl ? (
        <video
          key={`canvas-video-${currentSong.id}-${activeVideoKey}`}
          src={directVideoUrl}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          disablePictureInPicture
          onLoadedData={() => setMediaLoaded(true)}
          onCanPlay={() => setMediaLoaded(true)}
          onPlay={() => setMediaLoaded(true)}
          className={`absolute inset-0 w-full h-full object-cover object-center rounded-t-2xl transition-opacity duration-500 ease-in-out ${
            mediaLoaded ? "opacity-100" : "opacity-0"
          }`}
        />
      ) : songImage ? (
        <img
          key={`cover-img-${currentSong.id}`}
          src={songImage}
          alt={currentSong.title}
          onLoad={() => setMediaLoaded(true)}
          ref={(el) => {
            if (el && el.complete && !mediaLoaded) {
              setMediaLoaded(true);
            }
          }}
          className={`absolute inset-0 w-full h-full object-cover object-center rounded-t-2xl group-hover:scale-105 transition-all duration-700 ease-out ${
            mediaLoaded ? "opacity-100 scale-100" : "opacity-0 scale-95"
          }`}
        />
      ) : (
        <div className="absolute inset-0 w-full h-full flex items-center justify-center text-zinc-700 bg-zinc-950 rounded-t-2xl">
          <Music size={56} />
        </div>
      )}

      {!mediaLoaded && (directVideoUrl || songImage) && (
        <div className="absolute inset-0 bg-zinc-900 rounded-t-2xl animate-pulse flex items-center justify-center transition-opacity duration-500">
          <Music size={36} className="text-zinc-700 animate-pulse" />
        </div>
      )}

      {/* Floating Full Video Badge at Top-Right */}
      {currentSong.fullVideoKey && (
        <div className="absolute top-3 right-3 z-20">
          <PlayerTooltip content="Watch Full Video" shortcut="V">
            <button
              onClick={onOpenFullVideo}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 hover:bg-black/85 backdrop-blur-md border border-white/20 text-white text-[11px] font-semibold transition-all hover:scale-105 active:scale-95 shadow-lg cursor-pointer"
            >
              <Play size={11} fill="currentColor" />
              Full Video
            </button>
          </PlayerTooltip>
        </div>
      )}

      {/* Seamless Bottom Gradient Overlay */}
      <div className="absolute inset-x-0 bottom-0 h-32 bg-linear-to-t from-black via-black/80 to-transparent pointer-events-none" />

      {/* Overlaid Song Title, Artist & Actions */}
      <div className="relative z-10 p-4 pb-3 flex items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <MarqueeTitle
            text={currentSong.title}
            className="text-lg xl:text-xl font-bold text-white tracking-tight cursor-pointer leading-snug drop-shadow-md hover:underline"
          />
          <p className="text-xs font-medium text-zinc-300 truncate mt-1 hover:text-white hover:underline cursor-pointer drop-shadow">
            {currentSong.artistName}
          </p>
          {(currentSong.genre || currentSong.album) && (
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              {currentSong.album && (
                <Link
                  href={`/albums/${encodeURIComponent(currentSong.album)}`}
                  className="text-[10px] px-2.5 py-0.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-zinc-200 font-semibold truncate max-w-42.5 inline-flex items-center gap-1 shadow-sm transition-colors cursor-pointer"
                  title={`View Album: ${currentSong.album}`}
                >
                  <Disc size={11} className="text-zinc-400 shrink-0" />
                  <span className="truncate">{currentSong.album}</span>
                </Link>
              )}
              {currentSong.genre && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/20 border border-primary/30 text-primary font-bold uppercase tracking-wider">
                  {currentSong.genre}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0 pb-0.5">
          <button
            onClick={onPlaylist}
            className="text-zinc-400 hover:text-white transition-colors cursor-pointer p-1"
            title="Add to playlist"
          >
            <Plus size={20} />
          </button>

          <HeartButton
            isFavourite={isFavourite}
            onToggle={onFavourite}
            size={20}
            disabled={isFavLoading}
          />
        </div>
      </div>
    </div>
  );
}
