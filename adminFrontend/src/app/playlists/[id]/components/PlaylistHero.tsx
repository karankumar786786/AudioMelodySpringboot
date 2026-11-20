"use client";

import { Clock, Edit3, Music, Play, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { Playlist, PlaylistSong } from "@/app/playlists/types";
import { useToast } from "@/components/feedback/ToastProvider";
import { getImageUrl } from "@/lib/image-utils";
import { useUpdatePlaylist } from "@/lib/queries/playlists";
import { PlaylistMetadataForm } from "./PlaylistMetadataForm";
import { TeaserVideoControls } from "./TeaserVideoControls";

function totalRuntime(songs: PlaylistSong[]) {
  const seconds = songs.reduce((acc, s) => {
    const d = s.duration || 0;
    return acc + (d > 10000 ? Math.floor(d / 1000) : Math.floor(d));
  }, 0);
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return hrs > 0 ? `${hrs} hr ${mins} min` : `${mins} min`;
}

export function PlaylistHero({
  playlist,
  songs,
  editable,
}: {
  playlist: Playlist;
  songs: PlaylistSong[];
  editable: boolean;
}) {
  const toast = useToast();
  const update = useUpdatePlaylist(playlist.id);
  const [editing, setEditing] = useState(false);
  const totalStreams = songs.reduce((acc, s) => acc + (s.totalStreams || 0), 0);

  return (
    <div className="relative overflow-hidden rounded-3xl bg-linear-to-b from-[#18181c] to-[#101013] border border-white/8 p-6 md:p-8 shadow-xl">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 min-w-0">
          <div className="relative w-36 h-36 md:w-44 md:h-44 rounded-2xl overflow-hidden bg-black border border-white/10 shrink-0 shadow-2xl group">
            {playlist.coverImageKey ? (
              // biome-ignore lint/performance/noImgElement: ImageKit already serves a resized image
              <img
                src={getImageUrl(playlist.coverImageKey, { width: 360, height: 360, focus: "auto", aspectRatio: "1-1" })}
                alt={playlist.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-600 bg-zinc-900">
                <Music className="w-12 h-12" />
              </div>
            )}
          </div>

          <div className="space-y-3 min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/10 text-zinc-300 border border-white/15">
                Curated Playlist
              </span>
              <span className="text-zinc-500 text-xs">•</span>
              <span className="text-xs text-zinc-400 font-mono">ID: {playlist.id.slice(0, 8)}...</span>
            </div>

            {editing ? (
              <PlaylistMetadataForm
                initial={{ name: playlist.name, description: playlist.description ?? "" }}
                saving={update.isPending}
                onCancel={() => setEditing(false)}
                onSave={(values) => {
                  // Optimistic: the hero shows the new name at once and rolls back on failure.
                  setEditing(false);
                  update.mutate(values, {
                    onSuccess: () => toast("Playlist details updated"),
                    onError: (err) => toast(err.message || "Failed to update playlist", "error"),
                  });
                }}
              />
            ) : (
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl md:text-4xl font-extrabold text-white tracking-tight">{playlist.name}</h1>
                  {editable && (
                    <button
                      type="button"
                      onClick={() => setEditing(true)}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                      title="Edit playlist title and description"
                      aria-label="Edit playlist details"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <p className="text-xs md:text-sm text-zinc-400 mt-2 max-w-2xl leading-relaxed">
                  {playlist.description || "No description provided."}
                </p>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-zinc-400">
              <span className="flex items-center gap-1.5">
                <strong className="text-white font-bold font-mono">{songs.length}</strong>{" "}
                {songs.length === 1 ? "track" : "tracks"}
              </span>
              <span className="text-zinc-600">•</span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-zinc-500" />
                <span className="font-mono text-zinc-300">{totalRuntime(songs)}</span>
              </span>
              <span className="text-zinc-600">•</span>
              <span className="flex items-center gap-1.5 font-mono">
                <Play className="w-3 h-3 text-white fill-white" />
                <span className="text-white font-bold">{totalStreams.toLocaleString()}</span> streams
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row lg:flex-col items-start lg:items-end gap-3 shrink-0">
          <TeaserVideoControls playlist={playlist} editable={editable} />
          {editable && (
            <Link
              href="/songs"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 text-black font-bold text-xs transition-all shadow-sm active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Browse Catalog to Add (+)</span>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
