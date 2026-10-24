import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export interface SleepTimerState {
  targetTimestamp: number | null;
  mode: "minutes" | "end_of_track" | null;
  durationMinutes?: number;
}

export interface UIState {
  isLyricsOpen: boolean;
  isVideoActive: boolean;
  isFullVideoOpen: boolean;
  isZenMode: boolean;
  sleepTimer: SleepTimerState;
}

const initialState: UIState = {
  isLyricsOpen: false,
  isVideoActive: false,
  isFullVideoOpen: false,
  isZenMode: false,
  sleepTimer: {
    targetTimestamp: null,
    mode: null,
  },
};

export const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    setIsLyricsOpen: (state, action: PayloadAction<boolean>) => {
      state.isLyricsOpen = action.payload;
    },
    toggleLyrics: (state) => {
      state.isLyricsOpen = !state.isLyricsOpen;
    },
    setIsVideoActive: (state, action: PayloadAction<boolean>) => {
      state.isVideoActive = action.payload;
    },
    setIsFullVideoOpen: (state, action: PayloadAction<boolean>) => {
      state.isFullVideoOpen = action.payload;
    },
    setIsZenMode: (state, action: PayloadAction<boolean>) => {
      state.isZenMode = action.payload;
    },
    toggleZenMode: (state) => {
      state.isZenMode = !state.isZenMode;
    },
    setSleepTimer: (state, action: PayloadAction<SleepTimerState>) => {
      state.sleepTimer = action.payload;
    },
    clearSleepTimer: (state) => {
      state.sleepTimer = { targetTimestamp: null, mode: null };
    },
  },
});

export const {
  setIsLyricsOpen,
  toggleLyrics,
  setIsVideoActive,
  setIsFullVideoOpen,
  setIsZenMode,
  toggleZenMode,
  setSleepTimer,
  clearSleepTimer,
} = uiSlice.actions;

export default uiSlice.reducer;
