"use client";

import React from "react";
import { motion } from "framer-motion";
import { Play, Pause, Clock, Music, Plus } from "lucide-react";
import Link from "next/link";
import { formatDuration } from "@/lib/player-utils";
import { SongThumbnail } from "@/components/SongThumbnail";
import type { Song } from "@/lib/api/types";

interface SharedPlaylistTrackListProps {
  songs: Song[];
  currentSong: Song | null;
  isPlaying: boolean;
  onPlaySong: (song: Song, index: number) => void;
  onSelectSongForPicker: (song: Song) => void;
}

export const SharedPlaylistTrackList: React.FC<SharedPlaylistTrackListProps> = ({
  songs,
  currentSong,
  isPlaying,
  onPlaySong,
  onSelectSongForPicker,
}) => {
  return (
    <section className="px-6 pb-10 pt-6 md:px-10">
      {/* Header */}
      <div className="grid grid-cols-12 items-center border-b border-white/10 px-4 pb-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
        <div className="col-span-1 text-center">#</div>
        <div className="col-span-6 md:col-span-4 lg:col-span-3">Title</div>
        <div className="col-span-3 hidden md:block lg:col-span-3">Artist</div>
        <div className="col-span-2 hidden md:block">Album</div>
        <div className="col-span-1 hidden xl:block">Genre</div>
        <div className="col-span-5 text-right md:col-span-2 lg:col-span-3 xl:col-span-2">
          <Clock size={16} className="ml-auto" />
        </div>
      </div>

      {/* Songs */}
      <div className="mt-2 flex flex-col">
        {songs.length > 0 ? (
          songs.map((song: any, index: number) => {
            const isActive = currentSong?.id === song.id;
            const isCurrentPlaying = isActive && isPlaying;

            return (
              <motion.div
                key={song.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2, delay: Math.min(index * 0.015, 0.3) }}
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
                      <span className="text-xs text-zinc-500 group-hover:hidden">{index + 1}</span>
                      <Play size={14} fill="white" className="hidden text-white group-hover:block" />
                    </>
                  )}
                </div>

                {/* Title */}
                <div className="col-span-6 flex min-w-0 items-center gap-3 md:col-span-4 lg:col-span-3">
                  <SongThumbnail
                    song={song}
                    sizeClass="h-11 w-11"
                    roundedClass="rounded-md"
                    enablePreviewHover={true}
                    onPlayClick={() => onPlaySong(song, index)}
                  />
                  <div className="min-w-0 flex-1">
                    <h4 className={`truncate text-sm font-medium transition-colors ${isActive ? "text-primary" : "text-white"}`}>
                      {song.title}
                    </h4>
                    <p className="mt-0.5 truncate text-xs text-zinc-400 md:hidden">
                      {[song.artistName, song.album, song.genre].filter(Boolean).join(" • ")}
                    </p>
                  </div>
                </div>

                {/* Artist */}
                <div className="col-span-3 hidden min-w-0 md:block lg:col-span-3">
                  <span className="block truncate text-sm text-zinc-400 transition-colors group-hover:text-white">
                    {song.artistName}
                  </span>
                </div>

                {/* Album */}
                <div className="col-span-2 hidden min-w-0 md:block">
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
                <div className="col-span-1 hidden min-w-0 xl:block">
                  <span className="block truncate text-xs text-zinc-400 transition-colors group-hover:text-zinc-300">
                    {song.genre || "—"}
                  </span>
                </div>

                {/* Actions / Duration */}
                <div className="col-span-5 flex items-center justify-end gap-3 text-xs tabular-nums text-zinc-400 md:col-span-2 lg:col-span-3 xl:col-span-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectSongForPicker(song);
                    }}
                    className="hidden rounded p-1 text-zinc-500 transition-colors hover:text-white group-hover:block"
                    title="Add to one of my playlists"
                  >
                    <Plus size={15} />
                  </button>
                  <span>{formatDuration(song.duration)}</span>
                </div>
              </motion.div>
            );
          })
        ) : (
          <div className="rounded-xl border border-dashed border-white/10 py-20 text-center">
            <Music size={40} className="mx-auto mb-4 text-zinc-700" />
            <p className="text-sm text-zinc-500">No tracks in this playlist yet.</p>
          </div>
        )}
      </div>
    </section>
  );
};
