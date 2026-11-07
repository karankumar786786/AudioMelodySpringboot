"use client";

import React from "react";
import Image from "next/image";
import {
  Play,
  Pause,
  Star,
  Edit2,
  Trash2,
  Film,
  Music,
  Clock,
  Sparkles,
  Check,
} from "lucide-react";
import { getImageUrl } from "@/lib/image-utils";
import { useAudio } from "@/lib/audio-context";
import { TableSkeleton } from "@/components/TableSkeleton";
import type { Song } from "../types";

interface SongsDataTableProps {
  songs: Song[];
  loading: boolean;
  selectedSongIds: string[];
  onToggleSelectAll: () => void;
  onToggleSelectSong: (id: string) => void;
  togglingSongId: string | null;
  deletingSongId: string | null;
  onToggleFeatured: (song: Song) => void;
  onEditSong: (song: Song) => void;
  onDeleteSong: (id: string, title: string) => void;
}

const formatDuration = (num?: number) => {
  if (!num || Number.isNaN(num)) return "0:00";
  const sec = num > 10000 ? Math.floor(num / 1000) : Math.floor(num);
  const mins = Math.floor(sec / 60);
  const secs = sec % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export function SongsDataTable({
  songs,
  loading,
  selectedSongIds,
  onToggleSelectAll,
  onToggleSelectSong,
  togglingSongId,
  deletingSongId,
  onToggleFeatured,
  onEditSong,
  onDeleteSong,
}: SongsDataTableProps) {
  const { currentTrack, isPlaying, playTrack, pauseTrack, resumeTrack } = useAudio();

  const isAllSelected =
    songs.length > 0 && songs.every((s) => selectedSongIds.includes(s.id));

  const handlePlaySong = (song: Song) => {
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
      <div className="bg-[#121215] border border-white/[0.08] rounded-2xl overflow-hidden shadow-sm">
        <TableSkeleton columns={8} rows={10} variant="default" />
      </div>
    );
  }

  if (songs.length === 0) {
    return (
      <div className="bg-[#121215] border border-white/[0.08] rounded-2xl p-16 text-center">
        <Music className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
        <h3 className="text-white font-bold text-base">No tracks found</h3>
        <p className="text-zinc-500 text-xs mt-1">
          Try adjusting your search query or add a new track to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-[#121215] border border-white/[0.08] rounded-2xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#0e0e11] border-b border-white/[0.08] text-zinc-400 uppercase font-bold tracking-wider text-[10px]">
            <tr>
              <th className="py-3.5 px-4 w-10">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={onToggleSelectAll}
                  className="rounded border-zinc-700 bg-zinc-900 text-white focus:ring-0 cursor-pointer"
                />
              </th>
              <th className="py-3.5 px-4">Track / Artist</th>
              <th className="py-3.5 px-4">Genres</th>
              <th className="py-3.5 px-4">Duration</th>
              <th className="py-3.5 px-4">Streams</th>
              <th className="py-3.5 px-4">Assets</th>
              <th className="py-3.5 px-4">Status</th>
              <th className="py-3.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.06]">
            {songs.map((song) => {
              const isSelected = selectedSongIds.includes(song.id);
              const isCurrentPlaying =
                currentTrack?.id === song.id && isPlaying;
              const isToggling = togglingSongId === song.id;
              const isDeleting = deletingSongId === song.id;

              // Parse comma-separated genres into badges
              const genreBadges = song.genre
                ? song.genre
                    .split(",")
                    .map((g) => g.trim())
                    .filter(Boolean)
                : [];

              return (
                <tr
                  key={song.id}
                  className={`hover:bg-white/[0.03] transition-colors group ${
                    isSelected ? "bg-white/[0.04]" : ""
                  }`}
                >
                  {/* Select Checkbox */}
                  <td className="py-3 px-4">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleSelectSong(song.id)}
                      className="rounded border-zinc-700 bg-zinc-900 text-white focus:ring-0 cursor-pointer"
                    />
                  </td>

                  {/* Artwork + Title + Artist */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="relative w-10 h-10 rounded-xl overflow-hidden bg-black border border-white/[0.1] shrink-0 group/cover">
                        {song.imageKey ? (
                          <img
                            src={getImageUrl(song.imageKey, { width: 80, height: 80 })}
                            alt={song.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-zinc-600">
                            <Music className="w-4 h-4" />
                          </div>
                        )}

                        {/* Inline Play / Pause Overlay */}
                        <button
                          type="button"
                          onClick={() => handlePlaySong(song)}
                          className={`absolute inset-0 bg-black/60 flex items-center justify-center transition-opacity cursor-pointer ${
                            isCurrentPlaying
                              ? "opacity-100"
                              : "opacity-0 group-hover/cover:opacity-100"
                          }`}
                        >
                          {isCurrentPlaying ? (
                            <Pause className="w-4 h-4 text-white fill-white" />
                          ) : (
                            <Play className="w-4 h-4 text-white fill-white translate-x-0.5" />
                          )}
                        </button>
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-bold text-white group-hover:text-indigo-300 transition-colors truncate max-w-[200px]">
                            {song.title}
                          </p>
                          {song.isFeatured && (
                            <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />
                          )}
                        </div>
                        <p className="text-[11px] text-zinc-400 truncate max-w-[200px]">
                          {song.artistName}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Multi-Genre Pills */}
                  <td className="py-3 px-4">
                    <div className="flex flex-wrap gap-1 max-w-[220px]">
                      {genreBadges.length > 0 ? (
                        genreBadges.slice(0, 3).map((g) => (
                          <span
                            key={g}
                            className="px-2 py-0.5 rounded-md bg-white/[0.06] text-zinc-300 border border-white/[0.08] text-[10px] font-semibold"
                          >
                            {g}
                          </span>
                        ))
                      ) : (
                        <span className="text-zinc-600 text-[11px]">—</span>
                      )}
                      {genreBadges.length > 3 && (
                        <span className="text-[10px] text-zinc-500 font-mono self-center">
                          +{genreBadges.length - 3}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Duration */}
                  <td className="py-3 px-4 font-mono text-zinc-400 tabular-nums">
                    {formatDuration(song.duration)}
                  </td>

                  {/* Streams */}
                  <td className="py-3 px-4 font-mono text-white tabular-nums">
                    {(song.totalStreams ?? 0).toLocaleString()}
                  </td>

                  {/* Video Canvas & Audio Indicator */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      {song.videoKey ? (
                        <span
                          className="p-1 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/25"
                          title="Vertical Video Canvas attached"
                        >
                          <Film className="w-3.5 h-3.5" />
                        </span>
                      ) : (
                        <span className="p-1 text-zinc-600" title="No Video Canvas">
                          <Film className="w-3.5 h-3.5 opacity-40" />
                        </span>
                      )}
                      {song.lrclibId ? (
                        <span
                          className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/25"
                          title="Synced lyrics available"
                        >
                          LRC
                        </span>
                      ) : null}
                    </div>
                  </td>

                  {/* Status */}
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        song.status === "ACTIVE"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/25"
                          : "bg-zinc-800/40 text-zinc-400 border-zinc-700/40"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          song.status === "ACTIVE" ? "bg-emerald-400" : "bg-zinc-500"
                        }`}
                      />
                      {song.status || "ACTIVE"}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {/* Toggle Featured */}
                      <button
                        type="button"
                        onClick={() => onToggleFeatured(song)}
                        disabled={isToggling}
                        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                          song.isFeatured
                            ? "text-amber-400 hover:text-amber-300 hover:bg-amber-400/10"
                            : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06]"
                        }`}
                        title={
                          song.isFeatured
                            ? "Remove from Featured Hero"
                            : "Promote to Featured Hero"
                        }
                      >
                        <Star
                          className={`w-3.5 h-3.5 ${
                            song.isFeatured ? "fill-amber-400" : ""
                          }`}
                        />
                      </button>

                      {/* Edit Track */}
                      <button
                        type="button"
                        onClick={() => onEditSong(song)}
                        className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/[0.06] rounded-lg transition-colors cursor-pointer"
                        title="Edit track metadata"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete Track */}
                      <button
                        type="button"
                        onClick={() => onDeleteSong(song.id, song.title)}
                        disabled={isDeleting}
                        className="p-1.5 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                        title="Delete track"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
