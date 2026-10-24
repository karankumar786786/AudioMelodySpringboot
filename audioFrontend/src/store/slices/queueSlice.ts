import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { PlayerSong } from "@/lib/player-utils";

export interface RadioSession {
  seedSongId: string | null;
  seedTitle?: string;
  isActive: boolean;
  sessionHistoryIds: string[];
  skippedSongIds?: string[];
}

export interface QueueState {
  queue: PlayerSong[];
  originalQueue: PlayerSong[];
  lastQueueIndex: number;
  repeatMode: "none" | "one" | "all";
  isShuffle: boolean;
  dislikedSongIds: string[];
  radioSession: RadioSession;
  pendingSearchConfirmation: { songId: string } | null;
}

const getInitialRepeatMode = (): "none" | "one" | "all" => {
  if (typeof window === "undefined") return "none";
  const saved = localStorage.getItem("audiomelody_repeat_mode");
  return saved === "all" || saved === "one" ? saved : "none";
};

const getInitialShuffle = (): boolean => {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("audiomelody_shuffle") === "true";
};

const getInitialDisliked = (): string[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("audiomelody_disliked_songs");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const initialState: QueueState = {
  queue: [],
  originalQueue: [],
  lastQueueIndex: -1,
  repeatMode: getInitialRepeatMode(),
  isShuffle: getInitialShuffle(),
  dislikedSongIds: getInitialDisliked(),
  radioSession: {
    seedSongId: null,
    isActive: false,
    sessionHistoryIds: [],
    skippedSongIds: [],
  },
  pendingSearchConfirmation: null,
};

function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export const queueSlice = createSlice({
  name: "queue",
  initialState,
  reducers: {
    setQueue: (
      state,
      action: PayloadAction<{ queue: PlayerSong[]; index?: number }>,
    ) => {
      state.queue = action.payload.queue;
      state.originalQueue = action.payload.queue;
      state.lastQueueIndex =
        action.payload.index !== undefined ? action.payload.index : 0;
    },
    addToQueue: (state, action: PayloadAction<PlayerSong | PlayerSong[]>) => {
      const items = Array.isArray(action.payload)
        ? action.payload
        : [action.payload];
      state.queue.push(...items);
      state.originalQueue.push(...items);
    },
    playNext: (state, action: PayloadAction<PlayerSong>) => {
      const insertIdx = Math.max(0, state.lastQueueIndex + 1);
      state.queue.splice(insertIdx, 0, action.payload);
      state.originalQueue.splice(insertIdx, 0, action.payload);
    },
    removeFromQueue: (state, action: PayloadAction<number>) => {
      const idx = action.payload;
      if (idx >= 0 && idx < state.queue.length) {
        state.queue.splice(idx, 1);
        state.originalQueue.splice(idx, 1);
        if (state.lastQueueIndex >= idx && state.lastQueueIndex > 0) {
          state.lastQueueIndex -= 1;
        }
      }
    },
    clearQueue: (state) => {
      state.queue = [];
      state.originalQueue = [];
      state.lastQueueIndex = -1;
    },
    setQueueIndex: (state, action: PayloadAction<number>) => {
      state.lastQueueIndex = action.payload;
    },
    nextTrack: (state) => {
      if (state.queue.length === 0) return;
      if (state.lastQueueIndex < state.queue.length - 1) {
        state.lastQueueIndex += 1;
      } else if (state.repeatMode === "all") {
        state.lastQueueIndex = 0;
      }
    },
    prevTrack: (state) => {
      if (state.queue.length === 0) return;
      if (state.lastQueueIndex > 0) {
        state.lastQueueIndex -= 1;
      }
    },
    toggleShuffle: (state) => {
      state.isShuffle = !state.isShuffle;
      if (state.isShuffle && state.queue.length > 1) {
        const currentSong = state.queue[state.lastQueueIndex];
        const remaining = state.queue.filter(
          (_, i) => i !== state.lastQueueIndex,
        );
        const shuffled = shuffleArray(remaining);
        state.queue = currentSong ? [currentSong, ...shuffled] : shuffled;
        state.lastQueueIndex = currentSong ? 0 : -1;
      } else {
        const currentSong = state.queue[state.lastQueueIndex];
        state.queue = [...state.originalQueue];
        if (currentSong) {
          const originalIdx = state.queue.findIndex(
            (s) => s.id === currentSong.id,
          );
          state.lastQueueIndex = originalIdx !== -1 ? originalIdx : 0;
        }
      }
    },
    toggleRepeat: (state) => {
      const nextModes: Record<"none" | "all" | "one", "none" | "all" | "one"> =
        {
          none: "all",
          all: "one",
          one: "none",
        };
      state.repeatMode = nextModes[state.repeatMode] || "none";
    },
    setRepeatMode: (state, action: PayloadAction<"none" | "one" | "all">) => {
      state.repeatMode = action.payload;
    },
    toggleDislike: (state, action: PayloadAction<string>) => {
      const songId = action.payload;
      const idx = state.dislikedSongIds.indexOf(songId);
      if (idx !== -1) {
        state.dislikedSongIds.splice(idx, 1);
      } else {
        state.dislikedSongIds.push(songId);
      }
    },
    setRadioSession: (state, action: PayloadAction<RadioSession>) => {
      state.radioSession = action.payload;
    },
    setPendingSearchConfirmation: (
      state,
      action: PayloadAction<{ songId: string } | null>,
    ) => {
      state.pendingSearchConfirmation = action.payload;
    },
  },
});

export const {
  setQueue,
  addToQueue,
  playNext,
  removeFromQueue,
  clearQueue,
  setQueueIndex,
  nextTrack,
  prevTrack,
  toggleShuffle,
  toggleRepeat,
  setRepeatMode,
  toggleDislike,
  setRadioSession,
  setPendingSearchConfirmation,
} = queueSlice.actions;

export default queueSlice.reducer;
