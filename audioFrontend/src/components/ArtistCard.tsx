"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Users2, Play, Pause, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import type { Artist, Song } from "../lib/api";
import { musicApi } from "../lib/api";
import { getImageUrl } from "../lib/image-utils";
import { formatFollowerCount, mapListToPlayerSongs } from "../lib/player-utils";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useAppSelector } from "@/store/hooks";
import { playerActions } from "@/store/player.store";

interface ArtistCardProps {
  artist: Artist;
  className?: string;
}

export function ArtistCard({ artist, className = "" }: ArtistCardProps) {
  const queryClient = useQueryClient();
  const currentSong = useAppSelector((s) => s.player.currentSong);
  const isPlaying = useAppSelector((s) => s.player.isPlaying);

  const [isLoadingQuickPlay, setIsLoadingQuickPlay] = useState(false);

  const isCurrentArtist = Boolean(
    currentSong?.artistName &&
      currentSong.artistName.trim().toLowerCase() === artist.name.trim().toLowerCase()
  );
  const isPlayingCurrentArtist = isCurrentArtist && isPlaying;

  const imageUrl =
    getImageUrl(artist.coverImageKey, {
      width: 300,
      height: 300,
      focus: "auto",
      aspectRatio: "1-1",
    }) || "/placeholder-artist.png";

  const initials =
    artist.name
      .split(" ")
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "AR";

  // Pre-seed React Query cache on hover so opening the artist profile is instant (0ms)
  const handlePrefetch = () => {
    // 1. Seed artist details
    queryClient.setQueryData(["artist", artist.id], { data: artist });

    // 2. Prefetch first page of songs from Algolia
    queryClient.prefetchInfiniteQuery({
      queryKey: ["artist-songs", artist.id, artist.name],
      queryFn: () => musicApi.artists.getSongs(artist.id, 1, 15, artist.name),
      initialPageParam: 1,
      staleTime: 1000 * 60 * 5,
    });
  };

  const handleQuickPlay = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isCurrentArtist) {
      playerActions.setIsPlaying(!isPlaying);
      return;
    }

    try {
      setIsLoadingQuickPlay(true);

      // Check if songs are already cached
      const cached = queryClient.getQueryData<any>([
        "artist-songs",
        artist.id,
        artist.name,
      ]);

      let songs: Song[] = [];
      if (cached?.pages?.[0]?.data?.data?.length > 0) {
        songs = cached.pages[0].data.data;
      } else {
        const res = await musicApi.artists.getSongs(artist.id, 1, 15, artist.name);
        songs = res?.data?.data || [];
        if (songs.length > 0) {
          queryClient.setQueryData(["artist-songs", artist.id, artist.name], {
            pages: [res],
            pageParams: [1],
          });
        }
      }

      if (songs.length > 0) {
        playerActions.playAll(mapListToPlayerSongs(songs));
      }
    } catch (err) {
      console.warn("[ArtistCard] Quick play failed:", err);
    } finally {
      setIsLoadingQuickPlay(false);
    }
  };

  const baseWidthClass = className || "flex-none w-28.75 sm:w-31";

  return (
    <Link
      href={`/artists/${artist.id}`}
      onMouseEnter={handlePrefetch}
      onTouchStart={handlePrefetch}
      className={`group cursor-pointer text-center block ${baseWidthClass}`}
    >
      <motion.div
        whileHover={{ scale: 1.03 }}
        transition={{ duration: 0.2 }}
        className="bg-black/90 hover:bg-zinc-900/80 p-2 rounded-xl border border-white/5 hover:border-white/20 transition-all duration-300 space-y-2 relative"
      >
        <div className="relative mx-auto w-24 h-24 sm:w-26 sm:h-26">
          <Avatar className="w-full h-full shadow-lg transition-colors ring-1 ring-white/10 group-hover:ring-white/25">
            <AvatarImage
              src={imageUrl}
              alt={artist.name}
              loading="lazy"
              decoding="async"
              className="group-hover:scale-105 transition-transform duration-300 ease-out object-cover"
            />
            <AvatarFallback className="text-sm font-bold bg-zinc-800 text-zinc-300">
              {initials}
            </AvatarFallback>
          </Avatar>

          {/* Quick Play Floating Action Button */}
          <button
            type="button"
            onClick={handleQuickPlay}
            aria-label={
              isPlayingCurrentArtist
                ? `Pause ${artist.name}`
                : `Play ${artist.name}`
            }
            className={`absolute bottom-0 right-0 w-8 h-8 rounded-full flex items-center justify-center shadow-xl transition-all duration-200 z-10 active:scale-95 cursor-pointer ${
              isPlayingCurrentArtist || isLoadingQuickPlay
                ? "bg-white text-black opacity-100 translate-y-0 scale-100"
                : "bg-white text-black opacity-0 translate-y-1.5 scale-90 group-hover:opacity-100 group-hover:translate-y-0 group-hover:scale-100 hover:scale-105 hover:bg-white/95"
            }`}
          >
            {isLoadingQuickPlay ? (
              <Loader2 size={14} className="animate-spin text-black" />
            ) : isPlayingCurrentArtist ? (
              <Pause size={14} fill="currentColor" />
            ) : (
              <Play size={14} fill="currentColor" className="ml-0.5" />
            )}
          </button>
        </div>

        <div className="px-0.5 space-y-0.5">
          <h3
            className="font-semibold text-zinc-100 group-hover:text-white line-clamp-1 leading-tight text-[12px] sm:text-[12.5px] text-center transition-colors"
            title={artist.name}
          >
            {artist.name}
          </h3>
          <p
            className="text-[10.5px] sm:text-[11px] text-zinc-400 group-hover:text-zinc-300 transition-colors text-center line-clamp-1 font-medium flex items-center justify-center gap-1"
            title={`${(artist.followersCount ?? 0).toLocaleString()} followers`}
          >
            <Users2 size={11} className="shrink-0 text-zinc-500 group-hover:text-zinc-400" />
            <span>{formatFollowerCount(artist.followersCount, true)}</span>
          </p>
        </div>
      </motion.div>
    </Link>
  );
}
