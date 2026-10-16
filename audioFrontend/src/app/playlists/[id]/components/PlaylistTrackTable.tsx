"use client";

import React from "react";
import { motion } from "framer-motion";
import { Play, Pause, Trash2, Clock, Music } from "lucide-react";
import Link from "next/link";
import { formatDuration, formatStreamCount } from "@/lib/player-utils";
import { SongThumbnail } from "@/components/SongThumbnail";
import type { Song } from "@/lib/api/types";

interface PlaylistTrackTableProps {
  songs: Song[];
  currentSong: Song | null;
  isPlaying: boolean;
  isUserPlaylist: boolean;
  isLoading?: boolean;
  onPlaySong: (song: Song, index: number) => void;
  onRemoveSong?: (songId: string, songTitle: string) => void;
}

export const PlaylistTrackTable: React.FC<PlaylistTrackTableProps> = ({
  songs,
  currentSong,
  isPlaying,
  isUserPlaylist,
  isLoading = false,
  onPlaySong,
  onRemoveSong,
}) => {
  return (
    <section className="px-6 pb-10 pt-4 md:px-10">
      {/* Header */}
      <div className="grid grid-cols-12 items-center border-b border-white/10 px-4 pb-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
        <div className="col-span-1 text-center">#</div>
        <div className="col-span-7 sm:col-span-5 md:col-span-4 lg:col-span-3">Title</div>
        <div className="col-span-2 hidden md:block">Artist</div>
        <div className="col-span-2 hidden lg:block">Album</div>
        <div className="col-span-1 hidden xl:block">Genre</div>
        <div className="col-span-3 sm:col-span-3 md:col-span-3 lg:col-span-2 xl:col-span-2 hidden sm:block text-right">Plays</div>
        <div className="col-span-4 sm:col-span-3 md:col-span-2 lg:col-span-2 xl:col-span-1 text-right">
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
                <div className="col-span-7 sm:col-span-5 md:col-span-4 lg:col-span-3 flex items-center gap-3 min-w-0 pr-3">
                  <div className="h-10 w-10 shrink-0 rounded-md bg-zinc-800" />
                  <div className="flex-1 space-y-1.5 min-w-0">
                    <div className="h-3.5 w-4/5 rounded bg-zinc-800" />
                    <div className="h-2.5 w-1/2 rounded bg-zinc-800/60" />
                  </div>
                </div>

                {/* Artist */}
                <div className="col-span-2 hidden md:block pr-3">
                  <div className="h-3 w-24 rounded bg-zinc-800/60" />
                </div>

                {/* Album */}
                <div className="col-span-2 hidden lg:block pr-3">
                  <div className="h-3 w-28 rounded bg-zinc-800/60" />
                </div>

                {/* Genre */}
                <div className="col-span-1 hidden xl:block pr-3">
                  <div className="h-3 w-16 rounded bg-zinc-800/60" />
                </div>

                {/* Plays */}
                <div className="col-span-3 sm:col-span-3 md:col-span-3 lg:col-span-2 xl:col-span-2 hidden sm:block text-right pr-2">
                  <div className="h-3 w-16 rounded bg-zinc-800/60 ml-auto" />
                </div>

                {/* Duration */}
                <div className="col-span-4 sm:col-span-3 md:col-span-2 lg:col-span-2 xl:col-span-1 text-right">
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
                {/* INDEX */}
                <div className="col-span-1 flex items-center justify-center">
                  {isActive ? (
                    isCurrentPlaying ? (
                      <Pause
                        size={14}
                        className="text-primary"
                        fill="currentColor"
                      />
                    ) : (
                      <Play
                        size={14}
                        className="text-primary"
                        fill="currentColor"
                      />
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

                {/* TITLE */}
                <div className="col-span-7 flex min-w-0 items-center gap-3 sm:col-span-5 md:col-span-4 lg:col-span-3">
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
                    <p className="mt-0.5 truncate text-xs text-zinc-400 sm:hidden">
                      {[song.artistName, formatStreamCount(song.totalStreams)].filter(Boolean).join(" • ")}
                    </p>
                  </div>
                </div>

                {/* ARTIST */}
                <div className="col-span-2 hidden min-w-0 md:block">
                  <span className="block truncate text-sm text-zinc-400 transition-colors group-hover:text-white">
                    {song.artistName}
                  </span>
                </div>

                {/* ALBUM */}
                <div className="col-span-2 hidden min-w-0 lg:block">
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

                {/* GENRE */}
                <div className="col-span-1 hidden min-w-0 xl:block">
                  <span className="block truncate text-xs text-zinc-400 transition-colors group-hover:text-zinc-300">
                    {song.genre || "—"}
                  </span>
                </div>

                {/* PLAYS */}
                <div className="col-span-3 sm:col-span-3 md:col-span-3 lg:col-span-2 xl:col-span-2 hidden sm:flex items-center justify-end font-mono text-xs text-zinc-400">
                  <span className="text-zinc-300 font-medium">
                    {formatStreamCount(song.totalStreams)}
                  </span>
                </div>

                {/* DURATION / ACTIONS */}
                <div className="col-span-4 sm:col-span-3 md:col-span-2 lg:col-span-2 xl:col-span-1 flex items-center justify-end gap-3 text-xs tabular-nums text-zinc-400">
                  {isUserPlaylist && onRemoveSong && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveSong(song.id, song.title);
                      }}
                      className="hidden rounded p-1 text-zinc-500 transition-colors hover:text-red-400 group-hover:block"
                      title="Remove from playlist"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                  <span>{formatDuration(song.duration)}</span>
                </div>
              </motion.div>
            );
          })
        ) : (
          <div className="rounded-xl border border-dashed border-white/10 py-20 text-center">
            <Music size={40} className="mx-auto mb-4 text-zinc-700" />
            <p className="text-sm text-zinc-500">
              No songs in this playlist yet
            </p>
          </div>
        )}
      </div>
    </section>
  );
};
