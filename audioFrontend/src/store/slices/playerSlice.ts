import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { PlayerSong, QualityTrack } from "@/lib/player-utils";

export interface PlayerState {
  currentSong: PlayerSong | null;
  isPlaying: boolean;
  isLoading: boolean;
  currentTime: number;
  seekTarget: number | null;
  duration: number;
  volume: number;
  isMuted: boolean;
  playbackRate: number;
  qualityTracks: QualityTrack[];
  selectedQuality: "auto" | number;
  hasLyrics: boolean;
  dominantColor: string;
  isRefilling: boolean;
}

const getInitialVolume = (): number => {
  if (typeof window === "undefined") return 1;
  const saved = localStorage.getItem("audiomelody_volume");
  return saved ? parseFloat(saved) : 1;
};

const getInitialPlaybackRate = (): number => {
  if (typeof window === "undefined") return 1;
  const saved = localStorage.getItem("audiomelody_playback_rate");
  return saved ? parseFloat(saved) : 1;
};

const initialState: PlayerState = {
  currentSong: null,
  isPlaying: false,
  isLoading: false,
  currentTime: 0,
  seekTarget: null,
  duration: 0,
  volume: getInitialVolume(),
  isMuted: false,
  playbackRate: getInitialPlaybackRate(),
  qualityTracks: [],
  selectedQuality: "auto",
  hasLyrics: false,
  dominantColor: "#181818",
  isRefilling: false,
};

export const playerSlice = createSlice({
  name: "player",
  initialState,
  reducers: {
    setCurrentSong: (state, action: PayloadAction<PlayerSong | null>) => {
      state.currentSong = action.payload;
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
    setSeekTarget: (state, action: PayloadAction<number | null>) => {
      state.seekTarget = action.payload;
    },
    setDuration: (state, action: PayloadAction<number>) => {
      state.duration = action.payload;
    },
    setVolume: (state, action: PayloadAction<number>) => {
      state.volume = Math.max(0, Math.min(1, action.payload));
      state.isMuted = state.volume === 0;
    },
    setIsMuted: (state, action: PayloadAction<boolean>) => {
      state.isMuted = action.payload;
    },
    setPlaybackRate: (state, action: PayloadAction<number>) => {
      state.playbackRate = action.payload;
    },
    setQualityTracks: (state, action: PayloadAction<QualityTrack[]>) => {
      state.qualityTracks = action.payload;
    },
    setSelectedQuality: (state, action: PayloadAction<"auto" | number>) => {
      state.selectedQuality = action.payload;
    },
    setHasLyrics: (state, action: PayloadAction<boolean>) => {
      state.hasLyrics = action.payload;
    },
    setDominantColor: (state, action: PayloadAction<string>) => {
      state.dominantColor = action.payload;
    },
    setIsRefilling: (state, action: PayloadAction<boolean>) => {
      state.isRefilling = action.payload;
    },
    resetPlayback: (state) => {
      state.isPlaying = false;
      state.isLoading = false;
      state.currentTime = 0;
      state.seekTarget = null;
      state.duration = 0;
    },
  },
});

export const {
  setCurrentSong,
  setIsPlaying,
  togglePlay,
  setIsLoading,
  setCurrentTime,
  setSeekTarget,
  setDuration,
  setVolume,
  setIsMuted,
  setPlaybackRate,
  setQualityTracks,
  setSelectedQuality,
  setHasLyrics,
  setDominantColor,
  setIsRefilling,
  resetPlayback,
} = playerSlice.actions;

export default playerSlice.reducer;
