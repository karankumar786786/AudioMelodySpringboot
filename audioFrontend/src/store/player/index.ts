import { Store } from "@tanstack/react-store";
import { type PlayerSong, type QualityTrack } from "@/lib/player-utils";
import { type User } from "@/lib/api/types";

export interface SleepTimerState {
  targetTimestamp: number | null;
  mode: "minutes" | "end_of_track" | null;
  durationMinutes?: number;
}

export interface RadioSession {
  seedSongId: string | null;
  seedTitle?: string;
  isActive: boolean;
  sessionHistoryIds: string[];
  skippedSongIds?: string[];
}

export interface PlayerState {
  currentSong: PlayerSong | null;
  isPlaying: boolean;
  isLoading: boolean;
  currentTime: number;
  seekTarget: number | null;
  duration: number;
  volume: number;
  isMuted: boolean;
  queue: PlayerSong[];
  originalQueue: PlayerSong[];
  lastQueueIndex: number;
  repeatMode: "none" | "one" | "all";
  isShuffle: boolean;
  qualityTracks: QualityTrack[];
  selectedQuality: "auto" | number;
  isAuthModalOpen: boolean;
  systemUser: User | null;
  favourites: Set<string>;
  isRefilling: boolean;
  isLyricsOpen: boolean;
  isVideoActive: boolean;
  isFullVideoOpen: boolean;
  sleepTimer: SleepTimerState;
  playbackRate: number;
  radioSession: RadioSession;
  isZenMode: boolean;
  hasLyrics: boolean;
  dominantColor: string;
  pendingSearchConfirmation: { songId: string } | null;
  dislikedSongIds: string[];
}

export const playerStore = new Store<PlayerState>({
  currentSong: null,
  isPlaying: false,
  isLoading: false,
  currentTime: 0,
  seekTarget: null,
  duration: 0,
  volume: 1,
  isMuted: false,
  queue: [],
  originalQueue: [],
  lastQueueIndex: -1,
  repeatMode: "none",
  isShuffle: false,
  qualityTracks: [],
  selectedQuality: "auto",
  isAuthModalOpen: false,
  systemUser: null,
  favourites: new Set<string>(),
  isRefilling: false,
  isLyricsOpen: false,
  isVideoActive: false,
  isFullVideoOpen: false,
  sleepTimer: {
    targetTimestamp: null,
    mode: null,
  },
  playbackRate: 1,
  radioSession: {
    seedSongId: null,
    isActive: false,
    sessionHistoryIds: [],
    skippedSongIds: [],
  },
  isZenMode: false,
  hasLyrics: false,
  dominantColor: "#181818",
  pendingSearchConfirmation: null,
  dislikedSongIds: [],
});

