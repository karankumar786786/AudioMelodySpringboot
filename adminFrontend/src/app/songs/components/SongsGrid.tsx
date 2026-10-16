"use client";

import { Loader2, Music, Sparkles, Video, Film, Clock, Star, Edit2, Trash2, Play } from "lucide-react";
import { getImageUrl } from "@/lib/image-utils";
import type { Song } from "../types";

interface SongsGridProps {
  songs: Song[];
  loading: boolean;
  togglingSongId: string | null;
  deletingSongId: string | null;
  onToggleFeatured: (song: Song) => void;
  onEditSong: (song: Song) => void;
  onDeleteSong: (id: string, title: string) => void;
}

const formatDuration = (num?: number) => {
  if (!num || isNaN(num)) return "0:00";
  const sec = num > 10000 ? Math.floor(num / 1000) : Math.floor(num);
  const mins = Math.floor(sec / 60);
  const secs = sec % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export function SongsGrid({
  songs,
  loading,
  togglingSongId,
  deletingSongId,
  onToggleFeatured,
  onEditSong,
  onDeleteSong,
}: SongsGridProps) {
  if (loading && songs.length === 0) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="bg-[#121212] border border-[#282828] rounded-2xl p-4 animate-pulse space-y-3"
          >
            <div className="aspect-square bg-zinc-800 rounded-xl w-full" />
            <div className="h-4 bg-zinc-800 rounded-md w-3/4" />
            <div className="h-3 bg-zinc-800 rounded-md w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (songs.length === 0) {
    return (
      <div className="bg-[#121212] border border-[#282828] rounded-2xl p-12 text-center">
        <Music className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
        <h3 className="text-white font-bold text-base">No tracks found</h3>
        <p className="text-zinc-500 text-xs mt-1">
          Try adjusting your search query or add a new track to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {songs.map((song) => (
        <div
          key={song.id}
          className="group relative bg-[#121212] hover:bg-[#181818] border border-[#282828] hover:border-zinc-700 rounded-2xl p-3.5 transition-all duration-200 flex flex-col justify-between"
        >
          {/* Cover Artwork Container */}
          <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-zinc-900 mb-3">
            {song.imageKey ? (
              <img
                src={getImageUrl(song.imageKey, {
                  width: 320,
                  height: 320,
                  focus: "auto",
                  aspectRatio: "1-1",
                })}
                alt={song.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-zinc-800">
                <Music className="w-12 h-12 text-zinc-600" />
              </div>
            )}

            {/* Badges Over Cover */}
            <div className="absolute top-2.5 left-2.5 right-2.5 flex flex-wrap items-center gap-1.5 pointer-events-none">
              {song.isFeatured && (
                <span className="flex items-center gap-1 bg-amber-500 text-black text-[10px] font-black px-2 py-0.5 rounded-full shadow-md">
                  <Star className="w-2.5 h-2.5 fill-black" />
                  Hero
                </span>
              )}
              {song.videoKey && (
                <span className="flex items-center gap-1 bg-emerald-500/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md">
                  <Video className="w-2.5 h-2.5" />
                  Canvas
                </span>
              )}
              {song.fullVideoKey && (
                <span className="flex items-center gap-1 bg-white text-black text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md">
                  <Film className="w-2.5 h-2.5" />
                  Full Video
                </span>
              )}
              {song.previewStartTime != null && (
                <span className="flex items-center gap-1 bg-zinc-900/90 border border-zinc-700 text-zinc-200 text-[10px] font-mono px-2 py-0.5 rounded-full shadow-md">
                  <Clock className="w-2.5 h-2.5 text-zinc-400" />
                  {formatDuration(song.previewStartTime)}-
                  {song.previewEndTime != null ? formatDuration(song.previewEndTime) : "end"}
                </span>
              )}
            </div>

            {/* Hover Actions Bar */}
            <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-end p-3 gap-2">
              <button
                type="button"
                disabled={togglingSongId === song.id}
                onClick={() => onToggleFeatured(song)}
                title={song.isFeatured ? "Remove from hero featured" : "Mark as hero featured"}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer ${
                  song.isFeatured
                    ? "bg-amber-500 text-black hover:bg-amber-400"
                    : "bg-white/20 backdrop-blur-md text-white hover:bg-white hover:text-black"
                }`}
              >
                {togglingSongId === song.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Star className={`w-3.5 h-3.5 ${song.isFeatured ? "fill-black" : ""}`} />
                )}
                <span>{song.isFeatured ? "Unfeature" : "Feature"}</span>
              </button>

              <button
                type="button"
                onClick={() => onEditSong(song)}
                className="p-2 rounded-xl bg-white/20 backdrop-blur-md text-white hover:bg-white hover:text-black transition-all cursor-pointer"
                title="Edit song details"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                disabled={deletingSongId === song.id}
                onClick={() => onDeleteSong(song.id, song.title)}
                className="p-2 rounded-xl bg-rose-500/20 backdrop-blur-md text-rose-300 hover:bg-rose-600 hover:text-white transition-all cursor-pointer disabled:opacity-50"
                title="Delete track"
              >
                {deletingSongId === song.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-400" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          {/* Track Details */}
          <div className="space-y-1.5">
            <h4 className="text-sm font-bold text-white truncate" title={song.title}>
              {song.title}
            </h4>
            <p className="text-xs text-zinc-400 truncate" title={song.artistName}>
              {song.artistName}
            </p>

            <div className="flex items-center justify-between text-[11px] text-zinc-500 pt-1 border-t border-[#1e1e1e]">
              <div className="flex items-center gap-2">
                <span className="font-mono">{formatDuration(song.duration)}</span>
                <span className="text-zinc-600">•</span>
                <span className="flex items-center gap-1 font-mono text-[10px] text-zinc-400" title="Total streams">
                  <Play className="w-2.5 h-2.5 text-emerald-400 fill-emerald-400" />
                  {(song.totalStreams ?? 0).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {song.language && (
                  <span className="bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded text-[10px]">
                    {song.language}
                  </span>
                )}
                {song.genre && (
                  <span className="bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded text-[10px]">
                    {song.genre}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
