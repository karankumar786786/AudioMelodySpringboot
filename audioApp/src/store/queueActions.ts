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
} from "./queueSlice";
import { audioPlayerService } from "@/service/audioPlayerService";
import { homeService } from "@/service/homeService";

let inFlightRefillPromise: Promise<void> | null = null;

/**
 * Replace entire queue and start playback from the first track.
 */
export const playAll =
  (songs: Song[], startPlaying = true) =>
  async (dispatch: AppDispatch, getState: () => AppState) => {
    if (!songs || songs.length === 0) return;

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

    dispatch(setQueue({ queue: queueToPlay, index: 0 }));

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

    const deduped = dedupeBySongId(songs);
    const safeIndex = Math.min(Math.max(0, startIndex), deduped.length - 1);
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

    if (startPlaying && queueToPlay[playIndex]) {
      await audioPlayerService.play(queueToPlay[playIndex]);
    }

    if (queueToPlay.length - (playIndex + 1) <= 2) {
      dispatch(refillQueue(false));
    }
  };

/**
 * Play an individual song immediately.
 */
export const playSong =
  (song: Song | PlayerSong) =>
  async (dispatch: AppDispatch, getState: () => AppState) => {
    const state = getState().queue;
    const mapped = mapToPlayerSong(song);

    // Check if song already exists in upcoming or queue
    let idx = state.queue.findIndex(
      (item) => item.queueId === mapped.queueId || item.id === mapped.id,
    );

    if (idx !== -1 && state.queue[idx]) {
      dispatch(setQueue({ queue: state.queue, index: idx }));
      await audioPlayerService.play(state.queue[idx]);
    } else {
      // Insert right after current song
      dispatch(playNextReducer(mapped));
      const nextIndex = Math.max(0, state.lastQueueIndex + 1);
      const updatedQueue = getState().queue.queue;
      const targetSong = updatedQueue[nextIndex] || mapped;
      dispatch(setQueue({ queue: updatedQueue, index: nextIndex }));
      await audioPlayerService.play(targetSong);
    }
  };

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
      const nextSong = updatedState.queue[updatedState.lastQueueIndex];
      if (nextSong) {
        await audioPlayerService.play(nextSong);
      }
    } else if (repeatMode === "all") {
      dispatch(setQueue({ queue, index: 0 }));
      if (queue[0]) {
        await audioPlayerService.play(queue[0]);
      }
    } else {
      // Reached the end with repeat none; trigger refill and continue
      await dispatch(refillQueue(false));
      const postRefillState = getState().queue;
      if (postRefillState.lastQueueIndex + 1 < postRefillState.queue.length) {
        dispatch(advanceToNextTrack());
        const songToPlay = postRefillState.queue[postRefillState.lastQueueIndex];
        if (songToPlay) {
          await audioPlayerService.play(songToPlay);
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
      const prevSong = queue[lastQueueIndex - 1];
      if (prevSong) {
        await audioPlayerService.play(prevSong);
      }
    } else {
      await audioPlayerService.seek(0);
    }
  };

/**
 * Autoplay recommendation engine: refills upcoming queue when low.
 */
export const refillQueue =
  (isInit = false) =>
  async (dispatch: AppDispatch, getState: () => AppState): Promise<void> => {
    if (inFlightRefillPromise) return inFlightRefillPromise;

    const { queue, lastQueueIndex, isRefilling, dislikedSongIds } = getState().queue;
    const remaining = queue.length - (lastQueueIndex + 1);

    if (!isInit && remaining > 3) {
      return;
    }

    inFlightRefillPromise = (async () => {
      try {
        dispatch(setIsRefilling(true));
        console.log(`[Queue Refill] Fetching recommendations / trending tracks for upcoming queue...`);

        const trending = await homeService.getTrendingSongs(15);
        if (!trending || trending.length === 0) return;

        const dislikedSet = new Set(dislikedSongIds);
        const existingIds = new Set(queue.map((s) => s.id));

        // Filter out already enqueued and disliked songs
        const freshSongs = trending.filter(
          (s) => !existingIds.has(s.id) && !dislikedSet.has(s.id),
        );

        if (freshSongs.length > 0) {
          const mapped = freshSongs.map((s) => mapToPlayerSong(s));
          dispatch(addToQueue(mapped));
          console.log(`[Queue Refill] Successfully appended ${mapped.length} new tracks to queue.`);
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
