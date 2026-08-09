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
    <div className="fixed right-90 bottom-6 z-80 w-90 max-h-[70vh] glass-effect-strong border border-white/10 rounded-4xl shadow-[0_30px_90px_rgba(0,0,0,0.65)] overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 bg-black/30 backdrop-blur-md">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 italic">
            Playback Queue
          </p>
          <h3 className="text-lg font-black italic uppercase tracking-tight text-white">
            Up Next
          </h3>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-xl text-zinc-500 hover:text-white hover:bg-white/5 transition-colors"
          title="Close queue"
        >
          <ChevronDown size={16} />
        </button>
      </div>

      <div className="px-5 py-4 space-y-4 overflow-y-auto custom-scrollbar max-h-[calc(70vh-74px)]">
        {currentSong && (
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-primary/70 mb-2">
              Now Playing
            </p>
            <p className="text-sm font-black text-white truncate">
              {currentSong.title}
            </p>
            <p className="text-[10px] uppercase tracking-[0.15em] text-zinc-500 truncate">
              {currentSong.artistName}
            </p>
          </div>
        )}

        {queue.length === 0 ? (
          <div className="py-10 text-center text-zinc-500 text-xs font-bold italic uppercase tracking-widest">
            Queue is empty
          </div>
        ) : upcoming.length === 0 ? (
          <div className="py-10 text-center text-zinc-500 text-xs font-bold italic uppercase tracking-widest">
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
