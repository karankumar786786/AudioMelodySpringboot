"use client";

import React from "react";
import Link from "next/link";
import type { Song } from "@/lib/api";

interface SongCardInfoProps {
  song: Song;
  isActiveSong: boolean;
}

export function SongCardInfo({ song, isActiveSong }: SongCardInfoProps) {
  return (
    <div className="space-y-0.5 px-0.5">
      <h3
        className={`font-bold truncate text-[12.5px] sm:text-[13px] tracking-tight transition-colors ${
          isActiveSong ? "text-primary" : "text-white"
        }`}
      >
        {song.title}
      </h3>
      <p
        className="text-[11px] sm:text-[11.5px] font-medium text-zinc-400 truncate hover:text-white"
        title={[song.artistName, song.album, song.genre].filter(Boolean).join(" • ")}
      >
        {song.artistName}
        {song.album && (
          <Link
            href={`/albums/${encodeURIComponent(song.album)}`}
            onClick={(e) => e.stopPropagation()}
            className="text-zinc-400 font-normal hover:text-white hover:underline transition-colors"
            title={`View Album: ${song.album}`}
          >
            {" "}• {song.album}
          </Link>
        )}
        {song.genre && <span className="text-zinc-500 font-normal"> • {song.genre}</span>}
      </p>
    </div>
  );
}
