"use client";

import { ListMusic, Music, Trash2, Video, Loader2 } from "lucide-react";
import { getImageUrl } from "@/lib/image-utils";
import type { Playlist } from "../types";

interface PlaylistsGridProps {
  playlists: Playlist[];
  loading: boolean;
  deletingPlaylistId: string | null;
  selectedPlaylistId?: string | null;
  onSelectPlaylist: (playlist: Playlist) => void;
  onDeletePlaylist: (id: string, name: string) => void;
}

export function PlaylistsGrid({
  playlists,
  loading,
  deletingPlaylistId,
  selectedPlaylistId,
  onSelectPlaylist,
  onDeletePlaylist,
}: PlaylistsGridProps) {
  if (loading && playlists.length === 0) {
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

  if (playlists.length === 0) {
    return (
      <div className="bg-[#121212] border border-[#282828] rounded-2xl p-12 text-center">
        <ListMusic className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
        <h3 className="text-white font-bold text-base">No playlists found</h3>
        <p className="text-zinc-500 text-xs mt-1">
          Create curated collections to engage your listeners.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {playlists.map((playlist) => {
        const isSelected = selectedPlaylistId === playlist.id;
        return (
          <div
            key={playlist.id}
            onClick={() => onSelectPlaylist(playlist)}
            className={`group relative bg-[#121212] hover:bg-[#181818] border rounded-2xl p-3.5 transition-all duration-200 cursor-pointer flex flex-col justify-between ${
              isSelected
                ? "border-emerald-500/80 shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500"
                : "border-[#282828] hover:border-zinc-700"
            }`}
          >
            {/* Cover Art */}
            <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-zinc-900 mb-3">
              {playlist.coverImageKey ? (
                <img
                  src={getImageUrl(playlist.coverImageKey, {
                    width: 320,
                    height: 320,
                    focus: "auto",
                    aspectRatio: "1-1",
                  })}
                  alt={playlist.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-zinc-800">
                  <Music className="w-12 h-12 text-zinc-600" />
                </div>
              )}

              {/* Badges Over Cover */}
              <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none">
                <span className="flex items-center gap-1 bg-black/75 backdrop-blur-md text-white text-[10px] font-bold px-2 py-0.5 rounded-full border border-white/10 shadow-sm">
                  <Music className="w-2.5 h-2.5 text-emerald-400" />
                  {playlist.totalSongs || 0} tracks
                </span>

                {playlist.videoKey && (
                  <span className="flex items-center gap-1 bg-emerald-500/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                    <Video className="w-2.5 h-2.5" />
                    Teaser
                  </span>
                )}
              </div>

              {/* Hover Delete Action */}
              <div className="absolute inset-0 bg-linear-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-end justify-end p-3">
                <button
                  type="button"
                  disabled={deletingPlaylistId === playlist.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeletePlaylist(playlist.id, playlist.name);
                  }}
                  className="p-2 rounded-xl bg-rose-500/20 backdrop-blur-md text-rose-300 hover:bg-rose-600 hover:text-white transition-all cursor-pointer disabled:opacity-50"
                  title="Delete playlist"
                >
                  {deletingPlaylistId === playlist.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-400" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            {/* Info */}
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-white truncate" title={playlist.name}>
                {playlist.name}
              </h4>
              <p
                className="text-xs text-zinc-400 line-clamp-2 leading-relaxed"
                title={playlist.description}
              >
                {playlist.description || "No description provided."}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
