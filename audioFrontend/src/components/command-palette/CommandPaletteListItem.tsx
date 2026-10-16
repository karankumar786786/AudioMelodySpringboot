"use client";

import React from "react";
import { Clock, CornerDownLeft, ListMusic, Play, User, X } from "lucide-react";
import { getImageUrl } from "@/lib/image-utils";
import { SongThumbnail } from "@/components/SongThumbnail";
import type { NavigableItem } from "./types";

interface CommandPaletteListItemProps {
  item: NavigableItem;
  idx: number;
  isSelected: boolean;
  onSelect: (item: NavigableItem) => void;
  onMouseEnter: () => void;
  onDeleteHistoryItem: (id: string) => void;
}

export function CommandPaletteListItem({
  item,
  idx,
  isSelected,
  onSelect,
  onMouseEnter,
  onDeleteHistoryItem,
}: CommandPaletteListItemProps) {
  const imageUrl = item.imageKey
    ? getImageUrl(item.imageKey, { width: 80, height: 80, aspectRatio: "1-1" })
    : null;

  return (
    <div
      data-index={idx}
      onMouseEnter={onMouseEnter}
      onClick={() => onSelect(item)}
      className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-colors select-none group ${
        isSelected
          ? "bg-white/10 text-white"
          : "text-zinc-300 hover:bg-white/5"
      }`}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {/* Item Thumbnail / Icon */}
        {item.type === "song" && item.data ? (
          <SongThumbnail
            song={item.data}
            sizeClass="w-10 h-10"
            roundedClass="rounded-lg"
            enablePreviewHover={true}
            onPlayClick={() => onSelect(item)}
          />
        ) : (
          <div
            className={`w-10 h-10 overflow-hidden bg-zinc-800 shrink-0 flex items-center justify-center border border-white/5 ${
              item.type === "artist" ? "rounded-full" : "rounded-lg"
            }`}
          >
            {imageUrl ? (
              <img
                src={imageUrl}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : item.type === "artist" ? (
              <User size={18} className="text-zinc-400" />
            ) : item.type === "playlist" ? (
              <ListMusic size={18} className="text-zinc-400" />
            ) : (
              <Clock size={16} className="text-zinc-500" />
            )}
          </div>
        )}

        {/* Title & Subtitle */}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate text-white">
            {item.title}
          </p>
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span className="capitalize font-medium text-zinc-500">
              {item.type}
            </span>
            {item.subtitle && (
              <>
                <span>•</span>
                <span className="truncate">{item.subtitle}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Action Indicators */}
      <div className="shrink-0 flex items-center gap-1.5 pl-3">
        {item.type === "song" && (
          <span className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-xs text-primary font-medium">
            <Play size={12} fill="currentColor" /> Play
          </span>
        )}
        {item.historyId && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteHistoryItem(item.historyId!);
            }}
            className="p-1 rounded-full text-zinc-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            title="Remove"
          >
            <X size={13} />
          </button>
        )}
        {isSelected && (
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-white/10 text-[10px] font-mono text-zinc-300">
            <CornerDownLeft size={11} />
          </kbd>
        )}
      </div>
    </div>
  );
}
