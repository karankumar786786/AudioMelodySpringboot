"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useStore } from "@tanstack/react-store";
import { playerStore } from "@/store/player.store";
import { getSongInfo } from "@/lib/song-info";
import { ExternalLink, Music, User, Info } from "lucide-react";
import { getImageUrl } from "@/lib/image-utils";

export function RightInfoPanel() {
  const currentSong = useStore(playerStore, (s) => s.currentSong);

  const { data: info, isLoading, isError } = useQuery({
    queryKey: ["song-info", currentSong?.id, currentSong?.title, currentSong?.artistName],
    queryFn: () => getSongInfo(currentSong?.title || "", currentSong?.artistName || ""),
    enabled: !!currentSong,
    staleTime: 1000 * 60 * 60, // Cache for 1 hour
  });

  if (!currentSong) {
    return (
      <aside className="w-80 bg-[#121212] border-l border-[#282828] h-screen fixed right-0 top-0 z-40 p-6 flex flex-col items-center justify-center text-center pb-24">
        <div className="w-14 h-14 rounded-full bg-[#181818] border border-[#282828] flex items-center justify-center text-zinc-600 mb-3">
          <Info size={24} />
        </div>
        <p className="text-sm font-semibold text-white">Song & Artist Info</p>
        <p className="text-xs text-zinc-400 mt-1 max-w-[200px]">
          Play a song to view description, artist biography, and source links.
        </p>
      </aside>
    );
  }

  // Cover image fallback for artist if wikipedia image isn't available
  const artistCoverUrl = currentSong.imageKey
    ? getImageUrl(currentSong.imageKey, { width: 200, height: 200, aspectRatio: "1-1" })
    : null;

  return (
    <aside className="w-80 bg-[#121212] border-l border-[#282828] h-screen fixed right-0 top-0 z-40 p-5 flex flex-col overflow-y-auto no-scrollbar pb-28">
      {/* Header */}
      <div className="flex items-center gap-2 pb-4 border-b border-[#282828] mb-4">
        <Info size={18} className="text-primary" />
        <h2 className="text-sm font-bold text-white tracking-tight">
          About the Track
        </h2>
      </div>

      {isLoading ? (
        <div className="space-y-6 animate-pulse">
          {/* Song Skeleton */}
          <div className="space-y-2">
            <div className="h-4 w-3/4 bg-zinc-800 rounded" />
            <div className="h-3 w-1/2 bg-zinc-800 rounded" />
            <div className="h-16 w-full bg-zinc-900 rounded-md mt-2" />
          </div>

          <div className="h-px bg-[#282828]" />

          {/* Artist Skeleton */}
          <div className="space-y-3 flex flex-col items-center">
            <div className="w-20 h-20 rounded-full bg-zinc-800" />
            <div className="h-4 w-1/2 bg-zinc-800 rounded" />
            <div className="h-16 w-full bg-zinc-900 rounded-md" />
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* 1. Song Information */}
          <section className="space-y-2">
            <div className="flex items-center gap-2 text-primary text-xs font-semibold">
              <Music size={14} />
              <span>Song Overview</span>
            </div>
            <div>
              <h3 className="text-base font-bold text-white leading-tight">
                {currentSong.title}
              </h3>
              <p className="text-xs text-zinc-400 font-medium">
                {currentSong.artistName}
              </p>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed font-normal pt-1">
              {info?.song?.description ||
                "No additional background description found for this song."}
            </p>

            {info?.song?.source && (
              <a
                href={info.song.source}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-medium pt-1"
              >
                View on Wikipedia <ExternalLink size={12} />
              </a>
            )}
          </section>

          <div className="h-px bg-[#282828]" />

          {/* 2. Artist Information */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-primary text-xs font-semibold">
              <User size={14} />
              <span>About the Artist</span>
            </div>

            <div className="flex flex-col items-center text-center">
              <div className="relative w-20 h-20 rounded-full overflow-hidden bg-zinc-900 border border-[#282828] shadow-md mb-2">
                {info?.artist?.image ? (
                  <img
                    src={info.artist.image}
                    alt={info.artist.name}
                    className="w-full h-full object-cover"
                  />
                ) : artistCoverUrl ? (
                  <img
                    src={artistCoverUrl}
                    alt={info?.artist?.name || currentSong.artistName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-600 font-bold text-2xl">
                    {currentSong.artistName?.charAt(0) || "A"}
                  </div>
                )}
              </div>
              <h4 className="text-base font-bold text-white">
                {info?.artist?.name || currentSong.artistName}
              </h4>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed font-normal">
              {info?.artist?.description ||
                "No artist biography available at this time."}
            </p>

            {info?.artist?.source && (
              <a
                href={info.artist.source}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
              >
                View on Wikipedia <ExternalLink size={12} />
              </a>
            )}
          </section>
        </div>
      )}
    </aside>
  );
}
