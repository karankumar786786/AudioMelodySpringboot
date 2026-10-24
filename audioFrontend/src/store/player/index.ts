import { Store } from "@tanstack/react-store";
import type { User } from "@/lib/api/types";
import type { PlayerSong, QualityTrack } from "@/lib/player-utils";
import { store } from "@/store";
import { setIsAuthModalOpen, setSystemUser } from "@/store/slices/authSlice";
import {
  setCurrentSong,
  setCurrentTime,
  setDominantColor,
  setDuration,
  setHasLyrics,
  setIsLoading,
  setIsMuted,
  setIsPlaying,
  setIsRefilling,
  setPlaybackRate,
  setQualityTracks,
  setSeekTarget,
  setSelectedQuality,
  setVolume,
} from "@/store/slices/playerSlice";
import {
  setPendingSearchConfirmation,
  setQueue,
  setQueueIndex,
  setRadioSession,
  setRepeatMode,
} from "@/store/slices/queueSlice";
import {
  setIsFullVideoOpen,
  setIsLyricsOpen,
  setIsVideoActive,
  setIsZenMode,
  setSleepTimer,
} from "@/store/slices/uiSlice";

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

const getMergedState = (): PlayerState => {
  const s = store.getState();
  return {
    currentSong: s.player.currentSong,
    isPlaying: s.player.isPlaying,
    isLoading: s.player.isLoading,
    currentTime: s.player.currentTime,
    seekTarget: s.player.seekTarget,
    duration: s.player.duration,
    volume: s.player.volume,
    isMuted: s.player.isMuted,
    playbackRate: s.player.playbackRate,
    qualityTracks: s.player.qualityTracks,
    selectedQuality: s.player.selectedQuality,
    hasLyrics: s.player.hasLyrics,
    dominantColor: s.player.dominantColor,
    isRefilling: s.player.isRefilling,
    queue: s.queue.queue,
    originalQueue: s.queue.originalQueue,
    lastQueueIndex: s.queue.lastQueueIndex,
    repeatMode: s.queue.repeatMode,
    isShuffle: s.queue.isShuffle,
    dislikedSongIds: s.queue.dislikedSongIds,
    radioSession: s.queue.radioSession,
    pendingSearchConfirmation: s.queue.pendingSearchConfirmation,
    systemUser: s.auth.systemUser,
    isAuthModalOpen: s.auth.isAuthModalOpen,
    favourites: new Set(s.auth.favourites),
    isLyricsOpen: s.ui.isLyricsOpen,
    isVideoActive: s.ui.isVideoActive,
    isFullVideoOpen: s.ui.isFullVideoOpen,
    isZenMode: s.ui.isZenMode,
    sleepTimer: s.ui.sleepTimer,
  };
};

/**
 * Single source of truth bridge:
 * playerStore is a native TanStack Store instance kept synchronized with the Redux Toolkit store.
 * Components can use either useStore(playerStore) or useAppSelector.
 */
export const playerStore = new Store<PlayerState>(getMergedState());

let isSyncing = false;
store.subscribe(() => {
  if (isSyncing) return;
  isSyncing = true;
  try {
    playerStore.setState(() => getMergedState());
  } finally {
    isSyncing = false;
  }
});

