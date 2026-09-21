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
      // Purge any legacy queue persistence from localStorage
      localStorage.removeItem("last_queue");
      localStorage.removeItem("last_queue_index");

      const savedRepeat = localStorage.getItem("audiomelody_repeat_mode") as
        | "none"
        | "all"
        | "one"
        | null;
      const savedShuffle = localStorage.getItem("audiomelody_shuffle");
      const savedRate = localStorage.getItem("audiomelody_playback_rate");
      const parsedRate = savedRate ? parseFloat(savedRate) : 1;

      const savedTime = localStorage.getItem("last_current_time");
      const parsedTime = savedTime ? parseFloat(savedTime) : 0;

      // Restore persisted current song
      let restoredSong: any = null;
      try {
        const savedSong = localStorage.getItem("last_current_song");
        if (savedSong) {
          const parsed = JSON.parse(savedSong);
          if (parsed && typeof parsed === "object" && typeof parsed.id === "string" && parsed.id) {
            restoredSong = parsed;
          }
        }
      } catch {
        // ignore
      }

      let savedDisliked: string[] = [];
      try {
        const raw = localStorage.getItem("audiomelody_disliked_songs");
        if (raw) savedDisliked = JSON.parse(raw);
      } catch {}

      playerStore.setState((s) => {
        const nextState: typeof s = {
          ...s,
          dislikedSongIds: Array.isArray(savedDisliked) ? savedDisliked : s.dislikedSongIds,
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
          playbackRate:
            !isNaN(parsedRate) && parsedRate > 0 ? parsedRate : s.playbackRate,
        };

        // If store has no currentSong yet but we have one persisted, restore it
        if (!s.currentSong && restoredSong) {
          nextState.currentSong = restoredSong;
          // Seed queue with the restored song if queue is empty
          if (s.queue.length === 0) {
            nextState.queue = [restoredSong];
            nextState.lastQueueIndex = 0;
          }
        }

        return nextState;
      });
    } catch (err) {
      console.error("[PlayerStore] Hydration failed:", err);
    }
  },

  // Alias for backward compatibility
  playSong: (song: any) => queueActions.playWithRadio(normalizePlayerSong(song)),
  playWithRadio: (song: any) => queueActions.playWithRadio(normalizePlayerSong(song)),
  playFromQueue: (index: number) => {
    const { queue } = playerStore.state;
    if (index >= 0 && index < queue.length) {
      playbackActions.play(queue[index]);
    }
  },
};
