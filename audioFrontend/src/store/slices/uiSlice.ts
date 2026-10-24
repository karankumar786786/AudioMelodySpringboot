import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export interface SleepTimerState {
  targetTimestamp: number | null;
  mode: "minutes" | "end_of_track" | null;
  durationMinutes?: number;
}

export type ActiveModal =
  | "commandPalette"
  | "equalizer"
  | "sleepTimer"
  | "shortcuts"
  | "playlistPicker"
  | "shareSong"
  | "queue"
  | null;

export interface UIState {
  isLyricsOpen: boolean;
  isVideoActive: boolean;
  isFullVideoOpen: boolean;
  isZenMode: boolean;
  sleepTimer: SleepTimerState;
  activeModal: ActiveModal;
  modalPayload: any | null;
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
  activeModal: null,
  modalPayload: null,
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
    openModal: (
      state,
      action: PayloadAction<{ type: ActiveModal; payload?: any } | ActiveModal>
    ) => {
      if (typeof action.payload === "string" || action.payload === null) {
        state.activeModal = action.payload;
        state.modalPayload = null;
      } else {
        state.activeModal = action.payload.type;
        state.modalPayload = action.payload.payload ?? null;
      }
    },
    closeModal: (state) => {
      state.activeModal = null;
      state.modalPayload = null;
    },
    toggleModal: (state, action: PayloadAction<ActiveModal>) => {
      if (state.activeModal === action.payload) {
        state.activeModal = null;
        state.modalPayload = null;
      } else {
        state.activeModal = action.payload;
        state.modalPayload = null;
      }
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
  openModal,
  closeModal,
  toggleModal,
} = uiSlice.actions;

export default uiSlice.reducer;
