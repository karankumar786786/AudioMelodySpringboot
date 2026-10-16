"use client";

import React from "react";

interface PlaylistRenameModalProps {
  isOpen: boolean;
  renameText: string;
  setRenameText: (val: string) => void;
  isPending: boolean;
  onClose: () => void;
  onSave: () => void;
}

export function PlaylistRenameModal({
  isOpen,
  renameText,
  setRenameText,
  isPending,
  onClose,
  onSave,
}: PlaylistRenameModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-[#282828] bg-[#121212] p-6 shadow-2xl">
        <h3 className="text-lg font-bold text-white mb-1.5">Rename Playlist</h3>
        <p className="text-xs text-zinc-400 mb-4">Choose a new title for this playlist.</p>
        <input
          type="text"
          value={renameText}
          onChange={(e) => setRenameText(e.target.value)}
          placeholder="Playlist name"
          className="w-full rounded-xl border border-[#282828] bg-black/60 px-4 py-3 text-sm text-white placeholder-zinc-500 focus:border-white focus:outline-none"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter" && renameText.trim()) {
              onSave();
            }
          }}
        />
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!renameText.trim() || isPending}
            onClick={onSave}
            className="px-5 py-2 rounded-xl text-sm font-bold bg-white text-black hover:bg-white/80 transition-all disabled:opacity-40 cursor-pointer"
          >
            {isPending ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
