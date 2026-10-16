"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { History, Play, Pause, Clock, Loader2, Music2, ChevronLeft, ChevronRight } from "lucide-react";
import { musicApi } from "@/lib/api";
import { SongThumbnail } from "@/components/SongThumbnail";
import { HeartButton } from "@/components/HeartButton";
import { playerActions, playerStore } from "@/store/player.store";
import { useStore } from "@tanstack/react-store";
import { mapToPlayerSong } from "@/lib/player-utils";

function formatDuration(seconds?: number): string {
  if (!seconds || isNaN(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatRelativeTime(dateStr?: string): string {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export default function HistoryPage() {
  const [mounted, setMounted] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const systemUser = useStore(playerStore, (s) => s.systemUser);
  const currentSong = useStore(playerStore, (s) => s.currentSong);
  const isPlaying = useStore(playerStore, (s) => s.isPlaying);
  const favourites = useStore(playerStore, (s) => s.favourites);

  useEffect(() => {
    setMounted(true);
  }, []);

  const {
    data: historyResponse,
    isLoading,
    isPlaceholderData,
  } = useQuery({
    queryKey: ["user-listening-history", systemUser?.id, page],
    queryFn: () => musicApi.users.getListeningHistory(page, pageSize),
    enabled: !!systemUser?.id && mounted,
    placeholderData: (prev) => prev,
  });

  if (!mounted) return null;

  const items = historyResponse?.data?.data || [];
  const pagination = historyResponse?.data?.pagination;
  const totalItems = pagination?.total || 0;
  const totalPages = pagination ? Math.ceil(totalItems / pageSize) || 1 : 1;

  const handlePlaySong = (item: any) => {
    const isThisPlaying = currentSong?.id === item.id;
    if (isThisPlaying) {
      playerActions.setIsPlaying(!isPlaying);
    } else {
      playerActions.playSong(mapToPlayerSong(item));
    }
  };

  return (
    <div className="px-4 sm:px-6 md:px-8 xl:px-10 pb-28 bg-black pt-(--app-content-pt,5rem) space-y-8 min-h-screen">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#282828] pb-6"
      >
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-400 border border-purple-500/20 shadow-md">
            <History size={24} />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Listening History
            </h1>
            <p className="text-xs text-zinc-400 mt-1">
              Your recently played tracks and listening activity across all devices
            </p>
          </div>
        </div>

        {totalItems > 0 && (
          <div className="text-xs font-semibold text-zinc-500 bg-zinc-900/60 px-3 py-1.5 rounded-full border border-zinc-800 self-start sm:self-auto">
            {totalItems.toLocaleString()} total streams
          </div>
        )}
      </motion.div>

      {/* Content */}
      {!systemUser ? (
        <div className="p-12 text-center bg-zinc-900/30 rounded-2xl border border-dashed border-[#282828]">
          <History size={36} className="mx-auto text-zinc-600 mb-3" />
          <h3 className="text-base font-bold text-white">Sign In to View History</h3>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto mt-1 mb-4">
            Sign in to your Melody account to keep track of every song you play across your devices.
          </p>
          <button
            type="button"
            onClick={() => playerActions.openAuthModal()}
            className="px-5 py-2.5 rounded-xl bg-white text-black text-xs font-bold hover:bg-white/90 transition-all cursor-pointer shadow-lg"
          >
            Sign In Now
          </button>
        </div>
      ) : isLoading && !items.length ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-16 rounded-xl bg-zinc-900/40 border border-[#282828] animate-pulse"
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="p-12 text-center bg-zinc-900/30 rounded-2xl border border-dashed border-[#282828]">
          <Music2 size={36} className="mx-auto text-zinc-600 mb-3" />
          <h3 className="text-base font-bold text-white">No Listening History Yet</h3>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto mt-1">
            Start playing tracks from your favorite albums and playlists to build your stream log!
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-[#282828] bg-[#121212]/80 backdrop-blur-md overflow-hidden shadow-xl">
            {/* Table Header */}
            <div className="grid grid-cols-[auto_1fr_auto] sm:grid-cols-[auto_1fr_auto_auto] md:grid-cols-[auto_1fr_120px_100px_80px] items-center gap-4 px-4 py-3 border-b border-[#222222] text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
              <span className="w-8 text-center">#</span>
              <span>Title</span>
              <span className="hidden md:block text-right">Played</span>
              <span className="hidden sm:block text-right">Streams</span>
              <span className="text-right flex items-center justify-end gap-1">
                <Clock size={12} />
              </span>
            </div>

            {/* Rows */}
            <div className="divide-y divide-[#1e1e1e]">
              {items.map((item: any, idx: number) => {
                const isThisPlaying = currentSong?.id === item.id && isPlaying;
                const rowNumber = (page - 1) * pageSize + idx + 1;

                return (
                  <motion.div
                    key={item.historyId || `${item.id}-${idx}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2 }}
                    className="group grid grid-cols-[auto_1fr_auto] sm:grid-cols-[auto_1fr_auto_auto] md:grid-cols-[auto_1fr_120px_100px_80px] items-center gap-4 px-4 py-3 hover:bg-white/4 transition-colors"
                  >
                    {/* Index / Play button */}
                    <div className="w-8 flex items-center justify-center">
                      <button
                        type="button"
                        onClick={() => handlePlaySong(item)}
                        className="opacity-0 group-hover:opacity-100  p-1.5 rounded-full bg-white text-black hover:scale-105 transition-transform cursor-pointer"
                        title={isThisPlaying ? "Pause" : "Play"}
                      >
                        {isThisPlaying ? (
                          <Pause size={12} className="fill-black" />
                        ) : (
                          <Play size={12} className="fill-black translate-x-0.5" />
                        )}
                      </button>
                      <span className="group-hover:hidden text-xs font-mono font-medium text-zinc-500">
                        {rowNumber}
                      </span>
                    </div>

                    {/* Title & Artist Thumbnail */}
                    <div className="flex items-center gap-3 min-w-0">
                      <SongThumbnail
                        song={item}
                        sizeClass="w-10 h-10"
                        roundedClass="rounded-lg"
                        enablePreviewHover
                      />
                      <div className="min-w-0 flex-1">
                        <p
                          onClick={() => handlePlaySong(item)}
                          className={`text-sm font-bold truncate cursor-pointer transition-colors ${
                            isThisPlaying ? "text-primary" : "text-white group-hover:text-primary"
                          }`}
                        >
                          {item.title}
                        </p>
                        <p className="text-xs text-zinc-400 truncate mt-0.5">
                          {item.artistName || "Unknown Artist"}
                        </p>
                      </div>
                    </div>

                    {/* Listened At (Relative) */}
                    <div className="hidden md:block text-right text-xs text-zinc-400 font-medium">
                      {formatRelativeTime(item.listenedAt)}
                    </div>

                    {/* Streams */}
                    <div className="hidden sm:block text-right text-xs font-mono text-zinc-500">
                      {typeof item.totalStreams === "number"
                        ? `${item.totalStreams.toLocaleString()}`
                        : "—"}
                    </div>

                    {/* Duration & Like */}
                    <div className="flex items-center justify-end gap-3 text-right text-xs font-mono text-zinc-400">
                      <HeartButton
                        isFavourite={favourites.has(String(item.id))}
                        onToggle={async () => {
                          await playerActions.toggleFavourite(String(item.id));
                        }}
                        size={15}
                      />
                      <span>{formatDuration(item.duration)}</span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-zinc-500">
                Page {page} of {totalPages}
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#282828] bg-zinc-900/60 text-xs font-semibold text-zinc-300 hover:text-white hover:bg-zinc-800 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
                >
                  <ChevronLeft size={14} />
                  <span>Previous</span>
                </button>

                <button
                  type="button"
                  disabled={page >= totalPages || isPlaceholderData}
                  onClick={() => setPage((p) => p + 1)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#282828] bg-zinc-900/60 text-xs font-semibold text-zinc-300 hover:text-white hover:bg-zinc-800 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
                >
                  <span>Next</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
