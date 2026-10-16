"use client";

import Link from "next/link";
import { getImageUrl } from "@/lib/image-utils";
import { Artist } from "../types";

interface ArtistsGridProps {
  artists: Artist[];
  loading: boolean;
  onDelete: (id: string) => void;
}

export function ArtistsGrid({ artists, loading, onDelete }: ArtistsGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="bg-[#121212] rounded-3xl border border-[#282828] p-6 animate-pulse"
          >
            <div className="flex items-center gap-5">
              <div className="w-20 h-20 rounded-2xl bg-zinc-800 shrink-0" />
              <div className="flex-1 space-y-2.5">
                <div className="h-5 w-32 bg-zinc-800 rounded-md" />
                <div className="h-3 w-48 bg-zinc-800/60 rounded-md" />
                <div className="h-3 w-24 bg-zinc-800/40 rounded-md" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (artists.length === 0) {
    return (
      <div className="p-20 text-center text-zinc-500 font-medium">
        No artists found.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {artists.map((artist) => (
        <div
          key={artist.id}
          className="bg-[#121212] rounded-3xl border border-[#282828] overflow-hidden shadow-sm hover:border-zinc-600 transition-all group p-6"
        >
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-2xl bg-black/60 border border-[#282828] overflow-hidden shrink-0">
              {artist.coverImageKey ? (
                <img
                  src={getImageUrl(artist.coverImageKey, {
                    width: 150,
                    height: 150,
                    focus: "auto",
                    aspectRatio: "1-1",
                  })}
                  alt={artist.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-500 font-bold text-xl">
                  {artist.name[0]}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-xl font-bold text-white truncate group-hover:text-zinc-200 transition-colors">
                {artist.name}
              </h3>
              <p className="text-xs text-zinc-400 mt-1 line-clamp-2">
                {artist.about || "No biography available."}
              </p>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between border-t border-[#282828] pt-4">
            <span className="text-xs text-zinc-500 font-mono">
              ID: {artist.id.slice(0, 8)}...
            </span>
            <div className="flex gap-2">
              <Link
                href={`/artists/${artist.id}/songs`}
                className="px-4 py-1.5 rounded-full bg-black/60 border border-[#282828] text-xs font-bold text-zinc-300 hover:bg-white hover:text-black transition-all"
              >
                View Songs
              </Link>
              <button
                onClick={() => onDelete(artist.id)}
                className="p-2 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all"
                title="Delete Artist"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
