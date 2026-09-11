import { Store } from "@tanstack/react-store";
import { type PlayerSong } from "@/lib/player-utils";

export interface SleepTimerState {
  targetTimestamp: number | null;
  mode: "minutes" | "end_of_track" | null;
  durationMinutes?: number;
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
  qualityTracks: any[];
  selectedQuality: "auto" | number;
  isAuthModalOpen: boolean;
  systemToken: string | null;
  systemRefreshToken: string | null;
  systemUser: any | null;
  favourites: Set<string>;
  isRefilling: boolean;
  isLyricsOpen: boolean;
  isVideoActive: boolean;
  isFullVideoOpen: boolean;
  sleepTimer: SleepTimerState;
  playbackRate: number;
}

const _initSystemUser = (() => {
  if (typeof window === "undefined") return null;
  try {
    const saved = localStorage.getItem("system_user");
    if (!saved) return null;
    const parsed = JSON.parse(saved);
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof parsed.id === "string" &&
      typeof parsed.email === "string"
    ) {
      return parsed;
    }
    localStorage.removeItem("system_user");
    localStorage.removeItem("system_token");
    localStorage.removeItem("system_refresh_token");
    return null;
  } catch {
    localStorage.removeItem("system_user");
    localStorage.removeItem("system_token");
    localStorage.removeItem("system_refresh_token");
    return null;
  }
})();

const _initPlaybackTime = (() => {
  if (typeof window === "undefined") return 0;
  try {
    const saved = localStorage.getItem("last_current_time");
    if (!saved) return 0;
    const val = parseFloat(saved);
    return isNaN(val) || val < 0 ? 0 : val;
  } catch {
    return 0;
  }
})();

const _initCurrentSong = (() => {
  if (typeof window === "undefined") return null;
  try {
    const saved = localStorage.getItem("last_current_song");
    if (!saved) return null;
    const parsed = JSON.parse(saved);
    // Basic shape validation
    if (parsed && typeof parsed === "object" && typeof parsed.id === "string" && parsed.id) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
})();

const _initRepeatMode = (() => {
  if (typeof window === "undefined") return "none";
  try {
    const saved = localStorage.getItem("audiomelody_repeat_mode");
    if (saved === "all" || saved === "one") return saved;
    return "none";
  } catch {
    return "none";
  }
})();

const _initShuffle = (() => {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem("audiomelody_shuffle") === "true";
  } catch {
    return false;
  }
})();

export const playerStore = new Store<PlayerState>({
  currentSong: _initCurrentSong,
  isPlaying: false,
  isLoading: false,
  currentTime: _initPlaybackTime,
  seekTarget: null,
  duration: 0,
  volume: 1,
  isMuted: false,
  queue: [],
  originalQueue: [],
  lastQueueIndex: -1,
  repeatMode: _initRepeatMode,
  isShuffle: _initShuffle,
  qualityTracks: [],
  selectedQuality: "auto",
  isAuthModalOpen: false,
  systemToken: null,
  systemRefreshToken: null,
  systemUser: _initSystemUser,
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
});

// Hydrate token, repeatMode, isShuffle, currentTime, and currentSong on client side only
if (typeof window !== "undefined") {
  const token = localStorage.getItem("system_token");
  const refreshToken = localStorage.getItem("system_refresh_token");
  const savedRepeat = localStorage.getItem("audiomelody_repeat_mode") as
    | "none"
    | "all"
    | "one"
    | null;
  const savedShuffle = localStorage.getItem("audiomelody_shuffle");
  const savedTime = localStorage.getItem("last_current_time");
  const parsedTime = savedTime ? parseFloat(savedTime) : 0;

  const updates: Partial<PlayerState> = {
    systemToken: token || undefined,
    systemRefreshToken: refreshToken || undefined,
    currentTime: !isNaN(parsedTime) && parsedTime > 0 ? parsedTime : undefined,
    repeatMode:
      savedRepeat === "none" || savedRepeat === "all" || savedRepeat === "one"
        ? savedRepeat
        : undefined,
    isShuffle:
      savedShuffle !== null ? savedShuffle === "true" : undefined,
  };

  // If we restored a currentSong, also seed the queue with it so
  // queue-dependent logic (next/prev, lastQueueIndex) works correctly.
  if (_initCurrentSong) {
    const seedQueue = [_initCurrentSong];
    updates.queue = seedQueue;
    updates.lastQueueIndex = 0;
  }

  playerStore.setState((s) => ({
    ...s,
    ...(updates.systemToken !== undefined && { systemToken: updates.systemToken }),
    ...(updates.systemRefreshToken !== undefined && { systemRefreshToken: updates.systemRefreshToken }),
    ...(updates.currentTime !== undefined && { currentTime: updates.currentTime }),
    ...(updates.repeatMode !== undefined && { repeatMode: updates.repeatMode }),
    ...(updates.isShuffle !== undefined && { isShuffle: updates.isShuffle }),
    ...(updates.queue !== undefined && { queue: updates.queue, lastQueueIndex: updates.lastQueueIndex }),
  }));
}
