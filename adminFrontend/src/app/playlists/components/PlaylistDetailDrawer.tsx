"use client";

import { useState } from "react";
import { Plus, Trash2, Video, Music, Loader2, X } from "lucide-react";
import { getImageUrl } from "@/lib/image-utils";
import type { Playlist, PlaylistSong } from "../types";

interface PlaylistDetailDrawerProps {
  playlist: Playlist;
  songs: PlaylistSong[];
  availableSongs: PlaylistSong[];
  loadingSongs: boolean;
  addingSong: boolean;
  removingSongId: string | null;
  uploadingVideo: boolean;
  removingVideo: boolean;
  onClose: () => void;
  onAddSong: (songId: string) => Promise<void>;
  onRemoveSong: (songId: string, songTitle?: string) => Promise<void>;
  onAttachVideo: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveVideo: () => void;
}

export function PlaylistDetailDrawer({
  playlist,
  songs,
  availableSongs,
  loadingSongs,
  addingSong,
  removingSongId,
  uploadingVideo,
  removingVideo,
  onClose,
  onAddSong,
  onRemoveSong,
  onAttachVideo,
  onRemoveVideo,
}: PlaylistDetailDrawerProps) {
  const [selectedSongId, setSelectedSongId] = useState("");

  const filteredAvailable = availableSongs.filter(
    (s) => !songs.some((ps) => ps.id === s.id),
  );

  const handleAddSubmit = async () => {
    if (!selectedSongId) return;
    await onAddSong(selectedSongId);
    setSelectedSongId("");
  };

  return (
    <div className="bg-[#121212] rounded-3xl border border-[#282828] p-6 sm:p-8 space-y-6 shadow-xl text-white">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 border-b border-[#282828] pb-6">
        <div className="flex items-center gap-5">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-zinc-900 border border-[#282828] overflow-hidden shrink-0 shadow-lg">
            {playlist.coverImageKey ? (
              <img
                src={getImageUrl(playlist.coverImageKey, {
                  width: 200,
                  height: 200,
                  focus: "auto",
                  aspectRatio: "1-1",
                })}
                alt={playlist.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-600">
                <Music className="w-8 h-8" />
              </div>
            )}
          </div>
          <div>
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">
              Playlist Details
            </span>
            <h2 className="text-xl sm:text-2xl font-bold text-white mt-1">
              {playlist.name}
            </h2>
            <p className="text-xs text-zinc-400 mt-1 line-clamp-2 max-w-md">
              {playlist.description || "No description provided."}
            </p>
          </div>
        </div>

        {/* Video Canvas Controls & Close */}
        <div className="flex items-center gap-3 self-end sm:self-center">
          {playlist.videoKey && (
            <button
              type="button"
              onClick={onRemoveVideo}
              disabled={uploadingVideo || removingVideo}
              className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {removingVideo ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Trash2 className="w-3.5 h-3.5" />
              )}
              <span>Remove Video</span>
            </button>
          )}

          <label
            className={`cursor-pointer bg-zinc-800 hover:bg-zinc-700 border border-[#282828] text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              uploadingVideo ? "opacity-75 cursor-wait" : ""
            }`}
          >
            {uploadingVideo ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                <span>Uploading...</span>
              </>
            ) : (
              <>
                <Video className="w-3.5 h-3.5 text-emerald-400" />
                <span>{playlist.videoKey ? "Replace Video" : "Attach Video"}</span>
              </>
            )}
            <input
              type="file"
              accept="video/*"
              onChange={onAttachVideo}
              disabled={uploadingVideo || removingVideo}
              className="hidden"
            />
          </label>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
            title="Close playlist detail"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Add Track Selector */}
      <div className="bg-[#181818] border border-[#282828] rounded-2xl p-4 space-y-3">
        <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
          <Plus className="w-3.5 h-3.5 text-emerald-400" />
          Add Track to Playlist
        </h4>
        <div className="flex flex-col sm:flex-row gap-2">
          <select
            value={selectedSongId}
            onChange={(e) => setSelectedSongId(e.target.value)}
            disabled={addingSong}
            className="flex-1 bg-black/60 border border-[#282828] rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-white disabled:opacity-50 cursor-pointer"
          >
            <option value="" className="bg-[#121212] text-zinc-500">
              Select a track to add ({filteredAvailable.length} available)...
            </option>
            {filteredAvailable.map((s) => (
              <option key={s.id} value={s.id} className="bg-[#121212] text-white">
                {s.title}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleAddSubmit}
            disabled={addingSong || !selectedSongId}
            className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 shrink-0"
          >
            {addingSong ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4 stroke-[2.5]" />
            )}
            <span>Add Track</span>
          </button>
        </div>
      </div>

      {/* Playlist Songs Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-zinc-400 px-2 font-medium">
          <span>Tracks in Collection ({songs.length})</span>
          <span>Action</span>
        </div>

        {loadingSongs ? (
          <div className="p-8 text-center text-zinc-500 text-sm">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-zinc-400" />
            Loading tracks...
          </div>
        ) : songs.length === 0 ? (
          <div className="border border-dashed border-[#282828] rounded-2xl p-8 text-center text-zinc-500 text-xs">
            No tracks in this playlist yet. Add songs using the selector above.
          </div>
        ) : (
          <div className="space-y-2 max-h-100 overflow-y-auto pr-1">
            {songs.map((song, index) => (
              <div
                key={song.id}
                className="flex items-center justify-between p-3.5 bg-black/40 hover:bg-black/60 border border-[#282828] rounded-xl transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xs font-mono text-zinc-500 w-5 text-right">
                    {index + 1}
                  </span>
                  <Music className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-sm font-semibold text-white truncate">
                    {song.title}
                  </span>
                </div>

                <button
                  type="button"
                  disabled={removingSongId === song.id}
                  onClick={() => onRemoveSong(song.id, song.title)}
                  className="p-1.5 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                  title="Remove from playlist"
                >
                  {removingSongId === song.id ? (
                    <Loader2 className="w-4 h-4 animate-spin text-rose-400" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
