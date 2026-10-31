import { AppDispatch, AppState, store } from "./hook";
import { Song, PlayerSong } from "@/types";
import { dedupeBySongId, mapToPlayerSong } from "@/utils/playerUtils";
import { logQueueSnapshot } from "@/utils/queueLogger";
import {
  setQueue,
  addToQueue,
  playNextTrack as playNextReducer,
  advanceToNextTrack,
  retreatToPrevTrack,
  setIsRefilling,
  startRadioSession,
  endRadioSession,
  selectCurrentSongFromQueue,
} from "./queueSlice";
import {
  setCurrentSong,
  setCurrentTime,
  setDuration,
  setIsPlaying,
} from "./playerSlice";
import { PlayerStore } from "@/storage/PlayerStore";
import { audioPlayerService } from "@/service/audioPlayerService";
import { homeService } from "@/service/homeService";
import { recombeeService } from "@/service/recombeeService";

let inFlightRefillPromise: Promise<void> | null = null;

/**
 * Replace entire queue and start playback from the first track.
 */
export const playAll =
  (songs: Song[], startPlaying = true) =>
  async (dispatch: AppDispatch, getState: () => AppState) => {
    if (!songs || songs.length === 0) return;

    const firstSong = songs[0];
    if (firstSong) {
      const { currentSong, isPlaying } = getState().player;
      if (currentSong?.id === firstSong.id) {
        if (isPlaying) return;
        audioPlayerService.resume();
        return;
      }
    }

    const deduped = dedupeBySongId(songs);
    if (!startPlaying) {
      audioPlayerService.suppressAutoPlayOnce();
    }

    dispatch(endRadioSession());
    dispatch(setQueue({ queue: deduped, index: 0 }));
    logQueueSnapshot("playAll", deduped, 0, deduped[0]);

    if (startPlaying && deduped[0]) {
      await audioPlayerService.play(deduped[0]);
    }

    if (deduped.length <= 3) {
      dispatch(refillQueue(true));
    }
  };

/**
 * Play a specific song within a contextual list (e.g., from an album or trending list).
 */
export const playAllFrom =
  (songs: Song[], startIndex: number, startPlaying = true) =>
  async (dispatch: AppDispatch, getState: () => AppState) => {
    if (!songs || songs.length === 0) return;

    const targetSong = songs[startIndex];
    if (targetSong) {
      const { currentSong, isPlaying } = getState().player;
      if (currentSong?.id === targetSong.id) {
        if (isPlaying) return;
        audioPlayerService.resume();
        return;
      }
    }

    const deduped = dedupeBySongId(songs);
    const targetIdx = targetSong
      ? deduped.findIndex((s) => s.id === targetSong.id)
      : -1;
    const safeIndex =
      targetIdx !== -1
        ? targetIdx
        : Math.min(Math.max(0, startIndex), deduped.length - 1);

    if (!startPlaying) {
      audioPlayerService.suppressAutoPlayOnce();
    }

    dispatch(endRadioSession());
    dispatch(setQueue({ queue: deduped, index: safeIndex }));
    logQueueSnapshot("playAllFrom", deduped, safeIndex, deduped[safeIndex]);

    if (startPlaying && deduped[safeIndex]) {
      await audioPlayerService.play(deduped[safeIndex]);
    }

    if (deduped.length - (safeIndex + 1) <= 2) {
      dispatch(refillQueue(false));
    }
  };

/**
 * Play a clicked song immediately and populate the queue with similar songs
 * directly from Recombee.
 */
