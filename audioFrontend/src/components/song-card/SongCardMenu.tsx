"use client";

import React, { useState } from "react";
import {
  Ban,
  CornerDownRight,
  Heart,
  ListMinus,
  ListPlus,
  MoreVertical,
  Plus,
  Radio,
  Share2,
  X,
} from "lucide-react";
import type { Song } from "@/lib/api";

interface SongCardMenuProps {
  song: Song;
  isFavourite: boolean;
  isInQueue: boolean;
  onRemove?: () => void;
  onToggleFavourite: () => Promise<void>;
  onPlayNext: (e: React.MouseEvent) => void;
  onStartRadio: (e: React.MouseEvent) => void;
  onAddToQueue: (e: React.MouseEvent) => void;
  onRemoveFromQueue: (e: React.MouseEvent) => void;
  onOpenPlaylistPicker: (e: React.MouseEvent) => void;
  onOpenShareModal: (e: React.MouseEvent) => void;
  onDislike: (e: React.MouseEvent) => void;
}

export function SongCardMenu({
  song: _song,
  isFavourite,
  isInQueue,
  onRemove,
  onToggleFavourite,
  onPlayNext,
  onStartRadio,
  onAddToQueue,
  onRemoveFromQueue,
  onOpenPlaylistPicker,
  onOpenShareModal,
  onDislike,
}: SongCardMenuProps) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-20">
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="w-7 h-7 rounded-full bg-black/60 hover:bg-black text-white flex items-center justify-center transition-all shadow-md cursor-pointer"
          title="Remove"
        >
          <X size={13} />
        </button>
      )}

      {/* More Options Dropdown */}
      <div className="relative">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu((v) => !v);
          }}
          className="w-7 h-7 rounded-full bg-black/60 hover:bg-black flex items-center justify-center text-zinc-300 hover:text-white transition-all shadow-md cursor-pointer"
          title="More options"
        >
          <MoreVertical size={13} />
        </button>

        {showMenu && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(false);
              }}
            />
            <div
              className="absolute right-0 top-full mt-1.5 w-48 rounded-xl bg-[#1e1e1e] border border-white/10 shadow-2xl z-50 p-1 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Favourite / Unfavourite Option */}
              <button
                type="button"
                onClick={async (e) => {
                  e.stopPropagation();
                  setShowMenu(false);
                  await onToggleFavourite();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-zinc-200 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
              >
                <Heart
                  size={14}
                  className={
                    isFavourite
                      ? "text-primary fill-primary"
                      : "text-zinc-400"
                  }
                />
                <span>
                  {isFavourite
                    ? "Remove from favourites"
                    : "Save to favourites"}
                </span>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  setShowMenu(false);
                  onPlayNext(e);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-zinc-200 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
              >
                <CornerDownRight size={14} className="text-primary" />
                <span>Play next</span>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  setShowMenu(false);
                  onStartRadio(e);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-zinc-200 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
              >
                <Radio size={14} className="text-cyan-400" />
                <span>Start song radio</span>
              </button>

              {isInQueue ? (
                <button
                  type="button"
                  onClick={(e) => {
                    setShowMenu(false);
                    onRemoveFromQueue(e);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                >
                  <ListMinus size={14} className="text-red-400" />
                  <span>Remove from queue</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={(e) => {
                    setShowMenu(false);
                    onAddToQueue(e);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-zinc-200 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                >
                  <ListPlus size={14} className="text-zinc-400" />
                  <span>Add to queue</span>
                </button>
              )}

              <button
                type="button"
                onClick={(e) => {
                  setShowMenu(false);
                  onOpenPlaylistPicker(e);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-zinc-200 hover:bg-white/10 hover:text-white transition-colors cursor-pointer border-t border-white/5 mt-1 pt-1.5"
              >
                <Plus size={14} className="text-zinc-400" />
                <span>Add to playlist</span>
              </button>

              {/* Share Track Story Card */}
              <button
                type="button"
                onClick={(e) => {
                  setShowMenu(false);
                  onOpenShareModal(e);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-zinc-200 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
              >
                <Share2 size={14} className="text-primary" />
                <span>Share track</span>
              </button>

              {/* Explicit Negative Feedback: Don't Play This Again */}
              <button
                type="button"
                onClick={(e) => {
                  setShowMenu(false);
                  onDislike(e);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer border-t border-white/5 mt-1 pt-1.5"
              >
                <Ban size={14} className="text-zinc-400" />
                <span>Don't play this again</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
