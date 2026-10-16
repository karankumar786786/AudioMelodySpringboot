"use client";

import React from "react";
import { ExternalLink } from "lucide-react";

interface RightInfoArtistSectionProps {
  info: any;
  isInfoLoading: boolean;
  artistCoverUrl?: string | null;
  artistName: string;
}

export function RightInfoArtistSection({
  info,
  isInfoLoading,
  artistCoverUrl,
  artistName,
}: RightInfoArtistSectionProps) {
  return (
    <section className="bg-[#121212] border border-[#222] rounded-2xl overflow-hidden p-4 shadow-xl">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-bold text-white">
          About the artist
        </h3>
      </div>

      {/* Artist image */}
      <div className="relative w-full h-40 rounded-xl overflow-hidden bg-zinc-900 border border-[#282828] shadow-md">
        {info?.artist?.image ? (
          <img
            src={info.artist.image}
            alt={info.artist.name}
            className="w-full h-full object-cover object-top"
          />
        ) : artistCoverUrl ? (
          <img
            src={artistCoverUrl}
            alt={info?.artist?.name || artistName}
            className="w-full h-full object-cover object-top"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-linear-to-br from-zinc-800 to-black text-zinc-500 font-bold text-4xl">
            {artistName?.charAt(0) || "A"}
          </div>
        )}

        <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/40 to-transparent flex items-end justify-between p-3">
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-bold text-white truncate">
              {info?.artist?.name || artistName}
            </h4>
            <p className="text-[11px] font-medium text-zinc-300 drop-shadow">
              Artist
            </p>
          </div>
        </div>
      </div>

      {/* Artist description */}
      {isInfoLoading ? (
        <div className="space-y-2 mt-3 animate-pulse">
          <div className="h-3 bg-zinc-800 rounded w-full" />
          <div className="h-3 bg-zinc-800 rounded w-5/6" />
          <div className="h-3 bg-zinc-800 rounded w-2/3" />
        </div>
      ) : (
        <p className="text-xs text-zinc-300 leading-relaxed mt-3 line-clamp-4">
          {info?.artist?.description ||
            "No artist biography available at this time."}
        </p>
      )}

      {info?.artist?.source && (
        <a
          href={info.artist.source}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline font-medium mt-2.5"
        >
          View on Wikipedia
          <ExternalLink size={11} />
        </a>
      )}
    </section>
  );
}
