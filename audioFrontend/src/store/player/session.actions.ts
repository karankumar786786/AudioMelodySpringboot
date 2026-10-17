import { playerStore } from "./index";
import { musicApi } from "@/lib/api";
import { toast } from "sonner";

export const sessionActions = {
  setSystemSession: (user: any) => {
    if (user) {
      if (typeof window !== "undefined") {
        localStorage.setItem("system_user", JSON.stringify(user));
      }
      playerStore.setState((s) => ({
        ...s,
        systemUser: user,
      }));
    }
  },

  updateSystemUser: (updatedUser: any) => {
    const existing = playerStore.state.systemUser || {};
    const merged = { ...existing, ...updatedUser };
    if (typeof window !== "undefined") {
      localStorage.setItem("system_user", JSON.stringify(merged));
    }
    playerStore.setState((s) => ({
      ...s,
      systemUser: merged,
    }));
  },

  clearSystemSession: () => {
    console.log("[PlayerStore] clearSystemSession called - purging storage & state");
    if (typeof window !== "undefined") {
      localStorage.removeItem("system_user");
      localStorage.removeItem("last_queue");
      localStorage.removeItem("last_queue_index");
      localStorage.removeItem("last_current_song");
      localStorage.removeItem("last_current_time");
    }
    playerStore.setState((s) => ({
      ...s,
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
    if (!systemUser?.id) return { success: false, isFavourite: false };

    const sid = String(songId);
    const isFav = favourites.has(sid);

    try {
      if (isFav) {
        await musicApi.users.removeFavourite(sid);
      } else {
        await musicApi.users.addFavourite(sid);
      }
    } catch (err: any) {
      const status = err?.response?.status;

      // Treat idempotent cases as success:
      // 409 = already in favourites (add called but already exists)
      // 404 = not in favourites (remove called but already gone)
      if ((status === 409 && !isFav) || (status === 404 && isFav)) {
        console.warn("[PlayerStore] Favourite already in desired state, ignoring:", status);
      } else {
        if (status === 401 || status === 403) {
          toast.error("Session expired. Please log in again.");
          sessionActions.clearSystemSession();
        }
        console.error("[PlayerStore] Toggle favourite failed:", err);
        throw err;
      }
    }

    // Update favourites in state ONLY AFTER successful API call
    const nextFavourites = new Set<string>(
      Array.from(playerStore.state.favourites).map((id) => String(id)),
    );
    if (isFav) {
      nextFavourites.delete(sid);
    } else {
      nextFavourites.add(sid);
    }
    playerStore.setState((s) => ({ ...s, favourites: nextFavourites }));

    return { success: true, isFavourite: !isFav };
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
