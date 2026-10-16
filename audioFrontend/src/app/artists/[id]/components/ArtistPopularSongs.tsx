"use client";

import React from "react";
import { motion } from "framer-motion";
import { Play, Pause, Clock, Music, Loader2 } from "lucide-react";
import Link from "next/link";
import { formatDuration, formatStreamCount } from "@/lib/player-utils";
import { SongThumbnail } from "@/components/SongThumbnail";
import type { Song } from "@/lib/api/types";

interface ArtistPopularSongsProps {
  songs: Song[];
  totalCount?: number;
  currentSong: Song | null;
  isPlaying: boolean;
  isLoading?: boolean;
  onPlaySong: (song: Song, index: number) => void;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  onLoadMore?: () => void;
  observerRef?: React.RefObject<HTMLDivElement | null>;
}

export const ArtistPopularSongs: React.FC<ArtistPopularSongsProps> = ({
  songs,
  totalCount,
  currentSong,
  isPlaying,
  isLoading = false,
  onPlaySong,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  observerRef,
}) => {
  return (
    <section className="px-6 pb-10 pt-6 md:px-10">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pb-4">
        <h3 className="text-lg font-bold tracking-tight text-white">Popular Songs</h3>

        <span className="text-xs font-medium text-zinc-400">
          {isLoading && songs.length === 0 ? (
            <span className="inline-block h-3.5 w-16 rounded bg-zinc-800/80 animate-pulse" />
          ) : totalCount && totalCount > songs.length ? (
            `${songs.length} of ${totalCount} tracks`
          ) : (
            `${songs.length} ${songs.length === 1 ? "track" : "tracks"}`
          )}
        </span>
      </div>

      <div className="grid grid-cols-12 items-center border-b border-white/10 px-4 pb-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
        <div className="col-span-1 text-center">#</div>
        <div className="col-span-6 sm:col-span-6 md:col-span-5 lg:col-span-4">Title</div>
        <div className="col-span-3 hidden md:block">Album</div>
        <div className="col-span-1 hidden lg:block">Genre</div>
        <div className="col-span-3 sm:col-span-3 md:col-span-2 hidden sm:block text-right">Plays</div>
        <div className="col-span-5 sm:col-span-2 md:col-span-1 text-right">
          <Clock size={16} className="ml-auto" />
        </div>
      </div>

      {/* Songs */}
      <div className="mt-2 flex flex-col">
        {isLoading && songs.length === 0 ? (
          <div className="flex flex-col gap-1 animate-pulse select-none">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((index) => (
              <div
                key={index}
                className="grid grid-cols-12 items-center rounded-md px-4 py-2.5 bg-zinc-900/20 border border-white/2"
              >
                {/* Track Index */}
                <div className="col-span-1 text-center flex justify-center">
                  <div className="h-3 w-3 rounded bg-zinc-800" />
                </div>

                {/* Title + Thumbnail */}
                <div className="col-span-6 sm:col-span-6 md:col-span-5 lg:col-span-4 flex items-center gap-3 min-w-0 pr-3">
                  <div className="h-10 w-10 shrink-0 rounded-md bg-zinc-800" />
                  <div className="flex-1 space-y-1.5 min-w-0">
                    <div className="h-3.5 w-4/5 rounded bg-zinc-800" />
                    <div className="h-2.5 w-1/2 rounded bg-zinc-800/60" />
                  </div>
                </div>

                {/* Album */}
                <div className="col-span-3 hidden md:block pr-3">
                  <div className="h-3 w-3/5 rounded bg-zinc-800/60" />
                </div>

                {/* Genre */}
                <div className="col-span-1 hidden lg:block pr-3">
                  <div className="h-3 w-16 rounded bg-zinc-800/60" />
                </div>

                {/* Plays */}
                <div className="col-span-3 sm:col-span-3 md:col-span-2 hidden sm:block text-right pr-2">
                  <div className="h-3 w-16 rounded bg-zinc-800/60 ml-auto" />
                </div>

                {/* Duration */}
                <div className="col-span-5 sm:col-span-2 md:col-span-1 text-right">
                  <div className="h-3 w-10 rounded bg-zinc-800/60 ml-auto" />
                </div>
              </div>
            ))}
          </div>
        ) : songs.length > 0 ? (
          songs.map((song: any, index: number) => {
            const isActive = currentSong?.id === song.id;
            const isCurrentPlaying = isActive && isPlaying;

            return (
              <motion.div
                key={song.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{
                  duration: 0.2,
                  delay: Math.min(index * 0.015, 0.3),
                }}
                onClick={() => onPlaySong(song, index)}
                className={`group grid cursor-pointer grid-cols-12 items-center rounded-md px-4 py-2.5 transition-colors duration-150 ${
                  isActive ? "bg-white/10" : "hover:bg-white/[0.07]"
                }`}
              >
                {/* Index */}
                <div className="col-span-1 flex items-center justify-center">
                  {isActive ? (
                    isCurrentPlaying ? (
                      <Pause size={14} className="text-primary" fill="currentColor" />
                    ) : (
                      <Play size={14} className="text-primary" fill="currentColor" />
                    )
                  ) : (
                    <>
                      <span className="text-xs text-zinc-500 group-hover:hidden">
                        {index + 1}
                      </span>
                      <Play
                        size={14}
                        fill="white"
                        className="hidden text-white group-hover:block"
                      />
                    </>
                  )}
                </div>

                {/* Title */}
                <div className="col-span-6 flex min-w-0 items-center gap-3 sm:col-span-6 md:col-span-5 lg:col-span-4">
                  <SongThumbnail
                    song={song}
                    sizeClass="h-11 w-11"
                    roundedClass="rounded-md"
                    enablePreviewHover={true}
                    onPlayClick={() => onPlaySong(song, index)}
                  />

                  <div className="min-w-0 flex-1">
                    <h4
                      className={`truncate text-sm font-medium transition-colors ${
                        isActive ? "text-primary" : "text-white"
                      }`}
                    >
                      {song.title}
                    </h4>

                    <p className="mt-0.5 truncate text-xs text-zinc-400 md:hidden">
                      {[song.album, song.genre].filter(Boolean).join(" • ") || "Single"}
                    </p>
                  </div>
                </div>

                {/* Album */}
                <div className="col-span-3 hidden min-w-0 md:block">
                  {song.album ? (
                    <Link
                      href={`/albums/${encodeURIComponent(song.album)}`}
                      onClick={(e) => e.stopPropagation()}
                      className="block truncate text-sm text-zinc-400 hover:text-white hover:underline transition-colors"
                      title={`View Album: ${song.album}`}
                    >
                      {song.album}
                    </Link>
                  ) : (
                    <span className="block truncate text-sm text-zinc-500">—</span>
                  )}
                </div>

                {/* Genre */}
                <div className="col-span-1 hidden min-w-0 lg:block">
                  <span className="block truncate text-sm text-zinc-400 transition-colors group-hover:text-white">
                    {song.genre || "—"}
                  </span>
                </div>

                {/* Plays */}
                <div className="col-span-3 sm:col-span-3 md:col-span-2 hidden sm:flex items-center justify-end font-mono text-xs text-zinc-400">
                  <span className="text-zinc-300 font-medium">
                    {formatStreamCount(song.totalStreams)}
                  </span>
                </div>

                {/* Duration */}
                <div className="col-span-5 sm:col-span-2 md:col-span-1 flex items-center justify-end gap-2 text-xs tabular-nums text-zinc-400">
                  <span className="sm:hidden font-mono text-[11px] text-zinc-500">
                    {formatStreamCount(song.totalStreams)}
                  </span>
                  <span>{formatDuration(song.duration)}</span>
                </div>
              </motion.div>
            );
          })
        ) : (
          <div className="rounded-xl border border-dashed border-white/10 py-20 text-center">
            <Music size={40} className="mx-auto mb-4 text-zinc-700" />
            <p className="text-sm text-zinc-500">No songs available</p>
          </div>
        )}

        {/* Infinite Scroll Trigger Sentinel & Loading State */}
        {songs.length > 0 && (
          <div ref={observerRef} className="py-8 flex flex-col items-center justify-center">
            {isFetchingNextPage ? (
              <div className="flex items-center gap-2.5 text-xs font-semibold uppercase tracking-wider text-zinc-400 py-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span>Loading more tracks...</span>
              </div>
            ) : hasNextPage ? (
              <button
                type="button"
                onClick={onLoadMore}
                className="text-xs font-semibold uppercase tracking-wider text-zinc-400 hover:text-white transition-colors px-5 py-2.5 rounded-full border border-white/10 hover:border-white/20 hover:bg-white/5 active:scale-95 cursor-pointer select-none"
              >
                Load More Tracks
              </button>
            ) : songs.length > 15 ? (
              <span className="text-xs text-zinc-600 font-medium">
                All {songs.length} tracks loaded
              </span>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
};
