import { Store } from "@tanstack/react-store";
import { type PlayerSong } from "@/lib/player-utils";

export interface PlayerState {
  currentSong: PlayerSong | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  queue: PlayerSong[];
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

export const playerStore = new Store<PlayerState>({
  currentSong: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 1,
  isMuted: false,
  queue: [],
  lastQueueIndex: -1,
  repeatMode: "none",
  isShuffle: false,
  qualityTracks: [],
  selectedQuality: "auto",
  isAuthModalOpen: false,
  systemToken: null,
  systemRefreshToken: null,
  systemUser: _initSystemUser,
  favourites: new Set<string>(),
  isRefilling: false,
});

// Hydrate token on client side only
if (typeof window !== "undefined") {
  const token = localStorage.getItem("system_token");
  const refreshToken = localStorage.getItem("system_refresh_token");
  if (token) {
    playerStore.setState((s) => ({
      ...s,
      systemToken: token,
      systemRefreshToken: refreshToken,
    }));
  }
}
