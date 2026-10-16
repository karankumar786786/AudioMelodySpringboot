"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Pause, Play, Trash2 } from "lucide-react";
import { formatDuration } from "@/lib/player-utils";
import { SongThumbnail } from "@/components/SongThumbnail";

interface PlaylistTrackRowProps {
  song: any;
  index: number;
  isActive: boolean;
  isCurrentPlaying: boolean;
  isOwner: boolean;
  isFavourites: boolean;
  onPlay: () => void;
  onRemove: () => void;
}

export function PlaylistTrackRow({
  song,
  index,
  isActive,
  isCurrentPlaying,
  isOwner,
  isFavourites: _isFavourites,
  onPlay,
  onRemove,
}: PlaylistTrackRowProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, delay: Math.min(index * 0.015, 0.3) }}
      onClick={onPlay}
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
          onPlayClick={onPlay}
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

      {/* Duration / Actions */}
      <div className="col-span-5 flex items-center justify-end gap-3 text-xs tabular-nums text-zinc-400 md:col-span-2 lg:col-span-3 xl:col-span-2">
        {isOwner && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="hidden rounded p-1 text-zinc-500 transition-colors hover:text-red-400 group-hover:block cursor-pointer"
            title="Remove track"
          >
            <Trash2 size={14} />
          </button>
        )}
        {typeof song.totalStreams === "number" && (
          <span className="hidden sm:inline-block font-mono text-[11px] text-zinc-500">
            {song.totalStreams.toLocaleString()} plays
          </span>
        )}
        <span>{formatDuration(song.duration)}</span>
      </div>
    </motion.div>
  );
}
