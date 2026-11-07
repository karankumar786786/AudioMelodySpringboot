"use client";

import React, { useState, useEffect } from "react";
import { ListMusic, Plus, Check, Loader2, X, Search, Music } from "lucide-react";
import { adminFetch } from "@/lib/adminFetch";
import { getImageUrl } from "@/lib/image-utils";
import type { Song } from "@/app/songs/types";

interface BasicPlaylist {
  id: string;
  name: string;
  totalSongs?: number;
  coverImageKey?: string;
}

interface AddToPlaylistModalProps {
  song: Song | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (playlistName: string) => void;
}

export function AddToPlaylistModal({
  song,
  isOpen,
  onClose,
  onSuccess,
}: AddToPlaylistModalProps) {
  const [playlists, setPlaylists] = useState<BasicPlaylist[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingToId, setAddingToId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setSearch("");
      setError(null);
      setAddingToId(null);
      return;
    }

    const fetchPlaylists = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await adminFetch("/admin/playlist?page=0&size=100");
        if (res.ok) {
          const data = await res.json();
          const list =
            data.content ||
            data.data?.content ||
            (Array.isArray(data.data) ? data.data : []);
          setPlaylists(list);
        } else {
          setError("Failed to fetch playlists");
        }
      } catch (err) {
        console.error("Failed to load playlists", err);
        setError("Error loading playlists");
      } finally {
        setLoading(false);
      }
    };

    fetchPlaylists();
  }, [isOpen]);

  if (!isOpen || !song) return null;

  const filteredPlaylists = playlists.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase().trim())
  );

  const handleSelectPlaylist = async (playlist: BasicPlaylist) => {
    try {
      setAddingToId(playlist.id);
      const res = await adminFetch(`/admin/playlist/${playlist.id}/songs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ songId: song.id }),
      });

      if (res.ok) {
        onSuccess(playlist.name);
        onClose();
      } else {
        const data = await res.json().catch(() => null);
        setError(data?.message || "Failed to add track to playlist");
      }
    } catch (err: any) {
      console.error("Add to playlist error:", err);
      setError(err.message || "Failed to add track to playlist");
    } finally {
      setAddingToId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-[#121215] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-5 border-b border-white/8 bg-[#0e0e11] flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0 pr-2">
            <div className="w-10 h-10 rounded-xl bg-black border border-white/10 overflow-hidden shrink-0 flex items-center justify-center">
              {song.imageKey ? (
                <img
                  src={getImageUrl(song.imageKey, { width: 80, height: 80 })}
                  alt={song.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Music className="w-4 h-4 text-zinc-500" />
              )}
            </div>
            <div className="min-w-0">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Add to Playlist
              </h3>
              <p className="text-sm font-bold text-white truncate">
                {song.title}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded-xl hover:bg-white/6 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filter Search */}
        <div className="p-3 border-b border-white/6 bg-[#141418]">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Search playlist name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-[#18181c] border border-white/8 hover:border-white/14 focus:border-white/30 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none transition-all"
            />
          </div>
        </div>

        {/* Playlists list */}
        <div className="p-3 overflow-y-auto space-y-1.5 flex-1 custom-scrollbar min-h-55">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs mb-2">
              {error}
            </div>
          )}

          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-zinc-500 text-xs">
              <Loader2 className="w-6 h-6 animate-spin text-white" />
              <span>Loading playlists...</span>
            </div>
          ) : filteredPlaylists.length === 0 ? (
            <div className="py-12 text-center text-zinc-500 text-xs">
              <ListMusic className="w-8 h-8 mx-auto mb-2 opacity-30 text-zinc-400" />
              <p className="text-zinc-400 font-medium">No playlists found</p>
              <p className="text-[11px] text-zinc-600 mt-0.5">
                Create a playlist first from the Playlists section.
              </p>
            </div>
          ) : (
            filteredPlaylists.map((p) => {
              const isAdding = addingToId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelectPlaylist(p)}
                  disabled={Boolean(addingToId)}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl bg-[#141418] hover:bg-[#1a1a20] border border-white/6 hover:border-white/14 transition-all group text-left cursor-pointer disabled:opacity-50"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-black border border-white/10 overflow-hidden shrink-0 flex items-center justify-center">
                      {p.coverImageKey ? (
                        <img
                          src={getImageUrl(p.coverImageKey, { width: 72, height: 72 })}
                          alt={p.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <ListMusic className="w-4 h-4 text-zinc-500" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white group-hover:text-zinc-200 truncate">
                        {p.name}
                      </p>
                      <p className="text-[10px] text-zinc-400 font-mono">
                        {p.totalSongs ?? 0} tracks
                      </p>
                    </div>
                  </div>

                  <div className="p-1 rounded-lg bg-white/6 group-hover:bg-white text-zinc-400 group-hover:text-black transition-all shrink-0">
                    {isAdding ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Plus className="w-3.5 h-3.5" />
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
