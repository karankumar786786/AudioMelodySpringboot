"use client";

import Link from "next/link";
import { Trash2, Music, ExternalLink, Mic2 } from "lucide-react";
import { getImageUrl } from "@/lib/image-utils";
import type { Artist } from "../types";

interface ArtistsGridProps {
  artists: Artist[];
  loading: boolean;
  onDelete: (id: string) => void;
}

export function ArtistsGrid({ artists, loading, onDelete }: ArtistsGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="bg-[#121215] rounded-3xl border border-white/8 p-6 animate-pulse"
          >
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-zinc-800 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-32 bg-zinc-800 rounded-md" />
                <div className="h-3 w-44 bg-zinc-800/60 rounded-md" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (artists.length === 0) {
    return (
      <div className="bg-[#121215] rounded-3xl border border-white/8 p-16 text-center text-zinc-500 font-medium">
        <Mic2 className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
        <h3 className="text-white font-bold text-sm">No artists found</h3>
        <p className="text-xs text-zinc-500 mt-1">
          Add an artist to begin attributing songs and curating discographies.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {artists.map((artist) => (
        <div
          key={artist.id}
          className="bg-[#121215] hover:bg-[#16161b] rounded-3xl border border-white/8 hover:border-white/16 overflow-hidden shadow-sm hover:shadow-lg hover:shadow-black/50 transition-all duration-200 group p-5 flex flex-col justify-between"
        >
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-black border border-white/10 overflow-hidden shrink-0 group-hover:border-white/20 transition-all">
              {artist.coverImageKey ? (
                <img
                  src={getImageUrl(artist.coverImageKey, {
                    width: 160,
                    height: 160,
                    focus: "auto",
                    aspectRatio: "1-1",
                  })}
                  alt={artist.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-400 font-bold text-lg bg-gradient-to-br from-zinc-800 to-zinc-950">
                  {artist.name[0]?.toUpperCase() || "A"}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-bold text-white truncate group-hover:text-indigo-300 transition-colors">
                {artist.name}
              </h3>
              <p className="text-xs text-zinc-400 mt-1 line-clamp-2 leading-relaxed">
                {artist.about || "No biography recorded."}
              </p>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between border-t border-white/6 pt-3.5">
            <span className="text-[11px] text-zinc-500 font-mono">
              ID: {artist.id.slice(0, 8)}...
            </span>
            <div className="flex items-center gap-2">
              <Link
                href={`/artists/${artist.id}/songs`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/8 hover:bg-white text-zinc-200 hover:text-black border border-white/10 text-xs font-semibold transition-all cursor-pointer"
              >
                <span>Discography</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
              <button
                type="button"
                onClick={() => onDelete(artist.id)}
                className="p-1.5 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all cursor-pointer"
                title="Delete Artist"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
