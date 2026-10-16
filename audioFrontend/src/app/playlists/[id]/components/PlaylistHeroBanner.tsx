"use client";

import React from "react";
import { motion } from "framer-motion";
import { Play, Headphones } from "lucide-react";
import { formatDuration, formatStreamCount } from "@/lib/player-utils";
import type { Playlist, Song } from "@/lib/api/types";

interface PlaylistHeroBannerProps {
  playlist: any;
  songs: Song[];
  videoUrl?: string;
  coverUrl?: string;
  isUserPlaylist: boolean;
  username?: string;
  isSongsLoading?: boolean;
  onStreamAll: () => void;
}

export const PlaylistHeroBanner: React.FC<PlaylistHeroBannerProps> = ({
  playlist,
  songs,
  videoUrl,
  coverUrl,
  isUserPlaylist,
  username,
  isSongsLoading = false,
  onStreamAll,
}) => {
  return (
    <section className="relative h-[45vh] min-h-40 max-h-115 w-full overflow-hidden rounded-2xl">
      {/* Background video / image */}
      {videoUrl ? (
        <video
          src={videoUrl}
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : coverUrl ? (
        <img
          src={coverUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-zinc-900" />
      )}

      {/* Gradient only where it's needed: behind the text */}
      {(videoUrl || coverUrl) && (
        <>
          <div className="absolute inset-x-0 bottom-0 h-3/4 bg-linear-to-t from-black via-black/70 to-transparent" />
          <div className="absolute inset-0 bg-black/10" />
        </>
      )}

      {/* Content pinned to bottom like a title card */}
      <div className="relative z-10 flex h-full flex-col justify-end px-8 pb-6 md:px-12 md:pb-8">
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/80"
        >
          {isUserPlaylist ? "Playlist" : "Public Playlist"}
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.05 }}
          className="max-w-3xl wrap-break-word text-3xl font-black tracking-tight text-white drop-shadow-lg md:text-5xl"
        >
          {playlist?.title || playlist?.name}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1 }}
          className="mt-2 max-w-xl text-sm leading-relaxed text-white/80"
        >
          {playlist?.description || "A curated playlist of songs."}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.15 }}
          className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/80"
        >
          <span className="font-semibold">
            {username || "OneMelody"}
          </span>

          {isSongsLoading && songs.length === 0 ? (
            <>
              <span>•</span>
              <span className="inline-block h-3.5 w-16 rounded bg-white/20 animate-pulse" />
              <div className="ml-3 h-9 w-24 rounded-full bg-white/20 animate-pulse" />
            </>
          ) : playlist && (playlist.totalSongs > 0 || songs.length > 0) ? (
            <>
              <span>•</span>
              <span>
                {playlist.totalSongs || songs.length}{" "}
                {(playlist.totalSongs || songs.length) === 1 ? "song" : "songs"}
              </span>
              <span>•</span>
              <span
                className="font-semibold text-white flex items-center gap-1.5 drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]"
                title="Total streams across playlist"
              >
                <Headphones size={13} className="text-white shrink-0 drop-shadow-[0_0_6px_rgba(255,255,255,0.6)]" />
                {formatStreamCount(
                  songs.reduce(
                    (total: number, song: any) =>
                      total + (Number(song.totalStreams) || 0),
                    0
                  )
                )}
              </span>
              <span>•</span>
              <span>
                {formatDuration(
                  songs.reduce(
                    (total: number, song: any) =>
                      total + (Number(song.duration) || 0),
                    0
                  )
                )}
              </span>

              <button
                onClick={onStreamAll}
                className="ml-3 flex items-center gap-1.5 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-white/80 cursor-pointer shadow-lg active:scale-95"
              >
                <Play size={16} fill="black" />
                Play All
              </button>
            </>
          ) : null}
        </motion.div>
      </div>
    </section>
  );
};
