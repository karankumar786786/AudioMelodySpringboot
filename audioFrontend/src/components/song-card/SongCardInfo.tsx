"use client";

import React from "react";
import Link from "next/link";
import { Disc, Play } from "lucide-react";
import type { Song } from "@/lib/api";
import { formatStreamCount } from "@/lib/player-utils";

interface SongCardInfoProps {
  song: Song;
  isActiveSong: boolean;
}

export function SongCardInfo({ song, isActiveSong }: SongCardInfoProps) {
  return (
    <div className="space-y-0.5 px-0.5 pt-0.5">
      {/* Title */}
      <h3
        className={`font-bold truncate text-[12.5px] sm:text-[13px] tracking-tight transition-colors ${
          isActiveSong ? "text-primary" : "text-white"
        }`}
        title={song.title}
      >
        {song.title}
      </h3>

      {/* Artist */}
      <p
        className="text-[11px] sm:text-[11.5px] font-medium text-zinc-400 truncate hover:text-zinc-200 transition-colors"
        title={song.artistName}
      >
        {song.artistName}
      </p>

      {/* Album row - dedicated line with disc icon so album is always visible */}
      <div className="text-[10px] sm:text-[10.5px] truncate leading-tight h-4 flex items-center">
        {song.album ? (
          <Link
            href={`/albums/${encodeURIComponent(song.album)}`}
            onClick={(e) => e.stopPropagation()}
            className="text-zinc-400 font-normal hover:text-white hover:underline transition-colors flex items-center gap-1 truncate"
            title={`Album: ${song.album}`}
          >
            <Disc size={10.5} className="shrink-0 text-zinc-500" />
            <span className="truncate">{song.album}</span>
          </Link>
        ) : (
          <span className="text-zinc-600 truncate" title="Single Release">
            Single
          </span>
        )}
      </div>

      {/* Plays count & Genre row */}
      <div className="flex items-center justify-between gap-1 text-[10px] sm:text-[10.5px] font-mono pt-0.5 min-w-0">
        <span
          className="inline-flex items-center gap-1 text-zinc-300 shrink-0"
          title={`${(song.totalStreams || 0).toLocaleString()} total streams`}
        >
          <Play size={8.5} className="fill-white text-white shrink-0 drop-shadow-[0_0_6px_rgba(255,255,255,0.7)]" />
          <span className="text-white font-semibold drop-shadow-[0_0_8px_rgba(255,255,255,0.45)]">
            {formatStreamCount(song.totalStreams)}
          </span>
        </span>

        
      </div>
    </div>
  );
}

