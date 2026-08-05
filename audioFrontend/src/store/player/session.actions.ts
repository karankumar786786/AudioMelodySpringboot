import { playerStore } from "./index";
import { musicApi } from "@/lib/api";

export const sessionActions = {
  setSystemSession: (token: string, refreshToken: string, user: any) => {
    localStorage.setItem("system_token", token);
    localStorage.setItem("system_refresh_token", refreshToken);
    localStorage.setItem("system_user", JSON.stringify(user));
    playerStore.setState((s) => ({
      ...s,
      systemToken: token,
      systemRefreshToken: refreshToken,
      systemUser: user,
    }));
  },

  clearSystemSession: () => {
    localStorage.removeItem("system_token");
    localStorage.removeItem("system_refresh_token");
    localStorage.removeItem("system_user");
    if (typeof window !== "undefined") {
      localStorage.removeItem("last_queue");
      localStorage.removeItem("last_queue_index");
    }
    playerStore.setState((s) => ({
      ...s,
      systemToken: null,
      systemRefreshToken: null,
      systemUser: null,
      favourites: new Set(),
      currentSong: null,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      queue: [],
      lastQueueIndex: -1,
      qualityTracks: [],
    }));
  },

  fetchFavourites: async () => {
    const { systemUser } = playerStore.state;
    if (!systemUser?.id) return;
    try {
      const res = await musicApi.users.getFavourites(1, 100);
      const ids = res.data.data.map((s: any) => s.id);
      playerStore.setState((s) => ({ ...s, favourites: new Set(ids) }));
    } catch (err: any) {
      console.error("[PlayerStore] Failed to fetch favourites:", err);
      if (err?.response?.status === 400 || err?.response?.status === 401) {
        sessionActions.clearSystemSession();
      }
    }
  },

  toggleFavourite: async (songId: string) => {
    const { systemUser, favourites } = playerStore.state;
    if (!systemUser?.id) return;

    const isFav = favourites.has(songId);
    try {
      if (isFav) {
        await musicApi.users.removeFavourite(songId);
        playerStore.setState((s) => {
          const next = new Set(s.favourites);
          next.delete(songId);
          return { ...s, favourites: next };
        });
      } else {
        await musicApi.users.addFavourite(songId);
        playerStore.setState((s) => {
          const next = new Set(s.favourites);
          next.add(songId);
          return { ...s, favourites: next };
        });
      }
    } catch (err: any) {
      console.error("[PlayerStore] Toggle favourite failed:", err);
      if (err?.response?.status === 400 || err?.response?.status === 401) {
        sessionActions.clearSystemSession();
      }
      throw err;
    }
  },
  openAuthModal: () => {
    playerStore.setState((s) => ({ ...s, isAuthModalOpen: true }));
  },
  closeAuthModal: () => {
    playerStore.setState((s) => ({ ...s, isAuthModalOpen: false }));
  },
};
