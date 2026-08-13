import { playerStore } from "./index";
import { musicApi } from "@/lib/api";
import { toast } from "sonner";

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
    console.log("[PlayerStore] clearSystemSession called - purging storage & state");
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
      const ids = res.data.data.map((s: any) => String(s.id));
      playerStore.setState((s) => ({ ...s, favourites: new Set(ids) }));
    } catch (err: any) {
      console.error("[PlayerStore] Failed to fetch favourites:", err);
      if (err?.response?.status === 401 || err?.response?.status === 403) {
        toast.error("Session expired. Please log in again.");
        sessionActions.clearSystemSession();
      }
    }
  },

  toggleFavourite: async (songId: string) => {
    const { systemUser, favourites } = playerStore.state;
    if (!systemUser?.id) return;

    const sid = String(songId);
    const isFav = favourites.has(sid);
    const optimisticNext = new Set<string>(Array.from(favourites).map((id) => String(id)));
    if (isFav) {
      optimisticNext.delete(sid);
    } else {
      optimisticNext.add(sid);
    }

    playerStore.setState((s) => ({ ...s, favourites: optimisticNext }));

    try {
      if (isFav) {
        await musicApi.users.removeFavourite(sid);
      } else {
        await musicApi.users.addFavourite(sid);
      }
    } catch (err: any) {
      console.error("[PlayerStore] Toggle favourite failed:", err);
      playerStore.setState((s) => ({ ...s, favourites }));
      if (err?.response?.status === 401 || err?.response?.status === 403) {
        toast.error("Session expired. Please log in again.");
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

if (typeof window !== "undefined") {
  window.addEventListener("session:cleared", () => {
    sessionActions.clearSystemSession();
  });
}
