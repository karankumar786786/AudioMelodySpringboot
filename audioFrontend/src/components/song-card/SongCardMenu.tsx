"use client";

import React from "react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

      {/* More Options Dropdown using shadcn DropdownMenu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            onClick={(e) => e.stopPropagation()}
            className="w-7 h-7 rounded-full bg-black/60 hover:bg-black flex items-center justify-center text-zinc-300 hover:text-white transition-all shadow-md cursor-pointer focus:outline-none"
            title="More options"
          >
            <MoreVertical size={13} />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          sideOffset={6}
          className="w-48 bg-[#181818]/95 border-white/10 backdrop-blur-xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Favourite / Unfavourite Option */}
          <DropdownMenuItem
            onClick={async (e) => {
              e.stopPropagation();
              await onToggleFavourite();
            }}
            className="gap-2.5 text-xs text-zinc-200 focus:bg-white/10 cursor-pointer"
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
              {isFavourite ? "Remove from favourites" : "Save to favourites"}
            </span>
          </DropdownMenuItem>

          {/* Play next */}
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              onPlayNext(e);
            }}
            className="gap-2.5 text-xs text-zinc-200 focus:bg-white/10 cursor-pointer"
          >
            <CornerDownRight size={14} className="text-primary" />
            <span>Play next</span>
          </DropdownMenuItem>

          {/* Start song radio */}
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              onStartRadio(e);
            }}
            className="gap-2.5 text-xs text-zinc-200 focus:bg-white/10 cursor-pointer"
          >
            <Radio size={14} className="text-cyan-400" />
            <span>Start song radio</span>
          </DropdownMenuItem>

          {/* Queue toggle */}
          {isInQueue ? (
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onRemoveFromQueue(e);
              }}
              className="gap-2.5 text-xs text-red-400 focus:text-red-300 focus:bg-red-500/10 cursor-pointer"
            >
              <ListMinus size={14} className="text-red-400" />
              <span>Remove from queue</span>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onAddToQueue(e);
              }}
              className="gap-2.5 text-xs text-zinc-200 focus:bg-white/10 cursor-pointer"
            >
              <ListPlus size={14} className="text-zinc-400" />
              <span>Add to queue</span>
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator className="bg-white/10" />

          {/* Add to playlist */}
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              onOpenPlaylistPicker(e);
            }}
            className="gap-2.5 text-xs text-zinc-200 focus:bg-white/10 cursor-pointer"
          >
            <Plus size={14} className="text-zinc-400" />
            <span>Add to playlist</span>
          </DropdownMenuItem>

          {/* Share track */}
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              onOpenShareModal(e);
            }}
            className="gap-2.5 text-xs text-zinc-200 focus:bg-white/10 cursor-pointer"
          >
            <Share2 size={14} className="text-primary" />
            <span>Share track</span>
          </DropdownMenuItem>

          <DropdownMenuSeparator className="bg-white/10" />

          {/* Dislike */}
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              onDislike(e);
            }}
            className="gap-2.5 text-xs text-zinc-400 focus:text-red-400 focus:bg-red-500/10 cursor-pointer"
          >
            <Ban size={14} className="text-zinc-400" />
            <span>Don't play this again</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
