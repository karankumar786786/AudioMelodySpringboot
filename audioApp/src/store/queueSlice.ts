import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { PlayerSong, QueueState, RepeatMode } from "@/types";
import { shuffleArray, applyRollingWindow } from "@/utils/playerUtils";

const initialState: QueueState = {
  queue: [],
  originalQueue: [],
  lastQueueIndex: -1,
  repeatMode: "none",
  isShuffle: false,
  dislikedSongIds: [],
  isRefilling: false,
  radioSession: {
    seedSongId: null,
    seedTitle: undefined,
    isActive: false,
    sessionHistoryIds: [],
    skippedSongIds: [],
  },
};

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
    playNextTrack: (state, action: PayloadAction<PlayerSong>) => {
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
    removeSongFromQueue: (state, action: PayloadAction<string>) => {
      const songId = action.payload;
      const idx = state.queue.findIndex(
        (s, i) => i > state.lastQueueIndex && s.id === songId,
      );
      if (idx !== -1) {
        const removedQueueId = state.queue[idx].queueId;
        state.queue.splice(idx, 1);
        state.originalQueue = state.originalQueue.filter(
          (s) => s.queueId !== removedQueueId,
        );
      }
    },
    clearQueue: (state) => {
      state.queue = [];
      state.originalQueue = [];
      state.lastQueueIndex = -1;
    },
    clearUpcomingQueue: (state) => {
      const keepCount = Math.max(0, state.lastQueueIndex + 1);
      state.queue = state.queue.slice(0, keepCount);
      state.originalQueue = state.originalQueue.slice(0, keepCount);
    },
    setQueueIndex: (state, action: PayloadAction<number>) => {
      state.lastQueueIndex = action.payload;
    },
    advanceToNextTrack: (state) => {
      if (state.queue.length === 0) return;
      if (state.lastQueueIndex < state.queue.length - 1) {
        state.lastQueueIndex += 1;
        // Trim rolling history so queue doesn't grow indefinitely in memory
        const { trimmedQueue, adjustedIndex } = applyRollingWindow(
          state.queue,
          state.lastQueueIndex,
          2,
        );
        state.queue = trimmedQueue;
        state.lastQueueIndex = adjustedIndex;
      } else if (state.repeatMode === "all") {
        state.lastQueueIndex = 0;
      }
    },
    retreatToPrevTrack: (state) => {
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
      const nextModes: Record<RepeatMode, RepeatMode> = {
        none: "all",
        all: "one",
        one: "none",
      };
      state.repeatMode = nextModes[state.repeatMode] || "none";
    },
    setRepeatMode: (state, action: PayloadAction<RepeatMode>) => {
      state.repeatMode = action.payload;
    },
    setIsRefilling: (state, action: PayloadAction<boolean>) => {
      state.isRefilling = action.payload;
    },
    startRadioSession: (
      state,
      action: PayloadAction<{ seedSongId: string; seedTitle?: string }>,
    ) => {
      state.radioSession = {
        seedSongId: action.payload.seedSongId,
        seedTitle: action.payload.seedTitle,
        isActive: true,
        sessionHistoryIds: [action.payload.seedSongId],
        skippedSongIds: [],
      };
    },
    endRadioSession: (state) => {
      state.radioSession = {
        seedSongId: null,
        seedTitle: undefined,
        isActive: false,
        sessionHistoryIds: [],
        skippedSongIds: [],
      };
    },
    reorderQueue: (
      state,
      action: PayloadAction<{ fromIndex: number; toIndex: number }>,
    ) => {
      const { fromIndex, toIndex } = action.payload;
      if (
        fromIndex < 0 ||
        fromIndex >= state.queue.length ||
        toIndex < 0 ||
        toIndex >= state.queue.length ||
        fromIndex === toIndex
      ) {
        return;
      }
      const [item] = state.queue.splice(fromIndex, 1);
      if (!item) return;
      state.queue.splice(toIndex, 0, item);

      if (fromIndex === state.lastQueueIndex) {
        state.lastQueueIndex = toIndex;
      } else if (
        fromIndex < state.lastQueueIndex &&
        toIndex >= state.lastQueueIndex
      ) {
        state.lastQueueIndex -= 1;
      } else if (
        fromIndex > state.lastQueueIndex &&
        toIndex <= state.lastQueueIndex
      ) {
        state.lastQueueIndex += 1;
      }
    },
  },
});

export const {
  setQueue,
  addToQueue,
  playNextTrack,
  removeFromQueue,
  removeSongFromQueue,
  clearQueue,
  clearUpcomingQueue,
  setQueueIndex,
  advanceToNextTrack,
  retreatToPrevTrack,
  toggleShuffle,
  toggleRepeat,
  setRepeatMode,
  setIsRefilling,
  startRadioSession,
  endRadioSession,
  reorderQueue,
} = queueSlice.actions;

export default queueSlice.reducer;
