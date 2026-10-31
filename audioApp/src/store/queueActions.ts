import { AppDispatch, AppState, store } from "./hook";
import { Song, PlayerSong, RepeatMode } from "@/types";
import {
  mapToPlayerSong,
  dedupeBySongId,
  shuffleArray,
} from "@/utils/playerUtils";
import {
  setQueue,
  addToQueue,
  playNextTrack as playNextReducer,
  advanceToNextTrack,
  retreatToPrevTrack,
  setIsRefilling,
  startRadioSession,
  endRadioSession,
} from "./queueSlice";
import {
  setCurrentSong,
  setCurrentTime,
  setDuration,
  setIsPlaying,
} from "./playerSlice";
import { PlayerStore } from "@/storage/PlayerStore";
import { audioPlayerService, type AudioPlayerService } from "@/service/audioPlayerService";
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
        if (isPlaying) {
          return;
        }
        audioPlayerService.resume();
        return;
      }
    }

    const deduped = dedupeBySongId(songs);
    const mapped = deduped.map((s) => mapToPlayerSong(s));
    const { isShuffle } = getState().queue;

    let queueToPlay = mapped;
    let originalQueue: PlayerSong[] = [];

    if (isShuffle && mapped.length > 1) {
      originalQueue = [...mapped];
      const [first, ...rest] = mapped;
      queueToPlay = first ? [first, ...shuffleArray(rest)] : mapped;
    }

    dispatch(endRadioSession());
    dispatch(setQueue({ queue: queueToPlay, index: 0 }));
    PlayerStore.saveLastQueue(queueToPlay, 0);

    if (startPlaying && queueToPlay[0]) {
      await audioPlayerService.play(queueToPlay[0]);
    }

    // Proactive background refill if initial playlist is small
    if (queueToPlay.length <= 3) {
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
        if (isPlaying) {
          // Song is currently playing; don't do anything
          return;
        }
        // Song is paused; resume playback
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
    const mapped = deduped.map((s) => mapToPlayerSong(s));
    const { isShuffle } = getState().queue;

    let queueToPlay = mapped;
    let playIndex = safeIndex;

    if (isShuffle && mapped.length > 1) {
      const selected = mapped[safeIndex];
      const others = mapped.filter((_, i) => i !== safeIndex);
      queueToPlay = selected ? [selected, ...shuffleArray(others)] : mapped;
      playIndex = 0;
    }

    dispatch(setQueue({ queue: queueToPlay, index: playIndex }));
    PlayerStore.saveLastQueue(queueToPlay, playIndex);

    if (startPlaying && queueToPlay[playIndex]) {
      await audioPlayerService.play(queueToPlay[playIndex]);
    }

    if (queueToPlay.length - (playIndex + 1) <= 2) {
      dispatch(refillQueue(false));
    }
  };

/**
 * Play a clicked song immediately and populate the queue with similar songs
 * directly from Recombee (replacing the previous queue, NOT loading subsequent list songs).
 */
export const playWithSimilarSongs =
  (song: Song | PlayerSong) =>
  async (dispatch: AppDispatch, getState: () => AppState) => {
    if (!song) return;

    const { currentSong, isPlaying } = getState().player;
    if (currentSong?.id === song.id) {
      if (isPlaying) {
        // Song is currently playing; don't do anything
        return;
      }
      audioPlayerService.resume();
      return;
    }

    const mapped = mapToPlayerSong(song);

    // 1. Immediately initialize queue with ONLY the clicked song at index 0
    dispatch(setQueue({ queue: [mapped], index: 0 }));
    PlayerStore.saveLastQueue([mapped], 0);
    dispatch(
      startRadioSession({ seedSongId: song.id, seedTitle: song.title })
    );

    // 2. Start audio playback instantly without waiting for network recommendations
    await audioPlayerService.play(mapped);

    // 3. Asynchronously fetch similar songs directly from Recombee based on clicked song ID
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
      const filteredSimilar = similarSongs
        .filter((s) => s.id !== song.id && !dislikedSet.has(s.id))
        .map((s) => mapToPlayerSong(s));

      if (filteredSimilar.length > 0) {
        dispatch(addToQueue(filteredSimilar));
        PlayerStore.saveLastQueue([mapped, ...filteredSimilar], 0);
        audioPlayerService.syncUpcomingPreload();
        console.log(
          `[Queue] Added ${filteredSimilar.length} similar songs from Recombee for "${song.title}"`
        );
      }
    } catch (err) {
      console.warn(
        "[Queue] Failed to load Recombee recommendations for clicked song:",
        err
      );
    }
  };

/**
 * Play an individual song immediately with Recombee recommendations.
 */
