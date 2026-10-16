"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  ListMusic,
  Play,
  Music,
  Share2,
  Globe,
  Link2,
  BookmarkPlus,
  BookmarkCheck,
} from "lucide-react";
import Link from "next/link";
import { formatDuration } from "@/lib/player-utils";
import type { UserPlaylist, Song } from "@/lib/api/types";

interface SharedPlaylistHeroProps {
  playlist: UserPlaylist;
  songs: Song[];
  backgroundColor: string;
  coverUrl?: string;
  hasCustomCover: boolean;
  showMosaic: boolean;
  mosaicImages: (string | null | undefined)[];
  showSingleSongImage: boolean;
  singleSongImage?: string | null;
  privacy: string;
  isOwner: boolean;
  isSaved: boolean;
  isSavingPending: boolean;
  onStreamAll: () => void;
  onToggleSave: () => void;
  onOpenShare: () => void;
}

export const SharedPlaylistHero: React.FC<SharedPlaylistHeroProps> = ({
  playlist,
  songs,
  backgroundColor,
  coverUrl,
  hasCustomCover,
  showMosaic,
  mosaicImages,
  showSingleSongImage,
  singleSongImage,
  privacy,
  isOwner,
  isSaved,
  isSavingPending,
  onStreamAll,
  onToggleSave,
  onOpenShare,
}) => {
  return (
    <section
      className="relative overflow-hidden px-8 pb-8 pt-24 md:px-10 md:pt-28"
      style={{
        background: `linear-gradient(to bottom, ${backgroundColor} 0%, ${backgroundColor} 35%, rgba(0,0,0,0.94) 100%)`,
      }}
    >
      <div className="relative z-10 flex flex-col items-center gap-7 md:flex-row md:items-end">
        {/* Cover */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="h-52 w-52 shrink-0 overflow-hidden rounded-md bg-zinc-900 shadow-2xl md:h-56 md:w-56"
        >
          {hasCustomCover ? (
            <img
              src={coverUrl}
              alt={playlist.name}
              className="h-full w-full object-cover"
            />
          ) : showMosaic ? (
            <div className="grid h-full w-full grid-cols-2 grid-rows-2">
              {mosaicImages.map((img, i) =>
                img ? (
                  <img
                    key={i}
                    src={img}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div
                    key={i}
                    className="flex h-full w-full items-center justify-center bg-zinc-800"
                  >
                    <Music size={20} className="text-zinc-600" />
                  </div>
                )
              )}
            </div>
          ) : showSingleSongImage && singleSongImage ? (
            <img
              src={singleSongImage}
              alt={playlist.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <ListMusic size={64} className="text-zinc-600" />
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
          <div className="mb-2 flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-white/80">
              Shared Playlist
            </span>
            <span>•</span>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide border ${
                privacy === "PUBLIC"
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                  : "bg-blue-500/20 text-blue-300 border-blue-500/40"
              }`}
            >
              {privacy === "PUBLIC" ? (
                <>
                  <Globe size={11} /> Public
                </>
              ) : (
                <>
                  <Link2 size={11} /> Shared by Link
                </>
              )}
            </span>
          </div>

          <h1 className="wrap-break-word text-4xl font-black tracking-tight text-white md:text-6xl">
            {playlist.name}
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/75">
            {playlist.description || "A playlist curated and shared on AudioMelody."}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-white/80">
            <span className="font-semibold text-white">
              Curated by {playlist.ownerName || "AudioMelody User"}
            </span>
            <span>•</span>
            <span>
              {playlist.totalSongs}{" "}
              {playlist.totalSongs === 1 ? "song" : "songs"}
            </span>

            {songs.length > 0 && (
              <>
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

                <button
                  type="button"
                  onClick={onStreamAll}
                  className="ml-2 flex items-center gap-1.5 rounded-full bg-white px-5 py-2 text-sm font-semibold text-black transition-all hover:bg-white/80 hover:scale-105 cursor-pointer shadow-lg"
                >
                  <Play size={15} fill="black" />
                  Play All
                </button>
              </>
            )}

            {/* Save / Unsave to Library (Dynamic Reference) */}
            {!isOwner && (
              <button
                type="button"
                onClick={onToggleSave}
                disabled={isSavingPending}
                className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                  isSaved
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-red-500/20 hover:text-red-300 hover:border-red-500/40"
                    : "bg-white/10 hover:bg-white/20 border border-white/20 text-white"
                }`}
                title={isSaved ? "Click to remove from your library" : "Save to library (Live updates by creator)"}
              >
                {isSaved ? (
                  <>
                    <BookmarkCheck size={13} className="text-emerald-400" />
                    <span>{isSavingPending ? "Updating..." : "Saved in Library"}</span>
                  </>
                ) : (
                  <>
                    <BookmarkPlus size={13} className="text-primary" />
                    <span>{isSavingPending ? "Saving..." : "Save to Library"}</span>
                  </>
                )}
              </button>
            )}

            {/* Owner Edit Shortcut */}
            {isOwner && (
              <Link
                href={`/my-playlists/${playlist.id}`}
                className="flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3.5 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/20"
              >
                Edit in My Playlists
              </Link>
            )}

            {/* Share button */}
            <button
              type="button"
              onClick={onOpenShare}
              className="flex items-center gap-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 px-3.5 py-1.5 text-xs font-semibold text-white transition-all cursor-pointer"
              title="Share this playlist"
            >
              <Share2 size={13} />
              <span>Share</span>
            </button>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
