"use client";

import React from "react";
import { motion } from "framer-motion";
import { Users, Play, Check, UserPlus, Loader2, Headphones } from "lucide-react";
import { formatDuration, formatStreamCount } from "@/lib/player-utils";
import type { Artist, Song } from "@/lib/api/types";

interface ArtistHeroProps {
  artist: Artist;
  coverUrl?: string;
  backgroundColor: string;
  followersCount: number;
  songs: Song[];
  isFollowing: boolean;
  isFollowLoading: boolean;
  isSongsLoading?: boolean;
  onPlayAll: () => void;
  onFollowToggle: () => void;
}

export const ArtistHero: React.FC<ArtistHeroProps> = ({
  artist,
  coverUrl,
  backgroundColor,
  followersCount,
  songs,
  isFollowing,
  isFollowLoading,
  isSongsLoading = false,
  onPlayAll,
  onFollowToggle,
}) => {
  return (
    <section
      className="relative overflow-hidden px-8 pb-8 pt-24 md:px-10 md:pt-28 rounded-2xl"
      style={{
        background: `
          linear-gradient(
            to bottom,
            ${backgroundColor} 0%,
            ${backgroundColor} 35%,
            rgba(0,0,0,0.92) 100%
          )
        `,
      }}
    >
      {/* Subtle dark overlay */}
      <div className="pointer-events-none absolute inset-0 bg-black/10" />

      {/* Artist information */}
      <div className="relative z-10 flex flex-col items-center gap-7 md:flex-row md:items-end">
        {/* Cover — circular, since this is a person, not a playlist */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="h-52 w-52 shrink-0 overflow-hidden rounded-full bg-zinc-900 shadow-2xl ring-2 ring-white/15 md:h-56 md:w-56"
        >
          {coverUrl ? (
            <img
              src={coverUrl}
              alt={artist?.name || "Artist"}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Users size={64} className="text-zinc-600" />
            </div>
          )}
        </motion.div>

        {/* Details */}
        <motion.div
          initial={{ opacity: 0, x: 15 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35, delay: 0.05 }}
          className="min-w-0 flex-1 pb-1"
        >
          <div className="mb-2 flex items-center gap-1.5">
            <div className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-[9px] font-black text-white">
              ✓
            </div>
            <p className="text-xs font-semibold uppercase tracking-wider text-white/80">
              Verified Artist
            </p>
          </div>

          <h1 className="wrap-break-word text-4xl font-black tracking-tight text-white md:text-6xl">
            {artist?.name}
          </h1>

          {artist?.about && (
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/70">
              {artist.about}
            </p>
          )}

          <div className="mt-4 flex items-center gap-3 text-xs text-white/80 flex-wrap">
            <span className="font-semibold">
              {followersCount.toLocaleString()}{" "}
              {followersCount === 1 ? "follower" : "followers"}
            </span>

            <span>•</span>

            {isSongsLoading && songs.length === 0 ? (
              <span className="inline-block h-3.5 w-16 rounded bg-white/20 animate-pulse" />
            ) : (
              <span className="font-semibold">
                {songs.length} {songs.length === 1 ? "song" : "songs"}
              </span>
            )}

            {songs.length > 0 && (
              <>
                <span>•</span>
                <span
                  className="font-semibold text-white flex items-center gap-1.5 drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]"
                  title="Total artist streams across all tracks"
                >
                  <Headphones size={13} className="text-white shrink-0 drop-shadow-[0_0_6px_rgba(255,255,255,0.6)]" />
                  {formatStreamCount(
                    songs.reduce(
                      (total: number, song: any) =>
                        total + (Number(song.totalStreams) || 0),
                      0
                    )
                  )}
                </span>
                <span>•</span>
                <span>
                  {formatDuration(
                    songs.reduce(
                      (total: number, song: any) =>
                        total + (Number(song.duration) || 0),
                      0
                    )
                  )}
                </span>
              </>
            )}
          </div>

          {/* Action buttons row with stable dimensions and zero layout shift */}
          <div className="mt-6 flex items-center gap-3 flex-wrap">
            {isSongsLoading && songs.length === 0 ? (
              <div className="h-10 w-28 rounded-full bg-white/20 animate-pulse" />
            ) : songs.length > 0 ? (
              <button
                type="button"
                onClick={onPlayAll}
                disabled={songs.length === 0}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-2.5 text-sm font-bold text-black transition-all hover:bg-white/90 hover:scale-[1.02] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer shadow-xl select-none"
              >
                <Play size={16} fill="black" />
                <span>Play All</span>
              </button>
            ) : null}

            <button
              type="button"
              onClick={onFollowToggle}
              disabled={isFollowLoading}
              className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-all cursor-pointer shadow-xl active:scale-95 disabled:cursor-wait min-w-32.5 h-10 select-none ${
                isFollowing
                  ? "bg-zinc-800/90 hover:bg-zinc-700 text-white border border-white/20 hover:border-red-500/40 hover:text-red-300"
                  : "bg-primary hover:bg-primary/90 text-black font-bold"
              }`}
            >
              {isFollowLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin text-current shrink-0" />
                  <span className="truncate">{isFollowing ? "Unfollowing..." : "Following..."}</span>
                </>
              ) : isFollowing ? (
                <>
                  <Check size={16} className="stroke-3 shrink-0 text-emerald-400" />
                  <span>Following</span>
                </>
              ) : (
                <>
                  <UserPlus size={16} className="stroke-[2.5] shrink-0" />
                  <span>Follow</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
