"use client";

import React from "react";
import { History, ListPlus, RotateCcw } from "lucide-react";
import { SongThumbnail } from "@/components/SongThumbnail";
import type { Song } from "@/lib/api/types";

interface PlaybackHistoryListProps {
  isHistoryLoading: boolean;
  historySongs: Song[];
  onPlayHistoryItem: (song: Song) => void;
  onAddToQueue: (song: Song) => void;
  onRefresh: () => void;
}

export const PlaybackHistoryList: React.FC<PlaybackHistoryListProps> = ({
  isHistoryLoading,
  historySongs,
  onPlayHistoryItem,
  onAddToQueue,
  onRefresh,
}) => {
  return (
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
          {historySongs.map((song, i) => (
            <div
              key={`history-${song.id}-${i}`}
              className="group flex items-center gap-2.5 rounded-lg border border-transparent hover:bg-white/5 p-2 transition-colors select-none"
            >
              {/* Thumbnail with Hover Preview */}
              <SongThumbnail
                song={song}
                sizeClass="w-9 h-9"
                roundedClass="rounded"
                onPlayClick={() => onPlayHistoryItem(song)}
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

              {/* Quick Actions */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onAddToQueue(song)}
                  className="p-1.5 rounded-md text-zinc-400 hover:text-primary hover:bg-white/10 transition-colors cursor-pointer"
                  title="Add to queue"
                >
                  <ListPlus size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => onPlayHistoryItem(song)}
                  className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  title="Play again"
                >
                  <RotateCcw size={13} />
                </button>
              </div>
            </div>
          ))}

          {/* Bottom Refresh */}
          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={onRefresh}
              className="text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer py-1 px-3 rounded-md hover:bg-white/5"
            >
              Refresh history
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
