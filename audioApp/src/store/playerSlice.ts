import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { PlayerSong, PlayerState, PlaybackMode } from "@/types";

const initialState: PlayerState = {
  currentSong: null,
  isPlaying: false,
  isLoading: false,
  currentTime: 0,
  duration: 0,
  bufferedTime: 0,
  seekTarget: null,
  volume: 1,
  isMuted: false,
  playbackRate: 1,
  dominantColor: "#1A1A1A",
  playbackMode: "audio",
};

export const playerSlice = createSlice({
  name: "player",
  initialState,
  reducers: {
    setCurrentSong: (state, action: PayloadAction<PlayerSong | null>) => {
      state.currentSong = action.payload;
      state.currentTime = 0;
      state.seekTarget = null;
      if (action.payload?.duration) {
        state.duration = action.payload.duration;
      }
    },
    setIsPlaying: (state, action: PayloadAction<boolean>) => {
      state.isPlaying = action.payload;
    },
    togglePlay: (state) => {
      state.isPlaying = !state.isPlaying;
    },
    setIsLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setCurrentTime: (state, action: PayloadAction<number>) => {
      state.currentTime = action.payload;
    },
    setDuration: (state, action: PayloadAction<number>) => {
      state.duration = action.payload;
    },
    setBufferedTime: (state, action: PayloadAction<number>) => {
      state.bufferedTime = action.payload;
    },
    setSeekTarget: (state, action: PayloadAction<number | null>) => {
      state.seekTarget = action.payload;
    },
    setVolume: (state, action: PayloadAction<number>) => {
      state.volume = Math.max(0, Math.min(1, action.payload));
    },
    setIsMuted: (state, action: PayloadAction<boolean>) => {
      state.isMuted = action.payload;
    },
    setPlaybackRate: (state, action: PayloadAction<number>) => {
      state.playbackRate = action.payload;
    },
    setDominantColor: (state, action: PayloadAction<string>) => {
      state.dominantColor = action.payload;
    },
    setPlaybackMode: (state, action: PayloadAction<PlaybackMode>) => {
      state.playbackMode = action.payload;
    },
    resetPlayer: (state) => {
      state.currentSong = null;
      state.isPlaying = false;
      state.isLoading = false;
      state.currentTime = 0;
      state.duration = 0;
      state.bufferedTime = 0;
      state.seekTarget = null;
      state.playbackMode = "audio";
    },
  },
});

export const {
  setCurrentSong,
  setIsPlaying,
  togglePlay,
  setIsLoading,
  setCurrentTime,
  setDuration,
  setBufferedTime,
  setSeekTarget,
  setVolume,
  setIsMuted,
  setPlaybackRate,
  setDominantColor,
  setPlaybackMode,
  resetPlayer,
} = playerSlice.actions;

export default playerSlice.reducer;
