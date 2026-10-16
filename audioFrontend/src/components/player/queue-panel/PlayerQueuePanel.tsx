"use client";

import { useEffect, useRef, useState } from "react";
import { useStore } from "@tanstack/react-store";
import { useQuery } from "@tanstack/react-query";
import { playerActions, playerStore } from "@/store/player.store";
import { mapToPlayerSong } from "@/lib/player-utils";
import { musicApi, type Song } from "@/lib/api";
import { previewPlayer } from "@/lib/preview-player";
import { toast } from "sonner";
import type { PlayerQueuePanelProps } from "./types";
import { QueuePanelHeader } from "./QueuePanelHeader";
import { NowPlayingCard } from "./NowPlayingCard";
import { UpcomingQueueList } from "./UpcomingQueueList";
import { PlaybackHistoryList } from "./PlaybackHistoryList";

export function PlayerQueuePanel({ open, onClose }: PlayerQueuePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const queue = useStore(playerStore, (s) => s.queue);
  const currentIndex = useStore(playerStore, (s) => s.lastQueueIndex);
  const currentSong = useStore(playerStore, (s) => s.currentSong);
  const systemUser = useStore(playerStore, (s) => s.systemUser);
  const isRefilling = useStore(playerStore, (s) => s.isRefilling);

  const [activeTab, setActiveTab] = useState<"queue" | "history">("queue");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dismissedHistoryIds, setDismissedHistoryIds] = useState<Set<string>>(
    new Set(),
  );

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

  const handlePlayHistoryItem = (song: Song) => {
    previewPlayer.stopPreview(true);
    playerActions.playWithRadio(mapToPlayerSong(song));
    toast.success("Playing track radio", {
      description: `Now playing "${song.title}" with infinite radio`,
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
        description:
          activeTab === "history"
            ? "Playback history updated"
            : "Queue refreshed",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div
      ref={panelRef}
      className="fixed right-4 md:right-80 bottom-24 z-50 w-85 sm:w-96 h-125 max-h-[80vh] bg-[#181818] border border-[#282828] rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-3 duration-200"
    >
      {/* Header with Segmented Tabs */}
      <QueuePanelHeader
        activeTab={activeTab}
        onTabChange={setActiveTab}
        upcomingCount={upcoming.length}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing || isHistoryRefetching}
        onClose={onClose}
      />

      <div className="px-3 py-3 space-y-4 overflow-y-auto no-scrollbar flex-1">
        {activeTab === "queue" ? (
          <>
            {currentSong && <NowPlayingCard currentSong={currentSong} />}

            <UpcomingQueueList
              upcoming={upcoming}
              currentIndex={currentIndex}
              queueLength={queue.length}
              isRefilling={isRefilling}
            />
          </>
        ) : (
          <PlaybackHistoryList
            isHistoryLoading={isHistoryLoading}
            historySongs={historySongs}
            onPlayHistoryItem={handlePlayHistoryItem}
            onAddToQueue={handleAddToQueue}
            onRefresh={handleRefresh}
          />
        )}
      </div>
    </div>
  );
}
