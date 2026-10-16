"use client";

import Link from "next/link";
import { getImageUrl } from "@/lib/image-utils";
import { Artist } from "@/app/artists/types";

interface ArtistHeroBannerProps {
  artist: Artist;
}

export function ArtistHeroBanner({ artist }: ArtistHeroBannerProps) {
  return (
    <div className="relative h-85 w-full overflow-hidden">
      {artist.coverImageKey ? (
        <img
          src={getImageUrl(artist.coverImageKey, {
            width: 1200,
            height: 400,
            crop: "at_max",
            focus: "auto",
          })}
          alt={artist.name}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full bg-linear-to-br from-zinc-900 via-zinc-950 to-black" />
      )}
      <div className="absolute inset-0 bg-linear-to-t from-black via-black/60 to-transparent" />

      <div className="absolute bottom-0 left-0 w-full p-8 md:p-12">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-end gap-8">
          {/* Avatar */}
          <div className="w-36 h-36 rounded-4xl border-2 border-[#282828] bg-black/60 overflow-hidden shadow-2xl shrink-0">
            {artist.coverImageKey ? (
              <img
                src={getImageUrl(artist.coverImageKey, {
                  width: 300,
                  height: 300,
                  focus: "auto",
                  aspectRatio: "1-1",
                })}
                alt={artist.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-black/80 flex items-center justify-center text-5xl font-black text-zinc-400">
                {artist.name[0]}
              </div>
            )}
          </div>

          <div className="flex-1 pb-2">
            <div className="flex items-center gap-2 mb-2 text-zinc-400 font-bold uppercase tracking-widest text-xs">
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l6 4.5-6 4.5z" />
              </svg>
              Verified Artist
            </div>
            <h1 className="text-4xl md:text-6xl font-black text-white mb-3 tracking-tight">
              {artist.name}
            </h1>
            {artist.about && (
              <p className="max-w-2xl text-zinc-400 font-medium leading-relaxed text-sm line-clamp-2">
                {artist.about}
              </p>
            )}
          </div>

          <div className="pb-2">
            <Link
              href="/artists"
              className="bg-black/60 hover:bg-white hover:text-black border border-[#282828] text-zinc-300 px-5 py-2.5 rounded-full font-bold transition-all flex items-center gap-2 text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              All Artists
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
