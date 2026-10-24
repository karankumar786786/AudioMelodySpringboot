import { createListenerMiddleware, isAnyOf } from "@reduxjs/toolkit";
import { logout, setSystemUser, updateSystemUser } from "./slices/authSlice";
import { setPlaybackRate, setVolume } from "./slices/playerSlice";
import {
  setRepeatMode,
  toggleDislike,
  toggleRepeat,
  toggleShuffle,
} from "./slices/queueSlice";
import { RootState } from ".";

export const listenerMiddleware = createListenerMiddleware();

listenerMiddleware.startListening({
  matcher: isAnyOf(setVolume, setPlaybackRate),
  effect: (_action, listenerApi) => {
    if (typeof window === "undefined") return;
    const state = listenerApi.getState() as RootState;
    localStorage.setItem("audiomelody_volume", state.player.volume.toString());
    localStorage.setItem(
      "audiomelody_playback_rate",
      state.player.playbackRate.toString(),
    );
  },
});

listenerMiddleware.startListening({
  matcher: isAnyOf(toggleRepeat, setRepeatMode, toggleShuffle, toggleDislike),
  effect: (_action, listenerApi) => {
    if (typeof window === "undefined") return;
    const state = listenerApi.getState() as RootState;
    localStorage.setItem("audiomelody_repeat_mode", state.queue.repeatMode);
    localStorage.setItem(
      "audiomelody_shuffle",
      state.queue.isShuffle.toString(),
    );
    localStorage.setItem(
      "audiomelody_disliked_songs",
      JSON.stringify(state.queue.dislikedSongIds),
    );
  },
});

listenerMiddleware.startListening({
  matcher: isAnyOf(setSystemUser, updateSystemUser, logout),
  effect: (_action, listenerApi) => {
    if (typeof window === "undefined") return;
    const state = listenerApi.getState() as RootState;
    if (state.auth.systemUser) {
      localStorage.setItem(
        "system_user",
        JSON.stringify(state.auth.systemUser),
      );
    } else {
      localStorage.removeItem("system_user");
    }
  },
});