export const playSong = playWithSimilarSongs;

/**
 * Enqueue a song to play immediately after the currently playing song.
 */
export const playNext =
  (song: Song | PlayerSong) => (dispatch: AppDispatch) => {
    const mapped = mapToPlayerSong(song);
    dispatch(playNextReducer(mapped));
  };

/**
 * Append one or more songs to the upcoming queue.
 */
export const enqueue =
  (songs: (Song | PlayerSong)[] | (Song | PlayerSong)) =>
  (dispatch: AppDispatch) => {
    const list = Array.isArray(songs) ? songs : [songs];
    const mapped = list.map((s) => mapToPlayerSong(s));
    dispatch(addToQueue(mapped));
  };

/**
 * Advance to the next track in the queue, handling repeat modes and auto-refill.
 */
export const nextTrack =
  (manualUserAction = false) =>
  async (dispatch: AppDispatch, getState: () => AppState) => {
    const { queue, lastQueueIndex, repeatMode } = getState().queue;

    if (queue.length === 0) return;

    // Handle repeat mode "one" on auto-finish
    if (repeatMode === "one" && !manualUserAction && queue[lastQueueIndex]) {
      await audioPlayerService.seek(0);
      audioPlayerService.resume();
      return;
    }

    const nextIndex = lastQueueIndex + 1;

    // Proactive background refill when within 2 songs of the end
    if (queue.length - (nextIndex + 1) <= 2) {
      dispatch(refillQueue(false));
    }

    if (nextIndex < queue.length) {
      dispatch(advanceToNextTrack());
      const updatedState = getState().queue;
      PlayerStore.saveLastQueue(updatedState.queue, updatedState.lastQueueIndex);
      const nextSong = updatedState.queue[updatedState.lastQueueIndex];
      if (nextSong) {
        await audioPlayerService.play(nextSong, 0, false);
      }
    } else if (repeatMode === "all") {
      dispatch(setQueue({ queue, index: 0 }));
      PlayerStore.saveLastQueue(queue, 0);
      if (queue[0]) {
        await audioPlayerService.play(queue[0], 0, false);
      }
    } else {
      // Reached the end with repeat none; trigger refill and continue
      await dispatch(refillQueue(false));
      const postRefillState = getState().queue;
      if (postRefillState.lastQueueIndex + 1 < postRefillState.queue.length) {
        dispatch(advanceToNextTrack());
        const afterAdvance = getState().queue;
        PlayerStore.saveLastQueue(afterAdvance.queue, afterAdvance.lastQueueIndex);
        const songToPlay = afterAdvance.queue[afterAdvance.lastQueueIndex];
        if (songToPlay) {
          await audioPlayerService.play(songToPlay, 0, false);
        }
      } else {
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

    // Industry standard (Spotify / Apple Music): restart song if > 3s in
    if (currentTime > 3) {
      await audioPlayerService.seek(0);
      return;
    }

    const { lastQueueIndex, queue } = getState().queue;
    if (lastQueueIndex > 0) {
      dispatch(retreatToPrevTrack());
      PlayerStore.saveLastQueue(queue, lastQueueIndex - 1);
      const prevSong = queue[lastQueueIndex - 1];
      if (prevSong) {
        await audioPlayerService.play(prevSong, 0, true);
      }
    } else {
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

    const { queue, lastQueueIndex, dislikedSongIds, radioSession } =
      getState().queue;
    const remaining = queue.length - (lastQueueIndex + 1);

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

        console.log(
          `[Queue Refill] Fetching recommendations directly from Recombee (Seed: ${seedId})...`
        );

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

        // Filter out already enqueued and disliked songs
        const freshMapped = freshSongs
          .filter((s) => !existingIds.has(s.id) && !dislikedSet.has(s.id))
          .map((s) => mapToPlayerSong(s));

        if (freshMapped.length > 0) {
          dispatch(addToQueue(freshMapped));
          audioPlayerService.syncUpcomingPreload();
          console.log(
            `[Queue Refill] Successfully appended ${freshMapped.length} new Recombee tracks to queue.`
          );
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
      const saved = await PlayerStore.getLastPlaybackState();
      if (saved?.song) {
        dispatch(setCurrentSong(saved.song));
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
          audioPlayerService.syncUpcomingPreload();
        } else {
          dispatch(setQueue({ queue: [saved.song], index: 0 }));
        }
        console.log(
          `[PlayerStore] Restored last playing song on launch: "${saved.song.title}" (${pos}s)`
        );
      }
    } catch (err) {
      console.warn("[PlayerStore] Failed to restore playback state:", err);
    }
  };
