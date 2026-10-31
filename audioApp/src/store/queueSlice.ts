import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { Song, QueueState, RepeatMode } from "@/types";
import { shuffleArray } from "@/utils/playerUtils";

const MAX_HISTORY = 2;

const initialState: QueueState = {
  queue: [],
  currentIndex: -1,
  shuffleOrder: null,
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

/**
 * Resolves the actual queue index from a logical index, taking shuffle into account.
 */
function resolveIndex(state: QueueState, logicalIndex: number): number {
  if (state.shuffleOrder && logicalIndex >= 0 && logicalIndex < state.shuffleOrder.length) {
    return state.shuffleOrder[logicalIndex];
  }
  return logicalIndex;
}

/**
 * Trims old history from the queue to prevent unbounded memory growth.
 * Keeps at most MAX_HISTORY items before the current index.
 */
function applyRollingTrim(state: QueueState): void {
  if (state.currentIndex <= MAX_HISTORY) return;

  const trimCount = state.currentIndex - MAX_HISTORY;
  state.queue = state.queue.slice(trimCount);
  state.currentIndex = state.currentIndex - trimCount;

  // Adjust shuffle order if active
  if (state.shuffleOrder) {
    state.shuffleOrder = state.shuffleOrder
      .map((idx) => idx - trimCount)
      .filter((idx) => idx >= 0);
  }
}

export const queueSlice = createSlice({
  name: "queue",
  initialState,
  reducers: {
    setQueue: (
      state,
      action: PayloadAction<{ queue: Song[]; index?: number }>,
    ) => {
      state.queue = action.payload.queue;
      state.currentIndex =
        action.payload.index !== undefined ? action.payload.index : 0;
      state.shuffleOrder = null;
    },
    addToQueue: (state, action: PayloadAction<Song | Song[]>) => {
      const items = Array.isArray(action.payload)
        ? action.payload
        : [action.payload];
      state.queue.push(...items);
    },
    playNextTrack: (state, action: PayloadAction<Song>) => {
      const insertIdx = Math.max(0, state.currentIndex + 1);
      state.queue.splice(insertIdx, 0, action.payload);
    },
    removeFromQueue: (state, action: PayloadAction<number>) => {
      const idx = action.payload;
      if (idx >= 0 && idx < state.queue.length) {
        state.queue.splice(idx, 1);
        if (state.currentIndex >= idx && state.currentIndex > 0) {
          state.currentIndex -= 1;
        }
      }
    },
    removeSongFromQueue: (state, action: PayloadAction<string>) => {
      const songId = action.payload;
      const idx = state.queue.findIndex(
        (s, i) => i > state.currentIndex && s.id === songId,
      );
      if (idx !== -1) {
        state.queue.splice(idx, 1);
      }
    },
    clearQueue: (state) => {
      state.queue = [];
      state.currentIndex = -1;
      state.shuffleOrder = null;
    },
    clearUpcomingQueue: (state) => {
      const keepCount = Math.max(0, state.currentIndex + 1);
      state.queue = state.queue.slice(0, keepCount);
    },
    setQueueIndex: (state, action: PayloadAction<number>) => {
      state.currentIndex = action.payload;
    },
    advanceToNextTrack: (state) => {
      if (state.queue.length === 0) return;
      if (state.currentIndex < state.queue.length - 1) {
        state.currentIndex += 1;
        applyRollingTrim(state);
      } else if (state.repeatMode === "all") {
        state.currentIndex = 0;
      }
    },
    retreatToPrevTrack: (state) => {
      if (state.queue.length === 0) return;
      if (state.currentIndex > 0) {
        state.currentIndex -= 1;
      }
    },
    toggleShuffle: (state) => {
      state.isShuffle = !state.isShuffle;
      if (state.isShuffle && state.queue.length > 1) {
        // Build a shuffle order that keeps the current song at position 0
        const indices = Array.from({ length: state.queue.length }, (_, i) => i);
        const currentOriginalIdx = state.currentIndex;
        const otherIndices = indices.filter((i) => i !== currentOriginalIdx);
        const shuffled = shuffleArray(otherIndices);
        state.shuffleOrder = [currentOriginalIdx, ...shuffled];
        state.currentIndex = 0;
      } else {
        // Unshuffle: restore the original position of the current song
        if (state.shuffleOrder && state.currentIndex < state.shuffleOrder.length) {
          const originalIdx = state.shuffleOrder[state.currentIndex];
          state.currentIndex = originalIdx;
        }
        state.shuffleOrder = null;
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

      if (fromIndex === state.currentIndex) {
        state.currentIndex = toIndex;
      } else if (
        fromIndex < state.currentIndex &&
        toIndex >= state.currentIndex
      ) {
        state.currentIndex -= 1;
      } else if (
        fromIndex > state.currentIndex &&
        toIndex <= state.currentIndex
      ) {
        state.currentIndex += 1;
      }
    },
  },
});

// Helper selector: get the current song from the queue respecting shuffle order
export function selectCurrentSongFromQueue(state: QueueState): Song | null {
  if (state.currentIndex < 0 || state.queue.length === 0) return null;
  const idx = resolveIndex(state, state.currentIndex);
  return state.queue[idx] || null;
}

// Helper selector: get upcoming songs (respecting shuffle order)
export function selectUpcomingSongs(state: QueueState, count = 5): Song[] {
  const result: Song[] = [];
  for (let i = 1; i <= count; i++) {
    const logicalIdx = state.currentIndex + i;
    if (logicalIdx >= state.queue.length) break;
    const idx = resolveIndex(state, logicalIdx);
    const song = state.queue[idx];
    if (song) result.push(song);
  }
  return result;
}

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
