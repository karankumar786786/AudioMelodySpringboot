import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { Song, QueueState, RepeatMode } from "@/types";
import { shuffleArray } from "@/utils/playerUtils";

const initialState: QueueState = {
  queue: [],
  currentIndex: -1,
  shuffleOrder: null,
  repeatMode: "none",
  isShuffle: false,
  dislikedSongIds: [],
  isRefilling: false,
  isLoading: false,
  radioSession: {
    seedSongId: null,
    seedTitle: undefined,
    isActive: false,
    sessionHistoryIds: [],
    skippedSongIds: [],
  },
};

/**
 * Design note: `currentIndex` is ALWAYS a physical index into `queue`, and `queue`
 * order is exactly the order the native playlist plays. Shuffle physically
 * reorders the songs after the current one, so Redux and the native player can
 * never disagree. `shuffleOrder` is kept in the state type but is always null.
 */

export const queueSlice = createSlice({
  name: "queue",
  initialState,
  reducers: {
    setQueue: (
      state,
      action: PayloadAction<{ queue: Song[]; index?: number }>,
    ) => {
      const q = action.payload.queue;
      state.queue = q;
      const idx = action.payload.index !== undefined ? action.payload.index : 0;
      state.currentIndex = q.length === 0 ? -1 : Math.min(Math.max(0, idx), q.length - 1);
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
      if (state.currentIndex < 0) state.currentIndex = 0;
    },
    removeFromQueue: (state, action: PayloadAction<number>) => {
      const idx = action.payload;
      if (idx < 0 || idx >= state.queue.length) return;
      state.queue.splice(idx, 1);
      if (state.queue.length === 0) {
        state.currentIndex = -1;
      } else if (idx < state.currentIndex) {
        state.currentIndex -= 1;
      } else if (idx === state.currentIndex) {
        // Removed the playing song: the next song slides into this slot.
        state.currentIndex = Math.min(state.currentIndex, state.queue.length - 1);
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
      state.shuffleOrder = null;
      // Shuffle only the songs AFTER the current one; history and the current
      // song keep their positions. Turning shuffle off keeps the current order.
      if (state.isShuffle && state.currentIndex >= 0) {
        const head = state.queue.slice(0, state.currentIndex + 1);
        const tail = state.queue.slice(state.currentIndex + 1);
        if (tail.length > 1) {
          state.queue = [...head, ...shuffleArray(tail)];
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
    setIsLoadingQueue: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    startRadioSession: (
      state,
      action: PayloadAction<{ seedSongId: string; seedTitle?: string; seedSong?: Song }>,
    ) => {
      state.radioSession = {
        seedSongId: action.payload.seedSongId,
        seedTitle: action.payload.seedTitle,
        seedSong: action.payload.seedSong,
        isActive: true,
        sessionHistoryIds: [action.payload.seedSongId],
        skippedSongIds: [],
      };
    },
    endRadioSession: (state) => {
      state.radioSession = {
        seedSongId: null,
        seedTitle: undefined,
        seedSong: undefined,
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

// Helper selector: get the current song from the queue
export function selectCurrentSongFromQueue(state: QueueState): Song | null {
  if (state.currentIndex < 0 || state.queue.length === 0) return null;
  return state.queue[state.currentIndex] || null;
}

// Helper selector: get upcoming songs
export function selectUpcomingSongs(state: QueueState, count = 5): Song[] {
  if (state.currentIndex < 0) return [];
  return state.queue.slice(state.currentIndex + 1, state.currentIndex + 1 + count);
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
  setIsLoadingQueue,
  startRadioSession,
  endRadioSession,
  reorderQueue,
} = queueSlice.actions;

export default queueSlice.reducer;