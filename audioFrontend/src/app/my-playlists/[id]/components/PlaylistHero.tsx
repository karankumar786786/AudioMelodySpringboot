"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  BookmarkCheck,
  BookmarkPlus,
  Globe,
  Heart,
  Link2,
  ListMusic,
  Lock,
  Music,
  Pencil,
  Play,
  Share2,
  Sparkles,
  Trash2,
} from "lucide-react";
import type { UserPlaylist } from "@/lib/api";
import { formatDuration } from "@/lib/player-utils";

interface PlaylistHeroProps {
  backgroundColor: string;
  playlist: UserPlaylist;
  isFavourites: boolean;
  isOwner: boolean;
  hasCustomCover: boolean;
  coverUrl?: string;
  showMosaic: boolean;
  mosaicImages: (string | null | undefined)[];
  showSingleSongImage: boolean;
  singleSongImage?: string | null;
  systemUser: any;
  songs: any[];
  isSaved: boolean;
  toggleSavePending: boolean;
  onStreamAll: () => void;
  onToggleSave: () => void;
  onDeletePlaylist: () => void;
  onOpenShareModal: () => void;
  onOpenRenameModal: () => void;
}

export function PlaylistHero({
  backgroundColor,
  playlist,
  isFavourites,
  isOwner,
  hasCustomCover,
  coverUrl,
  showMosaic,
  mosaicImages,
  showSingleSongImage,
  singleSongImage,
  systemUser,
  songs,
  isSaved,
  toggleSavePending,
  onStreamAll,
  onToggleSave,
  onDeletePlaylist,
  onOpenShareModal,
  onOpenRenameModal,
}: PlaylistHeroProps) {
  const privacy = playlist.privacy || "PRIVATE";

  return (
    <section
      className="relative overflow-hidden px-8 pb-8 pt-24 md:px-10 md:pt-28 rounded-2xl mx-2"
      style={{
        background: `linear-gradient(to bottom, ${backgroundColor} 0%, ${backgroundColor} 35%, rgba(0,0,0,0.92) 100%)`,
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
          {isFavourites ? (
            <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-indigo-600 via-purple-600 to-pink-500 shadow-2xl shadow-purple-500/20">
              <Heart size={72} fill="white" className="text-white drop-shadow-md" />
            </div>
          ) : hasCustomCover ? (
            <img
              src={coverUrl}
              alt={playlist?.name || "Playlist"}
              className="h-full w-full object-cover"
            />
          ) : showMosaic ? (
            <div className="grid h-full w-full grid-cols-2 grid-rows-2">
              {mosaicImages.map((img: string | null | undefined, i: number) =>
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
              alt={playlist?.name || "Playlist"}
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
          <div className="mb-2 flex items-center gap-2.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-white/80">
              {isFavourites ? "Personal Collection" : isOwner ? "Your Playlist" : "Dynamic Playlist"}
            </span>
            {!isFavourites && (
              <>
                <span>•</span>
                {isOwner ? (
                  <button
                    type="button"
                    onClick={onOpenShareModal}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide border transition-all cursor-pointer hover:scale-105 ${
                      privacy === "PUBLIC"
                        ? "bg-white/10 text-white border-white/30 hover:bg-white/20"
                        : privacy === "SHARE_BY_LINK"
                        ? "bg-blue-500/20 text-blue-300 border-blue-500/40 hover:bg-blue-500/30"
                        : "bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30"
                    }`}
                    title="Click to manage playlist privacy & share"
                  >
                    {privacy === "PUBLIC" && <Globe size={11} />}
                    {privacy === "SHARE_BY_LINK" && <Link2 size={11} />}
                    {privacy === "PRIVATE" && <Lock size={11} />}
                    <span>
                      {privacy === "PUBLIC"
                        ? "Public"
                        : privacy === "SHARE_BY_LINK"
                        ? "Share by link"
                        : "Private"}
                    </span>
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide border bg-white/10 text-white border-white/20">
                    <Sparkles size={11} />
                    <span>Dynamic Live Sync</span>
                  </span>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-3">
            <h1 className="wrap-break-word text-4xl font-black tracking-tight text-white md:text-6xl">
              {playlist?.name}
            </h1>
            {isOwner && !isFavourites && (
              <button
                type="button"
                onClick={onOpenRenameModal}
                className="rounded-full p-2 text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                title="Rename playlist"
              >
                <Pencil size={20} />
              </button>
            )}
          </div>

          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/70">
            {playlist?.description || "A curated playlist of songs."}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2.5 text-xs text-white/80">
            <span className="font-semibold">
              {isOwner
                ? systemUser?.username || systemUser?.name || "You"
                : playlist?.ownerName
                ? `Curated by ${playlist.ownerName}`
                : "Community Playlist"}
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
                  className="ml-2 flex items-center gap-1.5 rounded-full bg-white px-5 py-2 text-sm font-semibold text-black transition-colors hover:bg-white/80 cursor-pointer shadow-lg"
                >
                  <Play size={15} fill="black" />
                  Play All
                </button>
              </>
            )}

            {!isOwner && !isFavourites && (
              <button
                type="button"
                onClick={onToggleSave}
                disabled={toggleSavePending}
                className={`ml-1 flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                  isSaved
                    ? "bg-white/15 text-white border border-white/30 hover:bg-red-500/20 hover:text-red-300 hover:border-red-500/40"
                    : "bg-white/10 hover:bg-white/20 border border-white/20 text-white"
                }`}
                title={isSaved ? "Click to remove from your library" : "Save to library (Live updates by creator)"}
              >
                {isSaved ? (
                  <>
                    <BookmarkCheck size={13} className="text-white" />
                    <span>{toggleSavePending ? "Updating..." : "Saved in Library"}</span>
                  </>
                ) : (
                  <>
                    <BookmarkPlus size={13} className="text-primary" />
                    <span>{toggleSavePending ? "Saving..." : "Save to Library"}</span>
                  </>
                )}
              </button>
            )}

            {isOwner && !isFavourites && (
              <button
                onClick={onDeletePlaylist}
                className="flex items-center gap-1.5 rounded-full border border-red-500/30 px-3 py-1.5 text-xs font-semibold text-red-400 transition-colors hover:border-red-400 hover:text-red-300 cursor-pointer"
                title="Delete playlist"
              >
                <Trash2 size={13} /> Delete
              </button>
            )}

            {!isFavourites && (
              <button
                type="button"
                onClick={onOpenShareModal}
                className="flex items-center gap-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 px-3.5 py-1.5 text-xs font-semibold text-white transition-all cursor-pointer"
                title="Share playlist"
              >
                <Share2 size={13} />
                <span>Share</span>
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
