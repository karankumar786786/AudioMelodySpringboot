"use client";

import { useEffect, useRef, useState } from "react";
import { useStore } from "@tanstack/react-store";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Play,
  Trash2,
  Music,
  GripVertical,
  History,
  ListPlus,
  RotateCw,
  RotateCcw,
} from "lucide-react";
import { playerActions, playerStore } from "@/store/player.store";
import { getImageUrl } from "@/lib/image-utils";
import { mapToPlayerSong } from "@/lib/player-utils";
import { musicApi, Song } from "@/lib/api";
import { toast } from "sonner";

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
  const queryClient = useQueryClient();
  const queue = useStore(playerStore, (s) => s.queue);
  const currentIndex = useStore(playerStore, (s) => s.lastQueueIndex);
  const currentSong = useStore(playerStore, (s) => s.currentSong);
  const systemUser = useStore(playerStore, (s) => s.systemUser);

  const [activeTab, setActiveTab] = useState<"queue" | "history">("queue");
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dismissedHistoryIds, setDismissedHistoryIds] = useState<Set<string>>(new Set());

  // Fetch Recently Played History
  const {
    data: recentHistoryData,
    isLoading: isHistoryLoading,
    refetch: refetchHistory,
    isRefetching: isHistoryRefetching,
  } = useQuery({
    queryKey: ["recent-history", systemUser?.id],
    queryFn: () => musicApi.users.getRecentlyPlayed(),
    enabled: open && activeTab === "history" && !!systemUser?.id,
  });

  const historySongs: Song[] = (recentHistoryData?.data?.data || [])
    .map((item: any) => item.song || item)
    .filter((s: any) => s?.id && !dismissedHistoryIds.has(String(s.id)));

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

  const handlePlayHistoryItem = (song: Song) => {
    playerActions.play(mapToPlayerSong(song));
    toast.success("Playing track", {
      description: `Now playing "${song.title}"`,
    });
  };

  const handleAddToQueue = (song: Song) => {
    playerActions.enqueue([mapToPlayerSong(song)]);
    setDismissedHistoryIds((prev) => {
      const next = new Set(prev);
      next.add(String(song.id));
      return next;
    });
    toast.success("Added to queue", {
      description: `"${song.title}" added to upcoming queue`,
    });
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      if (activeTab === "history") {
        setDismissedHistoryIds(new Set());
        await refetchHistory();
      } else {
        await playerActions.refillQueue(false, "Manual Refresh");
      }
      toast.success("Refreshed", {
        description: activeTab === "history" ? "Playback history updated" : "Queue refreshed",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div
      ref={panelRef}
      className="fixed right-4 md:right-80 bottom-24 z-50 w-[340px] sm:w-96 h-[500px] max-h-[80vh] bg-[#181818] border border-[#282828] rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-3 duration-200"
    >
      {/* Header with Segmented Tabs */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#282828] bg-[#181818] shrink-0">
        <div className="flex items-center gap-1 bg-[#222222] p-0.5 rounded-lg border border-white/5">
          <button
            type="button"
            onClick={() => setActiveTab("queue")}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "queue"
                ? "bg-primary text-black shadow-sm"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Queue ({upcoming.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "history"
                ? "bg-primary text-black shadow-sm"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <History size={12} />
            <span>History</span>
          </button>
        </div>

        <div className="flex items-center gap-1">
          {/* Refresh Button */}
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing || isHistoryRefetching}
            className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-50"
            title={activeTab === "history" ? "Refresh History" : "Refresh Queue"}
          >
            <RotateCw
              size={15}
              className={isRefreshing || isHistoryRefetching ? "animate-spin text-primary" : ""}
            />
          </button>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-[#282828] transition-colors cursor-pointer"
            title="Close panel"
          >
            <ChevronDown size={16} />
          </button>
        </div>
      </div>

      <div className="px-3 py-3 space-y-4 overflow-y-auto no-scrollbar flex-1">
        {activeTab === "queue" ? (
          <>
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
                Next Up ({upcoming.length})
              </h4>

              {queue.length === 0 || upcoming.length === 0 ? (
                <div className="py-12 text-center text-zinc-500 text-xs font-medium border border-dashed border-[#282828] rounded-lg space-y-1">
                  <Music size={20} className="mx-auto text-zinc-600" />
                  <p>No upcoming tracks in queue</p>
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

                        {/* Song Index & Play Button */}
                        <div className="relative w-8 h-8 rounded overflow-hidden bg-zinc-900 shrink-0 group/img">
                          {songImg ? (
                            <img
                              src={songImg}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-zinc-600">
                              <Music size={14} />
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => playerActions.playFromQueue(index)}
                            className="absolute inset-0 bg-black/60 opacity-0 group-hover/img:opacity-100 flex items-center justify-center text-white transition-opacity cursor-pointer"
                            title="Play now"
                          >
                            <Play size={12} fill="currentColor" />
                          </button>
                        </div>

                        {/* Title & Artist */}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-white truncate">
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
                            type="button"
                            disabled={offset === 0}
                            onClick={(e) => {
                              e.stopPropagation();
                              playerActions.moveQueueItem(index, index - 1);
                            }}
                            className="p-1 rounded text-zinc-400 hover:text-white hover:bg-[#282828] disabled:opacity-20 disabled:hover:bg-transparent cursor-pointer"
                            title="Move up"
                          >
                            <ArrowUp size={12} />
                          </button>
                          <button
                            type="button"
                            disabled={offset === upcoming.length - 1}
                            onClick={(e) => {
                              e.stopPropagation();
                              playerActions.moveQueueItem(index, index + 1);
                            }}
                            className="p-1 rounded text-zinc-400 hover:text-white hover:bg-[#282828] disabled:opacity-20 disabled:hover:bg-transparent cursor-pointer"
                            title="Move down"
                          >
                            <ArrowDown size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              playerActions.removeFromQueue(index);
                            }}
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
          </>
        ) : (
          /* Recently Played History Tab */
          <div className="space-y-2">
            <h4 className="text-[11px] font-bold text-zinc-400 tracking-wider uppercase px-1">
              Recently Played Tracks
            </h4>

            {isHistoryLoading ? (
              /* High-Quality Pulsing Skeleton Rows */
              <div className="space-y-2 py-1">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2.5 p-2 rounded-lg bg-white/5 animate-pulse"
                  >
                    <div className="w-9 h-9 rounded bg-zinc-800 shrink-0" />
                    <div className="flex-1 space-y-1.5 min-w-0">
                      <div className="h-3 w-3/4 bg-zinc-800 rounded" />
                      <div className="h-2.5 w-1/2 bg-zinc-800/60 rounded" />
                    </div>
                    <div className="w-8 h-3 bg-zinc-800 rounded" />
                  </div>
                ))}
              </div>
            ) : historySongs.length === 0 ? (
              <div className="py-12 text-center text-zinc-500 text-xs font-medium border border-dashed border-[#282828] rounded-lg space-y-1">
                <History size={20} className="mx-auto text-zinc-600" />
                <p>No recently played tracks found</p>
              </div>
            ) : (
              <div className="space-y-1">
                {historySongs.map((song, i) => {
                  const songImg = song.imageKey
                    ? getImageUrl(song.imageKey, {
                        width: 80,
                        height: 80,
                        aspectRatio: "1-1",
                      })
                    : "";

                  return (
                    <div
                      key={`history-${song.id}-${i}`}
                      className="group flex items-center gap-2.5 rounded-lg border border-transparent hover:bg-white/5 p-2 transition-colors select-none"
                    >
                      {/* Thumbnail */}
                      <div className="relative w-9 h-9 rounded overflow-hidden bg-zinc-900 shrink-0 group/img">
                        {songImg ? (
                          <img
                            src={songImg}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-zinc-600">
                            <Music size={14} />
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => handlePlayHistoryItem(song)}
                          className="absolute inset-0 bg-black/60 opacity-0 group-hover/img:opacity-100 flex items-center justify-center text-white transition-opacity cursor-pointer"
                          title="Play track"
                        >
                          <Play size={13} fill="currentColor" />
                        </button>
                      </div>

                      {/* Title & Artist */}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-white truncate">
                          {song.title}
                        </p>
                        <p className="text-[11px] text-zinc-400 truncate">
                          {song.artistName}
                        </p>
                      </div>

                      {/* Quick Actions */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleAddToQueue(song)}
                          className="p-1.5 rounded-md text-zinc-400 hover:text-primary hover:bg-white/10 transition-colors cursor-pointer"
                          title="Add to queue"
                        >
                          <ListPlus size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePlayHistoryItem(song)}
                          className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                          title="Play again"
                        >
                          <RotateCcw size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* Bottom Refresh / Load More */}
                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={handleRefresh}
                    className="text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer py-1 px-3 rounded-md hover:bg-white/5"
                  >
                    Refresh history
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
