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
  dislikeSong,
  toggleDislikeSong,
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
import { interactionService } from "@/service/interactionService";
import { similarityService } from "@/service/similarityService";
import { userProgressService } from "@/service/userProgressService";

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
    // Tell the service the new current song BEFORE the queue changes so its
    // store subscription does not start a second, duplicate playback.
    audioPlayerService.setLastPlayed(deduped[0].id, 0);

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

    audioPlayerService.setLastPlayed(deduped[safeIndex].id, safeIndex);

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
 * Play a clicked song immediately and populate the upcoming queue with genuinely
 * similar songs evaluated on genre, artist, album, tempo/BPM, danceability, and energy.
 */
export const playWithSimilarSongs =
  (song: Song | PlayerSong, contextPool?: Song[]) =>
  async (dispatch: AppDispatch, getState: () => AppState) => {
    if (!song) return;

    const { currentSong, isPlaying } = getState().player;
    if (currentSong?.id === song.id) {
      if (isPlaying) return;
      audioPlayerService.resume();
      return;
    }

    // Initialize queue with the clicked song at index 0
    audioPlayerService.setLastPlayed(song.id, 0);
    dispatch(setQueue({ queue: [song], index: 0 }));
    dispatch(
      startRadioSession({
        seedSongId: song.id,
        seedTitle: song.title,
        seedSong: song,
      })
    );
    logQueueSnapshot("playWithSimilarSongs (Initial 1 Track)", [song], 0, song);

    // Start playback immediately with lazy PlayerSong hydration
    await audioPlayerService.play(song);

    // Asynchronously fetch similar songs evaluated on genre, artist, album, tempo & energy
    try {
      const state = getState();
      const user =
        state.user.profile?.id || state.device.deviceId || "anonymous";

      const similarSongs = await similarityService.findSimilarSongs(song, {
        count: 15,
        excludeIds: [song.id],
        contextPool,
        dislikedSongIds: state.queue.dislikedSongIds,
        targetUserId: user,
      });

      // The user may have started something else while similarity was loading
      if (getState().queue.queue[0]?.id !== song.id) return;

      const dislikedSet = new Set(getState().queue.dislikedSongIds);
      const filteredSimilar = similarSongs.filter(
        (s) => s.id !== song.id && !dislikedSet.has(s.id)
      );

      if (filteredSimilar.length > 0) {
        dispatch(addToQueue(filteredSimilar));
        logQueueSnapshot(
          "playWithSimilarSongs (After Similarity Recommendations)",
          getState().queue.queue,
          getState().queue.currentIndex,
          song
        );
        audioPlayerService.syncUpcomingPreload();
        PlayerStore.saveLastQueue(getState().queue.queue, getState().queue.currentIndex);
      }
    } catch (err) {
      console.warn("[Queue] Failed to load similar songs:", err);
    }
  };

export const playSong = playWithSimilarSongs;

/**
 * Enqueue a song to play immediately after the currently playing song.
 */
