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
  isLyricsOpen: boolean;
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
    if (parsed && parsed.id && typeof parsed.id === "string") {
      const parts = parsed.id.split(".");
      if (parts.length === 2 && parts[0] && parts[1]) {
        return parsed;
      }
    }
    localStorage.removeItem("system_user");
    localStorage.removeItem("system_token");
    return null;
  } catch {
    return null;
  }
})();

export const playerStore = new Store<PlayerState>({
  currentSong: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 0.8,
  isMuted: false,
  queue: [],
  lastQueueIndex: -1,
  repeatMode: "none",
  isShuffle: false,
  qualityTracks: [],
  selectedQuality: "auto",
  isLyricsOpen: false,
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
