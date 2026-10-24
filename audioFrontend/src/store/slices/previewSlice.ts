import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type PreviewStatus = "idle" | "countdown" | "loading" | "playing";

export interface PreviewState {
  status: PreviewStatus;
  songId: string | null;
  songTitle: string | null;
  startTime: number;
  endTime: number;
  currentTime: number;
  progress: number;
}

const initialState: PreviewState = {
  status: "idle",
  songId: null,
  songTitle: null,
  startTime: 0,
  endTime: 0,
  currentTime: 0,
  progress: 0,
};

export const previewSlice = createSlice({
  name: "preview",
  initialState,
  reducers: {
    setPreviewState: (state, action: PayloadAction<Partial<PreviewState>>) => {
      Object.assign(state, action.payload);
    },
    updatePreviewProgress: (
      state,
      action: PayloadAction<{ currentTime: number; progress: number }>
    ) => {
      state.currentTime = action.payload.currentTime;
      state.progress = action.payload.progress;
    },
    resetPreview: (state) => {
      state.status = "idle";
      state.songId = null;
      state.songTitle = null;
      state.startTime = 0;
      state.endTime = 0;
      state.currentTime = 0;
      state.progress = 0;
    },
  },
});

export const { setPreviewState, updatePreviewProgress, resetPreview } =
  previewSlice.actions;

export default previewSlice.reducer;