export const playWithSimilarSongs =
  (song: Song | PlayerSong) =>
  async (dispatch: AppDispatch, getState: () => AppState) => {
    if (!song) return;

    const { currentSong, isPlaying } = getState().player;
    if (currentSong?.id === song.id) {
      if (isPlaying) return;
      audioPlayerService.resume();
      return;
    }

    // Initialize queue with the clicked song at index 0
    dispatch(setQueue({ queue: [song], index: 0 }));
    dispatch(startRadioSession({ seedSongId: song.id, seedTitle: song.title }));
    logQueueSnapshot("playWithSimilarSongs (Initial 1 Track)", [song], 0, song);

    // Start playback immediately with lazy PlayerSong hydration
    await audioPlayerService.play(song);

    // Asynchronously fetch similar songs from Recombee
    try {
      const state = getState();
      const user =
        state.user.profile?.id || state.device.deviceId || "anonymous";
      const similarSongs = await recombeeService.getSimilarSongs(
        song.id,
        15,
        user
      );

      const dislikedSet = new Set(getState().queue.dislikedSongIds);
      const filteredSimilar = similarSongs.filter(
        (s) => s.id !== song.id && !dislikedSet.has(s.id)
      );

      if (filteredSimilar.length > 0) {
        dispatch(addToQueue(filteredSimilar));
        logQueueSnapshot(
          "playWithSimilarSongs (After Recombee Recommendations)",
          getState().queue.queue,
          getState().queue.currentIndex,
          song
        );
        audioPlayerService.syncUpcomingPreload();
      }
    } catch (err) {
      console.warn("[Queue] Failed to load Recombee recommendations:", err);
    }
  };

export const playSong = playWithSimilarSongs;

/**
 * Enqueue a song to play immediately after the currently playing song.
 */
export const playNext =
  (song: Song | PlayerSong) => (dispatch: AppDispatch, getState: () => AppState) => {
    dispatch(playNextReducer(song));
    logQueueSnapshot("playNext", getState().queue.queue, getState().queue.currentIndex);
  };

/**
 * Append one or more songs to the upcoming queue.
 */
export const enqueue =
  (songs: (Song | PlayerSong)[] | (Song | PlayerSong)) =>
  (dispatch: AppDispatch, getState: () => AppState) => {
    const list = Array.isArray(songs) ? songs : [songs];
    dispatch(addToQueue(list));
    logQueueSnapshot("enqueue", getState().queue.queue, getState().queue.currentIndex);
  };

/**
 * Advance to the next track in the queue, handling repeat modes and auto-refill.
 */
export const nextTrack =
  (manualUserAction = false) =>
  async (dispatch: AppDispatch, getState: () => AppState) => {
    const { queue, currentIndex, repeatMode } = getState().queue;
    if (queue.length === 0) return;

    // Handle repeat mode "one" on auto-finish
    if (repeatMode === "one" && !manualUserAction && queue[currentIndex]) {
      await audioPlayerService.seek(0);
      audioPlayerService.resume();
      return;
    }

    // Trigger refill proactively if nearing end
    if (queue.length - (currentIndex + 1) <= 2) {
      dispatch(refillQueue(false));
    }

    if (currentIndex < queue.length - 1) {
      dispatch(advanceToNextTrack());
      const updated = getState().queue;
      const nextSong = selectCurrentSongFromQueue(updated);
      logQueueSnapshot("nextTrack (Advance)", updated.queue, updated.currentIndex, nextSong);
      if (nextSong) {
        await audioPlayerService.play(nextSong, 0, false);
      }
    } else if (repeatMode === "all") {
      dispatch(setQueue({ queue, index: 0 }));
      const firstSong = queue[0];
      logQueueSnapshot("nextTrack (Loop All to Start)", queue, 0, firstSong);
      if (firstSong) {
        await audioPlayerService.play(firstSong, 0, false);
      }
    } else {
      // Reached the end with repeat none; try refill
      await dispatch(refillQueue(false));
      const postRefillState = getState().queue;
      if (postRefillState.currentIndex < postRefillState.queue.length - 1) {
        dispatch(advanceToNextTrack());
        const after = getState().queue;
        const songToPlay = selectCurrentSongFromQueue(after);
        logQueueSnapshot("nextTrack (After Refill Advance)", after.queue, after.currentIndex, songToPlay);
        if (songToPlay) {
          await audioPlayerService.play(songToPlay, 0, false);
        }
      } else {
        console.log("[Queue] Reached end of queue and refill empty; pausing playback.");
        audioPlayerService.pause();
      }
    }
  };

/**
 * Skip back to previous track, or restart current track if played > 3 seconds.
 */
