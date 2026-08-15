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
      }
      return newState;
    });
  },

  setIsPlaying: (isPlaying: boolean) => {
    playerStore.setState((s) => ({ ...s, isPlaying }));
  },

  setCurrentTime: (time: number) => {
    playerStore.setState((s) => ({ ...s, currentTime: time }));
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
    playerStore.setState((s) => ({ ...s, isShuffle: !s.isShuffle }));
  },

  toggleRepeat: () => {
    playerStore.setState((s) => {
      const modes: ("none" | "one" | "all")[] = ["none", "all", "one"];
      const nextMode = modes[(modes.indexOf(s.repeatMode) + 1) % modes.length];
      return { ...s, repeatMode: nextMode };
    });
  },

  recordListen: async (songId: string, part: number) => {
    const { systemUser } = playerStore.state;
    if (systemUser?.id && songId) {
      try {
        await musicApi.interactions.recordListen(songId, part);
      } catch (err) {
        console.error("[PlayerStore] Failed to record listen:", err);
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
};