export const playNext =
  (song: Song | PlayerSong) => (dispatch: AppDispatch, getState: () => AppState) => {
    dispatch(playNextReducer(song));
    if (song?.id) {
      interactionService.recordQueueAdd(song.id);
    }
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
    list.forEach((s) => {
      if (s?.id) {
        interactionService.recordQueueAdd(s.id);
      }
    });
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

    const playingSong = queue[currentIndex];

    // Handle repeat mode "one" on auto-finish
    if (repeatMode === "one" && !manualUserAction && playingSong) {
      await audioPlayerService.seek(0);
      audioPlayerService.resume();
      return;
    }

    // Report skip telemetry for the song being skipped (manual user action only)
    if (manualUserAction && playingSong) {
      interactionService.recordSkip(playingSong.id);
      audioPlayerService.markCurrentTrackReported();
    }

    // Trigger refill proactively if nearing end (not needed when looping the queue)
    if (repeatMode !== "all" && queue.length - (currentIndex + 1) <= 2) {
      dispatch(refillQueue(false));
    }

    if (currentIndex < queue.length - 1) {
      const nextIndex = currentIndex + 1;
      const nextSong = queue[nextIndex];
      audioPlayerService.setLastPlayed(nextSong.id, nextIndex);
      dispatch(advanceToNextTrack());
      logQueueSnapshot("nextTrack (Advance)", getState().queue.queue, nextIndex, nextSong);
      await audioPlayerService.play(nextSong, 0, false);
    } else if (repeatMode === "all") {
      const firstSong = queue[0];
      audioPlayerService.setLastPlayed(firstSong.id, 0);
      dispatch(setQueue({ queue, index: 0 }));
      logQueueSnapshot("nextTrack (Loop All to Start)", queue, 0, firstSong);
      await audioPlayerService.play(firstSong, 0, false);
    } else {
      // Reached the end with repeat none; try refill
      await dispatch(refillQueue(false));
      const post = getState().queue;
      if (post.currentIndex < post.queue.length - 1) {
        const nextIdx = post.currentIndex + 1;
        const songAhead = post.queue[nextIdx];
        audioPlayerService.setLastPlayed(songAhead.id, nextIdx);
        dispatch(advanceToNextTrack());
        logQueueSnapshot("nextTrack (After Refill Advance)", getState().queue.queue, nextIdx, songAhead);
        await audioPlayerService.play(songAhead, 0, false);
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
  (forceSkip = false) =>
  async (dispatch: AppDispatch, getState: () => AppState) => {
    const currentTime = audioPlayerService.getCurrentTime();

    if (!forceSkip && currentTime > 3) {
      console.log(`[Queue:prevTrack] Current time is ${currentTime.toFixed(1)}s (> 3s), restarting current track.`);
      await audioPlayerService.seek(0);
      return;
    }

    const { currentIndex, queue } = getState().queue;
    if (currentIndex > 0) {
      // Report skip telemetry for the song being skipped backward
      const currentSong = queue[currentIndex];
      if (currentSong) {
        interactionService.recordSkip(currentSong.id);
        audioPlayerService.markCurrentTrackReported();
      }

      const prevIndex = currentIndex - 1;
      const prevSong = queue[prevIndex];
      if (prevSong) {
        audioPlayerService.setLastPlayed(prevSong.id, prevIndex);
      }

      dispatch(retreatToPrevTrack());
      const updated = getState().queue;
      const songToPlay = selectCurrentSongFromQueue(updated);
      logQueueSnapshot("prevTrack (Retreat)", updated.queue, updated.currentIndex, songToPlay);
      if (songToPlay) {
        await audioPlayerService.play(songToPlay, 0, false);
      }
    } else {
      console.log(`[Queue:prevTrack] Already at index 0, seeking to start.`);
      await audioPlayerService.seek(0);
    }
  };

/**
 * Toggles dislike status for the current song, excludes it from future recommendations,
 * and records negative affinity telemetry without interrupting or skipping playback.
 */
export const dislikeCurrentSong =
  (songIdParam?: string) =>
  async (dispatch: AppDispatch, getState: () => AppState) => {
    const state = getState();
    const songId =
      songIdParam ||
      state.player.currentSong?.id ||
      state.queue.queue[state.queue.currentIndex]?.id;

    if (!songId) return;

    const isCurrentlyDisliked = state.queue.dislikedSongIds?.includes(songId);
    dispatch(toggleDislikeSong(songId));

    if (!isCurrentlyDisliked) {
      await interactionService.recordDislike(songId);
    }
  };

/**
 * Autoplay recommendation engine: refills upcoming queue with similar songs evaluated
 * on genre, artist, album, tempo/BPM, danceability, and energy when queue runs low.
 */
export const refillQueue =
  (isInit = false) =>
  async (dispatch: AppDispatch, getState: () => AppState): Promise<void> => {
    if (inFlightRefillPromise) return inFlightRefillPromise;

    const { queue, currentIndex, dislikedSongIds, radioSession, repeatMode } =
      getState().queue;
    const remaining = queue.length - (currentIndex + 1);

    if (!isInit && remaining > 3) {
      return;
    }
    // Repeat-all loops the existing queue; never pad it with recommendations.
    if (repeatMode === "all") {
      return;
    }

    inFlightRefillPromise = (async () => {
      try {
        dispatch(setIsRefilling(true));
        const currentSong = getState().player.currentSong;
        const seedSong =
          radioSession?.seedSong ||
          currentSong ||
          (currentIndex >= 0 && currentIndex < queue.length
            ? queue[currentIndex]
            : null);

        const user =
          getState().user.profile?.id || getState().device.deviceId || "anonymous";

        let freshSongs: Song[] = [];
        const excludeIds = queue.map((s) => s.id);

        if (seedSong) {
          freshSongs = await similarityService.findSimilarSongs(seedSong, {
            count: 12,
            excludeIds,
            dislikedSongIds,
            targetUserId: user,
          });
        }

        // Secondary fallback only if similarity returned nothing
        if (!freshSongs || freshSongs.length === 0) {
          const trending = await homeService.getTrendingSongs(15);
          freshSongs = (trending || []).filter((s) => !excludeIds.includes(s.id));
        }

        const dislikedSet = new Set(dislikedSongIds);
        const existingIds = new Set(excludeIds);

        const filtered = freshSongs.filter(
          (s) => !existingIds.has(s.id) && !dislikedSet.has(s.id)
        );

        if (filtered.length > 0) {
          dispatch(addToQueue(filtered));
          logQueueSnapshot("refillQueue (New Tracks Added)", getState().queue.queue, getState().queue.currentIndex);
          audioPlayerService.syncUpcomingPreload();
          PlayerStore.saveLastQueue(getState().queue.queue, getState().queue.currentIndex);
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

// Wire audioPlayerService auto-advance on natural track completion & remote lock screen commands
audioPlayerService.setOnTrackEnd(() => {
  store.dispatch(nextTrack());
});
audioPlayerService.setRemoteCommandHandlers({
  onNext: () => store.dispatch(nextTrack(true)),
  onPrev: () => store.dispatch(prevTrack()),
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
        const restoredQueue =
          saved.queue && saved.queue.length > 0 ? saved.queue : [saved.song];
        let restoredIndex = Math.min(
          Math.max(0, typeof saved.queueIndex === "number" ? saved.queueIndex : 0),
          restoredQueue.length - 1
        );

        const hydrated = (saved.song as PlayerSong).coverUrl
          ? (saved.song as PlayerSong)
          : mapToPlayerSong(saved.song);

        // Align queue index with the actual restored song if present in queue
        const matchingIdx = restoredQueue.findIndex((s) => s.id === hydrated.id);
        if (matchingIdx !== -1) {
          restoredIndex = matchingIdx;
        }

        // Mark the restored song as "already current" so the queue subscription
        // restores state silently instead of auto-playing.
        audioPlayerService.setLastPlayed(
          hydrated.id,
          restoredIndex
        );

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

        dispatch(setQueue({ queue: restoredQueue, index: restoredIndex }));
        dispatch(
          startRadioSession({
            seedSongId: hydrated.id,
            seedTitle: hydrated.title,
            seedSong: hydrated,
          })
        );
        logQueueSnapshot(
          "loadLastPlaybackState (Restored)",
          restoredQueue,
          restoredIndex,
          hydrated
        );
        await audioPlayerService.primeRestoredPlayback(hydrated, pos);
        audioPlayerService.syncUpcomingPreload();

        // If restored queue has few or no upcoming tracks, proactively populate similar songs!
        const upcomingCount = restoredQueue.length - (restoredIndex + 1);
        if (upcomingCount < 3) {
          console.log(
            `[loadLastPlaybackState] Restored queue has only ${upcomingCount} upcoming tracks; proactively refilling queue.`
          );
          (dispatch as any)(refillQueue(true));
        }
      } else {
        // Fallback: check cross-device server resume state from Redis
        try {
          const serverResume = await userProgressService.getResumeState();
          if (serverResume?.song) {
            const hydrated = mapToPlayerSong(serverResume.song);
            audioPlayerService.setLastPlayed(hydrated.id, 0);
            dispatch(setCurrentSong(hydrated));
            const resumePos = typeof serverResume.currentTime === "number" ? serverResume.currentTime : 0;
            dispatch(setCurrentTime(resumePos));
            if (serverResume.duration) {
              dispatch(setDuration(serverResume.duration));
            }
            dispatch(setIsPlaying(false));
            dispatch(setQueue({ queue: [hydrated], index: 0 }));
            await audioPlayerService.primeRestoredPlayback(hydrated, resumePos);
          }
        } catch {}
      }
    } catch (err) {
      console.warn("[PlayerStore] Failed to restore playback state:", err);
    }
  };