export const prevTrack =
  () => async (dispatch: AppDispatch, getState: () => AppState) => {
    const currentTime = audioPlayerService.getCurrentTime();

    if (currentTime > 3) {
      console.log(`[Queue:prevTrack] Current time is ${currentTime.toFixed(1)}s (> 3s), restarting current track.`);
      await audioPlayerService.seek(0);
      return;
    }

    const { currentIndex } = getState().queue;
    if (currentIndex > 0) {
      dispatch(retreatToPrevTrack());
      const updated = getState().queue;
      const prevSong = selectCurrentSongFromQueue(updated);
      logQueueSnapshot("prevTrack (Retreat)", updated.queue, updated.currentIndex, prevSong);
      if (prevSong) {
        await audioPlayerService.play(prevSong, 0, true);
      }
    } else {
      console.log(`[Queue:prevTrack] Already at index 0, seeking to start.`);
      await audioPlayerService.seek(0);
    }
  };

/**
 * Autoplay recommendation engine: refills upcoming queue with similar songs from Recombee when low.
 */
export const refillQueue =
  (isInit = false) =>
  async (dispatch: AppDispatch, getState: () => AppState): Promise<void> => {
    if (inFlightRefillPromise) return inFlightRefillPromise;

    const { queue, currentIndex, dislikedSongIds, radioSession } =
      getState().queue;
    const remaining = queue.length - (currentIndex + 1);

    if (!isInit && remaining > 3) {
      return;
    }

    inFlightRefillPromise = (async () => {
      try {
        dispatch(setIsRefilling(true));
        const currentSong = getState().player.currentSong;
        const seedId = radioSession?.seedSongId || currentSong?.id;
        const user =
          getState().user.profile?.id || getState().device.deviceId || "anonymous";

        let freshSongs: Song[] = [];
        if (seedId) {
          const excludeIds = queue.map((s) => s.id);
          freshSongs = await recombeeService.getRadioSongs(
            seedId,
            excludeIds,
            12,
            user
          );
        }

        if (!freshSongs || freshSongs.length === 0) {
          const trending = await homeService.getTrendingSongs(15);
          freshSongs = trending || [];
        }

        const dislikedSet = new Set(dislikedSongIds);
        const existingIds = new Set(queue.map((s) => s.id));

        const filtered = freshSongs.filter(
          (s) => !existingIds.has(s.id) && !dislikedSet.has(s.id)
        );

        if (filtered.length > 0) {
          dispatch(addToQueue(filtered));
          logQueueSnapshot("refillQueue (New Tracks Added)", getState().queue.queue, getState().queue.currentIndex);
          audioPlayerService.syncUpcomingPreload();
        }
      } catch (err) {
        console.warn("[Queue Refill] Failed to fetch autoplay tracks:", err);
      } finally {
        dispatch(setIsRefilling(false));
        inFlightRefillPromise = null;
      }
    })();

    return inFlightRefillPromise;
  };

// Wire audioPlayerService auto-advance on natural track completion
audioPlayerService.setOnTrackEnd(() => {
  store.dispatch(nextTrack());
});

/**
 * Restores the last active playback state (song, position, and queue) from local storage on app open.
 */
export const loadLastPlaybackState =
  () => async (dispatch: AppDispatch) => {
    try {
      await audioPlayerService.init();
      const saved = await PlayerStore.getLastPlaybackState();
      if (saved?.song) {
        audioPlayerService.suppressAutoPlayOnce();
        audioPlayerService.setLastPlayed(saved.song.id, saved.queueIndex);

        const hydrated = (saved.song as PlayerSong).coverUrl
          ? (saved.song as PlayerSong)
          : mapToPlayerSong(saved.song);

        dispatch(setCurrentSong(hydrated));
        const pos =
          typeof saved.position === "number" && !isNaN(saved.position)
            ? saved.position
            : 0;
        dispatch(setCurrentTime(pos));
        if (saved.song.duration) {
          dispatch(setDuration(saved.song.duration));
        }
        dispatch(setIsPlaying(false));

        if (saved.queue && saved.queue.length > 0) {
          dispatch(
            setQueue({
              queue: saved.queue,
              index: typeof saved.queueIndex === "number" ? saved.queueIndex : 0,
            })
          );
        } else {
          dispatch(setQueue({ queue: [saved.song], index: 0 }));
        }
        logQueueSnapshot(
          "loadLastPlaybackState (Restored)",
          saved.queue || [saved.song],
          typeof saved.queueIndex === "number" ? saved.queueIndex : 0,
          hydrated
        );
        audioPlayerService.syncUpcomingPreload();
      }
    } catch (err) {
      console.warn("[PlayerStore] Failed to restore playback state:", err);
    }
  };
