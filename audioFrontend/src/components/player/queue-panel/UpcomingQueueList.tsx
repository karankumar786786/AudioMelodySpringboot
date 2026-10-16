"use client";

import React, { useState } from "react";
import { GripVertical, Music, Sparkles, Trash2 } from "lucide-react";
import { playerActions } from "@/store/player.store";
import { formatDuration } from "@/lib/player-utils";
import { SongThumbnail } from "@/components/SongThumbnail";
import { toast } from "sonner";
import type { Song } from "@/lib/api/types";

interface UpcomingQueueListProps {
  upcoming: any[];
  currentIndex: number;
  queueLength: number;
  isRefilling: boolean;
}

export const UpcomingQueueList: React.FC<UpcomingQueueListProps> = ({
  upcoming,
  currentIndex,
  queueLength,
  isRefilling,
}) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", index.toString());
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== targetIndex) {
      playerActions.moveQueueItem(draggedIndex, targetIndex);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between px-1">
        <h4 className="text-[11px] font-bold text-zinc-400 tracking-wider uppercase">
          Next Up ({upcoming.length})
        </h4>
        {upcoming.length > 0 && (
          <button
            type="button"
            onClick={() => {
              playerActions.clearUpcomingQueue();
              toast.success("Upcoming queue cleared");
            }}
            className="text-[11px] font-medium text-zinc-400 hover:text-red-400 transition-colors cursor-pointer"
          >
            Clear
          </button>
        )}
      </div>

      {queueLength === 0 || upcoming.length === 0 ? (
        isRefilling ? (
          <div className="space-y-1.5 pt-1 animate-in fade-in duration-200">
            <div className="flex items-center gap-2 px-1 text-[11px] font-semibold text-primary">
              <Sparkles size={12} className="animate-spin text-primary shrink-0" />
              <span>Finding recommended songs...</span>
            </div>
            {[1, 2, 3].map((idx) => (
              <div
                key={`empty-refill-skeleton-${idx}`}
                className="flex items-center gap-2.5 rounded-lg border border-white/5 bg-white/3 p-2 animate-pulse"
              >
                <div className="w-8 h-8 rounded bg-white/10 shrink-0" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="h-3 w-3/4 rounded bg-white/10" />
                  <div className="h-2.5 w-2/5 rounded bg-white/5" />
                </div>
                <div className="h-2.5 w-7 rounded bg-white/5 shrink-0" />
              </div>
            ))}
          </div>
        ) : (
          <div className="py-12 text-center text-zinc-500 text-xs font-medium border border-dashed border-[#282828] rounded-lg space-y-1">
            <Music size={20} className="mx-auto text-zinc-600" />
            <p>No upcoming tracks in queue</p>
          </div>
        )
      ) : (
        <div className="space-y-1">
          {upcoming.map((song, offset) => {
            const index = currentIndex + 1 + offset;
            const isDraggingThis = draggedIndex === index;
            const isOverThis = dragOverIndex === index;

            return (
              <div
                key={song.queueId || `up-song-${song.id}`}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
                className={`group flex items-center gap-2 rounded-lg border p-2 transition-all select-none ${
                  isDraggingThis
                    ? "opacity-30 border-dashed border-primary"
                    : isOverThis
                      ? "border-primary bg-primary/10"
                      : "border-transparent hover:bg-white/5"
                }`}
              >
                {/* Drag Handle */}
                <div
                  className="cursor-grab active:cursor-grabbing text-zinc-500 hover:text-white p-0.5"
                  title="Drag to reorder"
                >
                  <GripVertical size={14} />
                </div>

                {/* Song Thumbnail with Hover Preview */}
                <SongThumbnail
                  song={song}
                  sizeClass="w-8 h-8"
                  roundedClass="rounded"
                  enablePreviewHover={true}
                  onPlayClick={() => playerActions.playFromQueue(index)}
                />

                {/* Title & Artist */}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-white truncate">
                    {song.title}
                  </p>
                  <p className="text-[11px] text-zinc-400 truncate">
                    {song.artistName}
                    {song.album && (
                      <span className="text-zinc-400"> • {song.album}</span>
                    )}
                    {song.genre && (
                      <span className="text-zinc-500"> • {song.genre}</span>
                    )}
                  </p>
                </div>

                {/* Queue Actions */}
                <div className="flex items-center gap-1 opacity-80 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      playerActions.removeFromQueue(index);
                    }}
                    className="p-1 rounded text-zinc-400 hover:text-red-400 hover:bg-red-500/10 cursor-pointer"
                    title="Remove from queue"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                {/* Duration */}
                <span className="text-[11px] mx-3 font-normal text-zinc-400 tabular-nums shrink-0">
                  {formatDuration(song.duration)}
                </span>
              </div>
            );
          })}

          {/* Loading Skeleton below available queue songs when fetching recommendations */}
          {isRefilling && (
            <div className="space-y-1.5 pt-2 animate-in fade-in duration-200">
              <div className="flex items-center gap-2 px-1 text-[11px] font-semibold text-primary">
                <Sparkles size={12} className="animate-spin text-primary shrink-0" />
                <span>Finding recommended songs...</span>
              </div>
              {[1, 2, 3].map((idx) => (
                <div
                  key={`refill-skeleton-${idx}`}
                  className="flex items-center gap-2.5 rounded-lg border border-white/5 bg-white/3 p-2 animate-pulse"
                >
                  <div className="w-8 h-8 rounded bg-white/10 shrink-0" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="h-3 w-3/4 rounded bg-white/10" />
                    <div className="h-2.5 w-2/5 rounded bg-white/5" />
                  </div>
                  <div className="h-2.5 w-7 rounded bg-white/5 shrink-0" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
