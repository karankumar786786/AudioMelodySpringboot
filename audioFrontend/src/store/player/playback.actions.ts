import { playerStore } from "./index";
import { type PlayerSong } from "@/lib/player-utils";
import { musicApi } from "@/lib/api";
import { toast } from "sonner";

export const playbackActions = {
  play: (song: PlayerSong) => {
    if (!playerStore.state.systemUser) {
      toast.error("Authentication required", {
        description: "Please sign in to play audio tracks.",
      });
      playerStore.setState((s) => ({ ...s, isAuthModalOpen: true }));
      return;
    }
    playerStore.setState((s) => {
      let updatedQueue = [...s.queue];
      // Match by queueId first (the exact instance), then fallback to song id
      let idx = updatedQueue.findIndex((item) => item.queueId === song.queueId);
      if (idx === -1) {
        // Look for the song ahead first
        idx = updatedQueue.findIndex(
          (item, i) => i >= s.lastQueueIndex && item.id === song.id,
        );
        if (idx === -1)
          idx = updatedQueue.findIndex((item) => item.id === song.id);
      }

      if (idx === -1) {
        // Insert after the current play position if missing
        const insertIdx = Math.max(0, s.lastQueueIndex + 1);
        updatedQueue.splice(insertIdx, 0, song);
        idx = insertIdx;
        console.log(
          `[Playback] song NOT in queue. INSERTED "${song.title}" at index ${idx}. QueueID: ${song.queueId}`,
        );
      } else {
        console.log(
          `[Playback] song found in queue. JUMPING to "${song.title}" at index ${idx}. QueueID: ${song.queueId}`,
        );
      }

      console.log(
        `[Queue State] Current Index: ${idx}, Total Songs: ${updatedQueue.length}`,
      );

      const newState = {
        ...s,
        queue: updatedQueue,
        currentSong: song,
        isPlaying: true,
        lastQueueIndex: idx,
        currentTime: 0,
      };

      if (typeof window !== "undefined") {
        // We still save the queue, but the current song can be derived from lastQueueIndex
        localStorage.setItem("last_queue", JSON.stringify(updatedQueue));
        localStorage.setItem("last_queue_index", idx.toString());
        localStorage.setItem("last_current_time", "0");
      }
      return newState;
    });
  },

  setIsPlaying: (isPlaying: boolean) => {
    console.log("[PlaybackActions] setIsPlaying ->", isPlaying);
    playerStore.setState((s) => ({ ...s, isPlaying }));
  },

  setIsVideoActive: (isVideoActive: boolean) => {
    console.log("[PlaybackActions] setIsVideoActive ->", isVideoActive);
    playerStore.setState((s) => ({ ...s, isVideoActive }));
  },

  setCurrentTime: (time: number) => {
    playerStore.setState((s) => ({ ...s, currentTime: time }));
  },

  seek: (time: number) => {
    const validTime = Math.max(0, isNaN(time) ? 0 : time);
    playerStore.setState((s) => ({
      ...s,
      currentTime: validTime,
      seekTarget: validTime,
    }));
    if (typeof window !== "undefined") {
      localStorage.setItem("last_current_time", validTime.toFixed(2));
    }
  },

  setDuration: (duration: number) => {
    playerStore.setState((s) => ({ ...s, duration }));
  },

  setVolume: (v: number) => {
    playerStore.setState((s) => ({ ...s, volume: v, isMuted: v === 0 }));
  },

  setIsMuted: (isMuted: boolean) => {
    playerStore.setState((s) => ({ ...s, isMuted }));
  },

  setQualityTracks: (tracks: any[]) => {
    playerStore.setState((s) => ({ ...s, qualityTracks: tracks }));
  },

  setSelectedQuality: (quality: "auto" | number) => {
    playerStore.setState((s) => ({ ...s, selectedQuality: quality }));
  },

  toggleShuffle: () => {
    playerStore.setState((s) => {
      const nextShuffle = !s.isShuffle;

      if (nextShuffle) {
        // Turning Shuffle ON
        if (s.queue.length <= 1) {
          return { ...s, isShuffle: true, originalQueue: [...s.queue] };
        }

        const currentIdx = Math.max(0, s.lastQueueIndex);
        const originalQueue =
          s.originalQueue && s.originalQueue.length > 0
            ? s.originalQueue
            : [...s.queue];

        const played = s.queue.slice(0, currentIdx + 1);
        const upcoming = s.queue.slice(currentIdx + 1);

        // Fisher-Yates shuffle the upcoming songs
        const shuffledUpcoming = [...upcoming];
        for (let i = shuffledUpcoming.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffledUpcoming[i], shuffledUpcoming[j]] = [
            shuffledUpcoming[j],
            shuffledUpcoming[i],
          ];
        }

        const newQueue = [...played, ...shuffledUpcoming];
        if (typeof window !== "undefined") {
          localStorage.setItem("last_queue", JSON.stringify(newQueue));
          localStorage.setItem("last_queue_index", currentIdx.toString());
          localStorage.setItem("audiomelody_shuffle", "true");
        }

        return {
          ...s,
          isShuffle: true,
          originalQueue,
          queue: newQueue,
        };
      } else {
        // Turning Shuffle OFF: Restore original playlist/album queue order
        const originalQueue =
          s.originalQueue && s.originalQueue.length > 0
            ? s.originalQueue
            : s.queue;
        const currentSong = s.currentSong;

        let newIdx = 0;
        if (currentSong) {
          newIdx = originalQueue.findIndex(
            (item) =>
              item.queueId === currentSong.queueId || item.id === currentSong.id,
          );
          if (newIdx === -1) {
            newIdx = Math.min(Math.max(0, s.lastQueueIndex), originalQueue.length - 1);
          }
        }

        if (typeof window !== "undefined") {
          localStorage.setItem("last_queue", JSON.stringify(originalQueue));
          localStorage.setItem("last_queue_index", newIdx.toString());
          localStorage.setItem("audiomelody_shuffle", "false");
        }

        return {
          ...s,
          isShuffle: false,
          queue: originalQueue,
          originalQueue: [],
          lastQueueIndex: newIdx,
        };
      }
    });
  },

  toggleRepeat: () => {
    playerStore.setState((s) => {
      const modes: ("none" | "all" | "one")[] = ["none", "all", "one"];
      const nextMode = modes[(modes.indexOf(s.repeatMode) + 1) % modes.length];
      if (typeof window !== "undefined") {
        localStorage.setItem("audiomelody_repeat_mode", nextMode);
      }
      return { ...s, repeatMode: nextMode };
    });
  },

  recordListen: async (songId: string, part: number) => {
    const { systemUser } = playerStore.state;
    if (systemUser?.id && songId) {
      try {
        await musicApi.interactions.recordListen(songId, part);
      } catch {
        // Ignored unmount / offline telemetry drop
      }
    }
  },

  recordSkip: async (songId: string) => {
    const { systemUser } = playerStore.state;
    if (systemUser?.id && songId) {
      try {
        await musicApi.interactions.recordSkip(songId);
      } catch {
        // Ignored unmount / offline telemetry drop
      }
    }
  },

  setIsLyricsOpen: (isLyricsOpen: boolean) => {
    playerStore.setState((s) => ({ ...s, isLyricsOpen }));
  },

  toggleLyrics: () => {
    playerStore.setState((s) => ({ ...s, isLyricsOpen: !s.isLyricsOpen }));
  },

  closeLyrics: () => {
    playerStore.setState((s) => (s.isLyricsOpen ? { ...s, isLyricsOpen: false } : s));
  },

  setSleepTimer: (
    minutes: number | null,
    mode: "minutes" | "end_of_track" = "minutes",
  ) => {
    if (minutes === null && mode === "minutes") {
      playerStore.setState((s) => ({
        ...s,
        sleepTimer: { targetTimestamp: null, mode: null },
      }));
      toast.success("Sleep timer turned off");
      return;
    }

    if (mode === "end_of_track") {
      playerStore.setState((s) => ({
        ...s,
        sleepTimer: { targetTimestamp: null, mode: "end_of_track" },
      }));
      toast.success("Sleep timer set to end of current track");
      return;
    }

    if (typeof minutes === "number" && minutes > 0) {
      const targetTimestamp = Date.now() + minutes * 60 * 1000;
      playerStore.setState((s) => ({
        ...s,
        sleepTimer: {
          targetTimestamp,
          mode: "minutes",
          durationMinutes: minutes,
        },
      }));
      toast.success(`Sleep timer set for ${minutes} min`);
    }
  },

  clearSleepTimer: () => {
    playerStore.setState((s) => ({
      ...s,
      sleepTimer: { targetTimestamp: null, mode: null },
    }));
  },
};