const originalSetState = playerStore.setState.bind(playerStore);
playerStore.setState = (
  updater:
    | Partial<PlayerState>
    | ((state: PlayerState) => Partial<PlayerState> | void),
) => {
  const current = playerStore.state;
  const next =
    typeof updater === "function" ? (updater(current) as any) : updater;
  if (!next) return;

  isSyncing = true;
  try {
    originalSetState(() => ({ ...current, ...next }));

    if (
      next.currentSong !== undefined &&
      next.currentSong !== current.currentSong
    ) {
      store.dispatch(setCurrentSong(next.currentSong));
    }
    if (next.isPlaying !== undefined && next.isPlaying !== current.isPlaying) {
      store.dispatch(setIsPlaying(next.isPlaying));
    }
    if (next.isLoading !== undefined && next.isLoading !== current.isLoading) {
      store.dispatch(setIsLoading(next.isLoading));
    }
    if (
      next.currentTime !== undefined &&
      next.currentTime !== current.currentTime
    ) {
      store.dispatch(setCurrentTime(next.currentTime));
    }
    if (
      next.seekTarget !== undefined &&
      next.seekTarget !== current.seekTarget
    ) {
      store.dispatch(setSeekTarget(next.seekTarget));
    }
    if (next.duration !== undefined && next.duration !== current.duration) {
      store.dispatch(setDuration(next.duration));
    }
    if (next.volume !== undefined && next.volume !== current.volume) {
      store.dispatch(setVolume(next.volume));
    }
    if (next.isMuted !== undefined && next.isMuted !== current.isMuted) {
      store.dispatch(setIsMuted(next.isMuted));
    }
    if (
      next.playbackRate !== undefined &&
      next.playbackRate !== current.playbackRate
    ) {
      store.dispatch(setPlaybackRate(next.playbackRate));
    }
    if (
      next.qualityTracks !== undefined &&
      next.qualityTracks !== current.qualityTracks
    ) {
      store.dispatch(setQualityTracks(next.qualityTracks));
    }
    if (
      next.selectedQuality !== undefined &&
      next.selectedQuality !== current.selectedQuality
    ) {
      store.dispatch(setSelectedQuality(next.selectedQuality));
    }
    if (next.hasLyrics !== undefined && next.hasLyrics !== current.hasLyrics) {
      store.dispatch(setHasLyrics(next.hasLyrics));
    }
    if (
      next.dominantColor !== undefined &&
      next.dominantColor !== current.dominantColor
    ) {
      store.dispatch(setDominantColor(next.dominantColor));
    }
    if (
      next.isRefilling !== undefined &&
      next.isRefilling !== current.isRefilling
    ) {
      store.dispatch(setIsRefilling(next.isRefilling));
    }
    if (next.queue !== undefined && next.queue !== current.queue) {
      store.dispatch(
        setQueue({
          queue: next.queue,
          index:
            next.lastQueueIndex !== undefined
              ? next.lastQueueIndex
              : current.lastQueueIndex,
        }),
      );
    } else if (
      next.lastQueueIndex !== undefined &&
      next.lastQueueIndex !== current.lastQueueIndex
    ) {
      store.dispatch(setQueueIndex(next.lastQueueIndex));
    }
    if (
      next.repeatMode !== undefined &&
      next.repeatMode !== current.repeatMode
    ) {
      store.dispatch(setRepeatMode(next.repeatMode));
    }
    if (
      next.systemUser !== undefined &&
      next.systemUser !== current.systemUser
    ) {
      store.dispatch(setSystemUser(next.systemUser));
    }
    if (
      next.isAuthModalOpen !== undefined &&
      next.isAuthModalOpen !== current.isAuthModalOpen
    ) {
      store.dispatch(setIsAuthModalOpen(next.isAuthModalOpen));
    }
    if (
      next.isLyricsOpen !== undefined &&
      next.isLyricsOpen !== current.isLyricsOpen
    ) {
      store.dispatch(setIsLyricsOpen(next.isLyricsOpen));
    }
    if (
      next.isVideoActive !== undefined &&
      next.isVideoActive !== current.isVideoActive
    ) {
      store.dispatch(setIsVideoActive(next.isVideoActive));
    }
    if (
      next.isFullVideoOpen !== undefined &&
      next.isFullVideoOpen !== current.isFullVideoOpen
    ) {
      store.dispatch(setIsFullVideoOpen(next.isFullVideoOpen));
    }
    if (next.isZenMode !== undefined && next.isZenMode !== current.isZenMode) {
      store.dispatch(setIsZenMode(next.isZenMode));
    }
    if (
      next.sleepTimer !== undefined &&
      next.sleepTimer !== current.sleepTimer
    ) {
      store.dispatch(setSleepTimer(next.sleepTimer));
    }
    if (
      next.radioSession !== undefined &&
      next.radioSession !== current.radioSession
    ) {
      store.dispatch(setRadioSession(next.radioSession));
    }
    if (
      next.pendingSearchConfirmation !== undefined &&
      next.pendingSearchConfirmation !== current.pendingSearchConfirmation
    ) {
      store.dispatch(
        setPendingSearchConfirmation(next.pendingSearchConfirmation),
      );
    }
  } finally {
    isSyncing = false;
  }
};
