"use client";

import { useStore } from "@tanstack/react-store";
import { ArrowDown, ArrowUp, ChevronDown, Play, Trash2 } from "lucide-react";
import { playerActions, playerStore } from "@/store/player.store";

interface PlayerQueuePanelProps {
  open: boolean;
  onClose: () => void;
}

export function PlayerQueuePanel({ open, onClose }: PlayerQueuePanelProps) {
  const queue = useStore(playerStore, (s) => s.queue);
  const currentIndex = useStore(playerStore, (s) => s.lastQueueIndex);
  const currentSong = useStore(playerStore, (s) => s.currentSong);

  if (!open) return null;

  const upcoming = queue.slice(Math.max(0, currentIndex + 1));

  return (
    <div className="fixed right-90 bottom-6 z-50 w-80 max-h-[70vh] bg-[#181818] border border-[#282828] rounded-xl shadow-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#282828] bg-[#181818]">
        <div>
          <h3 className="text-sm font-semibold text-white">
            Queue
          </h3>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-[#282828] transition-colors"
          title="Close queue"
        >
          <ChevronDown size={16} />
        </button>
      </div>

      <div className="px-4 py-3 space-y-3 overflow-y-auto no-scrollbar max-h-[calc(70vh-60px)]">
        {currentSong && (
          <div className="rounded-lg border border-[#282828] bg-[#282828] p-3">
            <p className="text-[11px] font-semibold text-primary mb-1">
              Now Playing
            </p>
            <p className="text-xs font-semibold text-white truncate">
              {currentSong.title}
            </p>
            <p className="text-[11px] text-zinc-400 truncate">
              {currentSong.artistName}
            </p>
          </div>
        )}

        {queue.length === 0 ? (
          <div className="py-8 text-center text-zinc-500 text-xs font-normal">
            Queue is empty
          </div>
        ) : upcoming.length === 0 ? (
          <div className="py-8 text-center text-zinc-500 text-xs font-normal">
            No upcoming tracks
          </div>
        ) : (
          <div className="space-y-2">
            {upcoming.map((song, offset) => {
              const index = currentIndex + 1 + offset;
              return (
                <div
                  key={song.queueId || `${song.id}-${index}`}
                  className="group flex items-center gap-3 rounded-2xl border border-white/5 bg-white/2 px-3 py-3 hover:bg-white/5 transition-colors"
                >
                  <button
                    onClick={() => playerActions.playQueueItem(index)}
                    className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 hover:bg-primary hover:text-black transition-colors"
                    title="Play this track"
                  >
                    <Play size={13} />
                  </button>

                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-black text-white truncate">
                      {song.title}
                    </p>
                    <p className="text-[10px] uppercase tracking-[0.15em] text-zinc-500 truncate">
                      {song.artistName}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    <button
                      disabled={index <= currentIndex + 1}
                      onClick={() => playerActions.moveQueueItem(index, index - 1)}
                      className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-zinc-500"
                      title="Move up"
                    >
                      <ArrowUp size={12} />
                    </button>
                    <button
                      disabled={index >= queue.length - 1}
                      onClick={() => playerActions.moveQueueItem(index, index + 1)}
                      className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-zinc-500"
                      title="Move down"
                    >
                      <ArrowDown size={12} />
                    </button>
                    <button
                      onClick={() => playerActions.removeFromQueue(index)}
                      className="p-2 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10"
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
  );
}
