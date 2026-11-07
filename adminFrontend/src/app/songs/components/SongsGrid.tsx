"use client";

import React from "react";
import {
  Loader2,
  Music,
  Video,
  Film,
  Star,
  Edit2,
  Trash2,
  Play,
  Pause,
  ListPlus,
} from "lucide-react";
import { getImageUrl } from "@/lib/image-utils";
import { useAudio } from "@/lib/audio-context";
import type { Song } from "../types";

interface SongsGridProps {
  songs: Song[];
  loading: boolean;
  togglingSongId: string | null;
  deletingSongId: string | null;
  onToggleFeatured: (song: Song) => void;
  onEditSong: (song: Song) => void;
  onDeleteSong: (id: string, title: string) => void;
  onAddToPlaylist?: (song: Song) => void;
}

const formatDuration = (num?: number) => {
  if (!num || Number.isNaN(num)) return "0:00";
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
  onAddToPlaylist,
}: SongsGridProps) {
  const { currentTrack, isPlaying, playTrack, pauseTrack, resumeTrack } = useAudio();

  const handlePlaySong = (song: Song, e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentTrack?.id === song.id) {
      if (isPlaying) {
        pauseTrack();
      } else {
        resumeTrack();
      }
    } else {
      playTrack({
        id: song.id,
        title: song.title,
        artistName: song.artistName,
        songKey: song.songKey || `audios/${song.id}`,
        imageKey: song.imageKey,
        videoKey: song.videoKey || undefined,
        duration: song.duration,
      });
    }
  };

  if (loading && songs.length === 0) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="bg-[#121215] border border-white/8 rounded-2xl p-4 animate-pulse space-y-3"
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
      <div className="bg-[#121215] border border-white/8 rounded-2xl p-16 text-center">
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
      {songs.map((song) => {
        const isCurrentPlaying = currentTrack?.id === song.id && isPlaying;
        const genres = song.genre
          ? song.genre.split(",").map((g) => g.trim()).filter(Boolean)
          : [];

        return (
          <div
            key={song.id}
            className="group relative bg-[#121215] hover:bg-[#16161b] border border-white/8 hover:border-white/16 rounded-2xl p-3.5 transition-all duration-200 flex flex-col justify-between shadow-sm hover:shadow-lg hover:shadow-black/50"
          >
            {/* Cover Artwork Container */}
            <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-black mb-3 group/cover">
              {song.imageKey ? (
                <img
                  src={getImageUrl(song.imageKey, {
                    width: 360,
                    height: 360,
                    focus: "auto",
                    aspectRatio: "1-1",
                  })}
                  alt={song.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-zinc-900">
                  <Music className="w-12 h-12 text-zinc-600" />
                </div>
              )}

              {/* Badges Over Cover */}
              <div className="absolute top-2.5 left-2.5 right-2.5 flex flex-wrap items-center gap-1.5 pointer-events-none">
                {song.isFeatured && (
                  <span className="flex items-center gap-1 bg-amber-400 text-black text-[10px] font-black px-2 py-0.5 rounded-full shadow-md">
                    <Star className="w-2.5 h-2.5 fill-black" />
                    <span>Featured</span>
                  </span>
                )}
                {song.country && (
                  <span className="flex items-center gap-1 bg-black/70 text-zinc-200 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md backdrop-blur-sm border border-white/15">
                    <span>{song.country.toLowerCase() === "india" ? "🇮🇳" : "🌐"}</span>
                    <span>{song.country}</span>
                  </span>
                )}
                {song.videoKey && (
                  <span className="flex items-center gap-1 bg-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md backdrop-blur-sm border border-white/20">
                    <Film className="w-2.5 h-2.5" />
                    <span>Canvas</span>
                  </span>
                )}
                {song.fullVideoKey && (
                  <span className="flex items-center gap-1 bg-white text-black text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md">
                    <Video className="w-2.5 h-2.5" />
                    <span>Video</span>
                  </span>
                )}
              </div>

              {/* Center Play Button Overlay */}
              <button
                type="button"
                onClick={(e) => handlePlaySong(song, e)}
                className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-all cursor-pointer ${
                  isCurrentPlaying
                    ? "opacity-100"
                    : "opacity-0 group-hover:opacity-100"
                }`}
              >
                <div className="w-12 h-12 rounded-full bg-white hover:bg-zinc-200 text-black flex items-center justify-center shadow-xl transform active:scale-95 transition-all">
                  {isCurrentPlaying ? (
                    <Pause className="w-5 h-5 fill-black" />
                  ) : (
                    <Play className="w-5 h-5 fill-black translate-x-0.5" />
                  )}
                </div>
              </button>

              {/* Bottom Quick Actions Bar */}
              <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-between p-2.5">
                <button
                  type="button"
                  disabled={togglingSongId === song.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFeatured(song);
                  }}
                  title={song.isFeatured ? "Unfeature" : "Feature"}
                  className="p-1.5 rounded-lg bg-white/20 backdrop-blur-md text-white hover:bg-white hover:text-black transition-all cursor-pointer"
                >
                  {togglingSongId === song.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Star
                      className={`w-3.5 h-3.5 ${
                        song.isFeatured ? "fill-amber-400 text-amber-400" : ""
                      }`}
                    />
                  )}
                </button>

                <div className="flex items-center gap-1.5">
                  {/* Add to Playlist (+) */}
                  {onAddToPlaylist && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddToPlaylist(song);
                      }}
                      className="p-1.5 rounded-lg bg-white/20 backdrop-blur-md text-white hover:bg-white hover:text-black transition-all cursor-pointer"
                      title="Add to playlist"
                    >
                      <ListPlus className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditSong(song);
                    }}
                    className="p-1.5 rounded-lg bg-white/20 backdrop-blur-md text-white hover:bg-white hover:text-black transition-all cursor-pointer"
                    title="Edit track"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    disabled={deletingSongId === song.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSong(song.id, song.title);
                    }}
                    className="p-1.5 rounded-lg bg-rose-500/20 backdrop-blur-md text-rose-300 hover:bg-rose-600 hover:text-white transition-all cursor-pointer disabled:opacity-50"
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
            </div>

            {/* Track Details */}
            <div className="space-y-1.5">
              <h4
                className="text-xs font-bold text-white truncate"
                title={song.title}
              >
                {song.title}
              </h4>
              <div className="flex items-center justify-between gap-1.5 text-[11px] text-zinc-400">
                <span className="truncate" title={song.artistName}>
                  {song.artistName}
                </span>
                {song.album && (
                  <span className="truncate text-zinc-500 text-[10px] shrink-0 max-w-[45%]" title={song.album}>
                    • {song.album}
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between text-[11px] text-zinc-500 pt-1.5 border-t border-white/6">
                <div className="flex items-center gap-2">
                  <span className="font-mono tabular-nums">
                    {formatDuration(song.duration)}
                  </span>
                  <span className="text-zinc-600">•</span>
                  <span
                    className="flex items-center gap-1 font-mono text-[10px] text-zinc-400 tabular-nums"
                    title="Total streams"
                  >
                    <Play className="w-2.5 h-2.5 text-white fill-white" />
                    {(song.totalStreams ?? 0).toLocaleString()}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  {genres.slice(0, 2).map((g) => (
                    <span
                      key={g}
                      className="bg-white/6 text-zinc-300 border border-white/8 px-1.5 py-0.5 rounded text-[9px] font-semibold"
                    >
                      {g}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
