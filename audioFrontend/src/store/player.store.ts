import { playerStore } from "./player/index";
import { queueActions } from "./player/queue.actions";
import { playbackActions } from "./player/playback.actions";
import { sessionActions } from "./player/session.actions";
import { normalizePlayerSong } from "@/lib/player-utils";

export { playerStore };

export const playerActions = {
  ...queueActions,
  ...playbackActions,
  ...sessionActions,

  // High-level combined actions if any
  hydrate: () => {
    if (typeof window === "undefined") return;
    try {
      const lastIdxStr = localStorage.getItem("last_queue_index");
      const lastQueueStr = localStorage.getItem("last_queue");
      const savedRepeat = localStorage.getItem("audiomelody_repeat_mode") as
        | "none"
        | "all"
        | "one"
        | null;
      const savedShuffle = localStorage.getItem("audiomelody_shuffle");

      const savedTime = localStorage.getItem("last_current_time");
      const parsedTime = savedTime ? parseFloat(savedTime) : 0;

      playerStore.setState((s) => {
        let queueRes = lastQueueStr ? JSON.parse(lastQueueStr) : s.queue;
        const savedIdx = lastIdxStr ? parseInt(lastIdxStr, 10) : -1;

        if (Array.isArray(queueRes)) {
          queueRes = queueRes.map((song: any) => normalizePlayerSong(song));
        }

        let currentSong = s.currentSong;
        let lastQueueIndex = s.lastQueueIndex;

        if (
          queueRes.length > 0 &&
          savedIdx >= 0 &&
          savedIdx < queueRes.length
        ) {
          currentSong = queueRes[savedIdx];
          lastQueueIndex = savedIdx;
        }

        return {
          ...s,
          currentSong,
          queue: queueRes,
          lastQueueIndex,
          currentTime:
            !isNaN(parsedTime) && parsedTime > 0 ? parsedTime : s.currentTime,
          repeatMode:
            savedRepeat === "none" ||
            savedRepeat === "all" ||
            savedRepeat === "one"
              ? savedRepeat
              : s.repeatMode,
          isShuffle:
            savedShuffle !== null ? savedShuffle === "true" : s.isShuffle,
        };
      });
    } catch (err) {
      console.error("[PlayerStore] Hydration failed:", err);
    }
  },

  // Alias for backward compatibility
  playSong: (song: any) => playbackActions.play(normalizePlayerSong(song)),
  playFromQueue: (index: number) => {
    const { queue } = playerStore.state;
    if (index >= 0 && index < queue.length) {
      playbackActions.play(queue[index]);
    }
  },
};
