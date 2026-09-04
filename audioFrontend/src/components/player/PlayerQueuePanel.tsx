"use client";

import { useEffect, useRef, useState } from "react";
import { useStore } from "@tanstack/react-store";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Play,
  Trash2,
  Music,
  GripVertical,
} from "lucide-react";
import { playerActions, playerStore } from "@/store/player.store";
import { getImageUrl } from "@/lib/image-utils";

interface PlayerQueuePanelProps {
  open: boolean;
  onClose: () => void;
}

function formatDuration(num?: number) {
  if (!num || isNaN(num)) return "0:00";
  const sec = num > 10000 ? Math.floor(num / 1000) : Math.floor(num);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function PlayerQueuePanel({ open, onClose }: PlayerQueuePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const queue = useStore(playerStore, (s) => s.queue);
  const currentIndex = useStore(playerStore, (s) => s.lastQueueIndex);
  const currentSong = useStore(playerStore, (s) => s.currentSong);

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (e: PointerEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        const isQueueToggle = (e.target as Element)?.closest?.(
          "[data-queue-toggle]",
        );
        if (!isQueueToggle) {
          onClose();
        }
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const upcoming = queue.slice(Math.max(0, currentIndex + 1));

  const nowPlayingImage = currentSong?.imageKey
    ? getImageUrl(currentSong.imageKey, {
        width: 90,
        height: 90,
        aspectRatio: "1-1",
      })
    : currentSong?.posterUrl || "";

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
    <div
      ref={panelRef}
      className="fixed right-4 md:right-80 bottom-24 z-50 w-[340px] sm:w-96 max-h-[75vh] bg-[#181818] border border-[#282828] rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-3 duration-200"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#282828] bg-[#181818] shrink-0">
        <div>
          <h3 className="text-sm font-bold text-white tracking-tight">
            Play Queue
          </h3>
          <p className="text-[11px] text-zinc-400 font-medium">
            {upcoming.length} {upcoming.length === 1 ? "track" : "tracks"}{" "}
            upcoming
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-[#282828] transition-colors cursor-pointer"
          title="Close queue"
        >
          <ChevronDown size={16} />
        </button>
      </div>

      <div className="px-3 py-3 space-y-4 overflow-y-auto no-scrollbar flex-1">
        {/* Now Playing Section */}
        {currentSong && (
          <div className="space-y-1.5">
            <h4 className="text-[11px] font-bold text-primary tracking-wider uppercase px-1">
              Now Playing
            </h4>
            <div className="flex items-center gap-3 rounded-lg border border-[#282828] bg-[#222222] p-2.5">
              <div className="w-11 h-11 rounded-md overflow-hidden bg-zinc-900 shrink-0">
                {nowPlayingImage ? (
                  <img
                    src={nowPlayingImage}
                    alt={currentSong.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-600">
                    <Music size={18} />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-white truncate">
                  {currentSong.title}
                </p>
                <p className="text-[11px] text-zinc-400 truncate">
                  {currentSong.artistName}
                </p>
              </div>
              <span className="text-[11px] font-medium text-zinc-400 tabular-nums shrink-0 pr-1">
                {formatDuration(currentSong.duration)}
              </span>
            </div>
          </div>
        )}

        {/* Upcoming Section */}
        <div className="space-y-1.5">
          <h4 className="text-[11px] font-bold text-zinc-400 tracking-wider uppercase px-1">
            Next Up
          </h4>

          {queue.length === 0 || upcoming.length === 0 ? (
            <div className="py-8 text-center text-zinc-500 text-xs font-medium border border-dashed border-[#282828] rounded-lg">
              No upcoming tracks in queue
            </div>
          ) : (
            <div className="space-y-1">
              {upcoming.map((song, offset) => {
                const index = currentIndex + 1 + offset;
                const songImg = song.imageKey
                  ? getImageUrl(song.imageKey, {
                      width: 80,
                      height: 80,
                      aspectRatio: "1-1",
                    })
                  : song.posterUrl || "";

                const isDraggingThis = draggedIndex === index;
                const isOverThis = dragOverIndex === index;

                return (
                  <div
                    key={song.queueId || `${song.id}-${index}`}
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
                      className="cursor-grab active:cursor-grabbing text-zinc-600 group-hover:text-zinc-400 transition-colors shrink-0"
                      title="Drag to reorder"
                    >
                      <GripVertical size={14} />
                    </div>

                    {/* Song Thumbnail with Play Action */}
                    <div
                      onClick={() => playerActions.playQueueItem(index)}
                      className="relative w-10 h-10 rounded-md overflow-hidden bg-zinc-900 shrink-0 cursor-pointer group/thumb"
                    >
                      {songImg ? (
                        <img
                          src={songImg}
                          alt={song.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-600">
                          <Music size={16} />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center transition-opacity">
                        <Play
                          size={14}
                          fill="white"
                          className="text-white ml-0.5"
                        />
                      </div>
                    </div>

                    {/* Song Details */}
                    <div className="min-w-0 flex-1">
                      <p
                        onClick={() => playerActions.playQueueItem(index)}
                        className="text-xs font-bold text-white truncate cursor-pointer hover:underline"
                      >
                        {song.title}
                      </p>
                      <p className="text-[11px] text-zinc-400 truncate">
                        {song.artistName}
                      </p>
                    </div>

                    {/* Duration */}
                    <span className="text-[11px] font-normal text-zinc-400 tabular-nums shrink-0">
                      {formatDuration(song.duration)}
                    </span>

                    {/* Queue Actions */}
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        disabled={index <= currentIndex + 1}
                        onClick={() =>
                          playerActions.moveQueueItem(index, index - 1)
                        }
                        className="p-1 rounded text-zinc-400 hover:text-white hover:bg-[#282828] disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                        title="Move up"
                      >
                        <ArrowUp size={12} />
                      </button>
                      <button
                        disabled={index >= queue.length - 1}
                        onClick={() =>
                          playerActions.moveQueueItem(index, index + 1)
                        }
                        className="p-1 rounded text-zinc-400 hover:text-white hover:bg-[#282828] disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                        title="Move down"
                      >
                        <ArrowDown size={12} />
                      </button>
                      <button
                        onClick={() => playerActions.removeFromQueue(index)}
                        className="p-1 rounded text-zinc-400 hover:text-red-400 hover:bg-red-500/10 cursor-pointer"
                        title="Remove from queue"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
