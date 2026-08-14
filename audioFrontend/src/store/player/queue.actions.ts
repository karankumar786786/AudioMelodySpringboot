import { playerStore } from "./index";
import { musicApi } from "@/lib/api";
import { mapListToPlayerSongs, type PlayerSong } from "@/lib/player-utils";

const persistQueue = (queue: PlayerSong[], currentIndex: number) => {
  if (typeof window === "undefined") return;
  localStorage.setItem("last_queue", JSON.stringify(queue));
  localStorage.setItem("last_queue_index", currentIndex.toString());
};

const dedupeBySongId = (songs: PlayerSong[]) => {
  const seen = new Set<string>();
  return songs.filter((song) => {
    if (seen.has(song.id)) return false;
    seen.add(song.id);
    return true;
  });
};

export const queueActions = {
  setQueue: (songs: PlayerSong[]) => {
    const nextQueue = dedupeBySongId(songs);
    const nextIndex = nextQueue.length > 0 ? 0 : -1;
    console.log(`[Queue] setQueue: ${nextQueue.length} songs`);
    playerStore.setState((s) => {
      persistQueue(nextQueue, nextIndex);
      return {
        ...s,
        queue: nextQueue,
        currentSong: nextQueue[0] || null,
        lastQueueIndex: nextIndex,
      };
    });
  },

  playAll: (songs: PlayerSong[], startPlaying = true) => {
    if (songs.length === 0) return;
    const nextQueue = dedupeBySongId(songs);
    console.log(`[Queue] playAll: ${nextQueue.length} songs`);
    playerStore.setState((s) => {
      persistQueue(nextQueue, 0);
      return {
        ...s,
        queue: nextQueue,
        currentSong: nextQueue[0] || null,
        lastQueueIndex: 0,
      };
    });

    if (startPlaying && nextQueue[0]) {
      import("@/store/player/playback.actions").then(({ playbackActions }) => {
        playbackActions.play(nextQueue[0]);
      });
    }
  },

  playAllFrom: (songs: PlayerSong[], startIndex: number, startPlaying = true) => {
    if (songs.length === 0) return;
    const nextQueue = dedupeBySongId(songs);
    const safeIndex = Math.min(Math.max(0, startIndex), nextQueue.length - 1);
    console.log(
      `[Queue] playAllFrom: ${nextQueue.length} songs, starting at index ${safeIndex}`,
    );

    playerStore.setState((s) => {
      persistQueue(nextQueue, safeIndex);
      return {
        ...s,
        queue: nextQueue,
        currentSong: nextQueue[safeIndex] || null,
        lastQueueIndex: safeIndex,
      };
    });

    if (startPlaying && nextQueue[safeIndex]) {
      import("@/store/player/playback.actions").then(({ playbackActions }) => {
        playbackActions.play(nextQueue[safeIndex]);
      });
    }
  },

  enqueue: (songs: PlayerSong[]) => {
    if (songs.length === 0) return;

    playerStore.setState((s) => {
      const existingIds = new Set(s.queue.map((item) => item.id));
      const uniqueNewSongs = songs.filter((song) => !existingIds.has(song.id));
      if (uniqueNewSongs.length === 0) return s;

      const nextQueue = [...s.queue, ...uniqueNewSongs];
      persistQueue(nextQueue, s.lastQueueIndex);
      console.log(
        `[Queue] Enqueued ${uniqueNewSongs.length} songs. Total: ${nextQueue.length}`,
      );

      return {
        ...s,
        queue: nextQueue,
      };
    });
  },

  playQueueItem: (index: number) => {
    const { queue } = playerStore.state;
    if (index < 0 || index >= queue.length) return;

    console.log(`[Queue] playQueueItem: playing song at index ${index}`);
    import("@/store/player/playback.actions").then(({ playbackActions }) => {
      playbackActions.play(queue[index]);
    });
  },

  removeFromQueue: (index: number) => {
    playerStore.setState((s) => {
      if (index < 0 || index >= s.queue.length) return s;

      const nextQueue = [...s.queue];
      nextQueue.splice(index, 1);

      let nextIndex = s.lastQueueIndex;
      let nextCurrent = s.currentSong;
      let isPlaying = s.isPlaying;

      if (nextQueue.length === 0) {
        nextIndex = -1;
        nextCurrent = null;
        isPlaying = false;
      } else if (index < s.lastQueueIndex) {
        nextIndex = Math.max(0, s.lastQueueIndex - 1);
        nextCurrent = nextQueue[nextIndex] || null;
      } else if (index === s.lastQueueIndex) {
        nextIndex = Math.min(index, nextQueue.length - 1);
        nextCurrent = nextQueue[nextIndex] || null;
      }

      persistQueue(nextQueue, nextIndex);
      console.log(`[Queue] Removed item at index ${index}. Remaining: ${nextQueue.length}`);

      return {
        ...s,
        queue: nextQueue,
        currentSong: nextCurrent,
        lastQueueIndex: nextIndex,
        isPlaying,
      };
    });
  },

  moveQueueItem: (fromIndex: number, toIndex: number) => {
    playerStore.setState((s) => {
      if (
        fromIndex < 0 ||
        fromIndex >= s.queue.length ||
        toIndex < 0 ||
        toIndex >= s.queue.length ||
        fromIndex === toIndex
      ) {
        return s;
      }

      const nextQueue = [...s.queue];
      const [item] = nextQueue.splice(fromIndex, 1);
      nextQueue.splice(toIndex, 0, item);

      let nextIndex = s.lastQueueIndex;
      if (fromIndex === s.lastQueueIndex) {
        nextIndex = toIndex;
      } else if (fromIndex < s.lastQueueIndex && toIndex >= s.lastQueueIndex) {
        nextIndex = s.lastQueueIndex - 1;
      } else if (fromIndex > s.lastQueueIndex && toIndex <= s.lastQueueIndex) {
        nextIndex = s.lastQueueIndex + 1;
      }

      persistQueue(nextQueue, nextIndex);
      return {
        ...s,
        queue: nextQueue,
        lastQueueIndex: nextIndex,
        currentSong: nextQueue[nextIndex] || null,
      };
    });
  },

  /**
   * Refills the queue with recommended or trending songs.
   * Logs details of trigger reason, API call, and fetched catalog size for debugging.
   */
  refillQueue: async (isInit = false, reason = "Auto-refill") => {
    const { queue, currentSong, systemUser, isRefilling, lastQueueIndex } =
      playerStore.state;

    if (isRefilling) {
      console.log(`[Queue Refill] Refill already in progress. Skipping trigger (Reason: ${reason}).`);
      return;
    }

    const remaining = queue.length - (lastQueueIndex + 1);
    if (!isInit && remaining > 2) {
      console.log(`[Queue Refill] ${remaining} songs remaining ahead. Skipping refill.`);
      return;
    }

    try {
      playerStore.setState((s) => ({ ...s, isRefilling: true }));
      const isLoggedIn = Boolean(systemUser?.id);

      console.group(`🎵 [Queue Refill Triggered] Reason: ${reason}`);
      console.log(`📊 Queue status: ${queue.length} total songs | Current index: ${lastQueueIndex} | Remaining ahead: ${Math.max(0, remaining)}`);
      console.log(`👤 User authentication: ${isLoggedIn ? `Logged in (${systemUser.name || systemUser.email || systemUser.id})` : "Unauthenticated (Guest)"}`);

      let res: any;
      if (isLoggedIn) {
        try {
          console.log("📡 Endpoint: Requesting recommendations from GET /api/recommendations/user...");
          res = await musicApi.interactions.getRecommendations();
          const data = res?.data?.data || res?.data;
          if (!data || (Array.isArray(data) && data.length === 0)) {
            console.log("⚠️ Recommendations returned 0 tracks. Fallback: Requesting trending songs from GET /api/songs...");
            res = await musicApi.interactions.getTrending(1, 20);
          }
        } catch (err) {
          console.warn("⚠️ Recommendations request failed. Fallback: Requesting trending songs from GET /api/songs...", err);
          res = await musicApi.interactions.getTrending(1, 20);
        }
      } else {
        console.log("📡 Endpoint: Requesting trending songs for guest user from GET /api/songs...");
        res = await musicApi.interactions.getTrending(1, 20);
      }

      if (res?.data) {
        const rawData = Array.isArray(res.data)
          ? res.data
          : res.data.data || [];
        
        console.log(`🎵 [FETCH SUMMARY] Raw songs fetched from API: ${rawData.length} tracks.`);
        if (rawData.length === 0) {
          console.warn("⚠️ [FETCH EMPTY]: API returned 0 songs from backend! Backend database catalog or recommendations engine returned no available tracks.");
        } else {
          console.log(`📋 [FETCHED SONGS LIST]:`, rawData.map((s: any) => `"${s.title || s.name}" by ${s.artistName || s.artist?.name || "Unknown"}`));
        }

        const newSongs = mapListToPlayerSongs(rawData);
        const { queue: latestQueue } = playerStore.state;
        const existingIds = new Set(latestQueue.map((s) => s.id));
        if (currentSong?.id) existingIds.add(currentSong.id);

        const uniqueNewSongs = newSongs.filter((s) => !existingIds.has(s.id));
        console.log(`✨ [UNIQUE FILTERED]: ${uniqueNewSongs.length} new songs added to queue (filtered out ${newSongs.length - uniqueNewSongs.length} duplicates).`);

        if (uniqueNewSongs.length > 0) {
          playerStore.setState((s) => {
            const updatedQueue = [...s.queue, ...uniqueNewSongs];
            console.log(`📈 [QUEUE SIZE UPDATE]: Previous: ${s.queue.length} songs ➔ New total: ${updatedQueue.length} songs.`);
            persistQueue(updatedQueue, s.lastQueueIndex);
            return { ...s, queue: updatedQueue };
          });

          // If no song is loaded in player, set first song as current (without auto-playing)
          const { currentSong: activeSong } = playerStore.state;
          if (!activeSong && uniqueNewSongs.length > 0) {
            console.log(`▶️ [PLAYER LOAD]: Auto-loading first song into player bar: "${uniqueNewSongs[0].title}"`);
            playerStore.setState((s) => ({
              ...s,
              currentSong: uniqueNewSongs[0],
              lastQueueIndex: 0,
              isPlaying: false,
            }));
            persistQueue(playerStore.state.queue, 0);
          }
        } else {
          console.warn(`⚠️ [CATALOG WARNING]: API returned ${newSongs.length} tracks, but all of them are already in your queue! (Catalog may be small or recommendations returned already-queued tracks).`);
        }
      } else {
        console.warn("⚠️ API response received but contains no data array.", res);
      }
      console.groupEnd();
    } catch (err) {
      console.error("❌ Exception during queue refill:", err);
      console.groupEnd();
    } finally {
      playerStore.setState((s) => ({ ...s, isRefilling: false }));
    }
  },

  clearQueue: () => {
    console.log("[Queue] Clearing queue...");
    if (typeof window !== "undefined") {
      localStorage.removeItem("last_queue");
      localStorage.removeItem("last_queue_index");
    }
    playerStore.setState((s) => ({
      ...s,
      queue: [],
      lastQueueIndex: -1,
      currentSong: null,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      qualityTracks: [],
    }));
  },

  initQueue: async () => {
    const { queue } = playerStore.state;
    if (queue.length === 0) {
      await queueActions.refillQueue(true, "App initialisation (empty queue)");
    }
  },

  /**
   * Advances to the next song in the queue.
   */
  next: () => {
    const { queue, lastQueueIndex, isShuffle, repeatMode, currentSong } =
      playerStore.state;

    console.log(`[Queue Next] Current Index: ${lastQueueIndex}, Queue Length: ${queue.length}, Repeat: ${repeatMode}, Shuffle: ${isShuffle}`);

    // If queue is empty, attempt refill
    if (queue.length === 0) {
      console.log("[Queue Next] Queue is empty. Triggering refill...");
      queueActions.refillQueue(false, "next() called on empty queue").then(() => {
        const { queue: refilled } = playerStore.state;
        if (refilled.length > 0) {
          import("@/store/player/playback.actions").then(({ playbackActions }) => {
            playbackActions.play(refilled[0]);
          });
        }
      });
      return;
    }

    // Repeat one mode: replay current song
    if (repeatMode === "one" && currentSong) {
      console.log("[Queue Next] Repeat Mode is 'one'. Replaying current song.");
      import("@/store/player/playback.actions").then(({ playbackActions }) =>
        playbackActions.play(currentSong),
      );
      return;
    }

    let nextIdx = lastQueueIndex + 1;

    if (isShuffle) {
      // Pick random song from remaining ahead in queue
      const aheadIndices = Array.from({ length: queue.length }, (_, i) => i).filter(
        (i) => i > lastQueueIndex,
      );

      if (aheadIndices.length > 0) {
        nextIdx = aheadIndices[Math.floor(Math.random() * aheadIndices.length)];
      } else if (repeatMode === "all") {
        nextIdx = Math.floor(Math.random() * queue.length);
      } else {
        nextIdx = queue.length; // triggers end-of-queue refill check
      }
    }

    if (nextIdx < queue.length) {
      console.log(`[Queue Next] Advancing to song index ${nextIdx}: "${queue[nextIdx].title}"`);
      persistQueue(queue, nextIdx);
      import("@/store/player/playback.actions").then(({ playbackActions }) =>
        playbackActions.play(queue[nextIdx]),
      );

      // Proactively trigger refill if ≤2 songs remain ahead
      const remaining = queue.length - (nextIdx + 1);
      if (remaining <= 2) {
        console.log(`[Queue Next] Only ${remaining} songs remaining ahead. Triggering refill in background.`);
        queueActions.refillQueue(false, `Low queue threshold reached (${remaining} songs left ahead)`);
      }
    } else if (repeatMode === "all" && queue.length > 0) {
      console.log("[Queue Next] Reached end of queue. Repeat Mode is 'all', looping to index 0.");
      persistQueue(queue, 0);
      import("@/store/player/playback.actions").then(({ playbackActions }) =>
        playbackActions.play(queue[0]),
      );
    } else {
      console.log("[Queue Next] Reached end of queue. Attempting refill before stopping...");
      queueActions.refillQueue(false, "End of queue reached").then(() => {
        const { queue: refilled, lastQueueIndex: idx } = playerStore.state;
        if (refilled.length > idx + 1) {
          const nextRefillIdx = idx + 1;
          console.log(`[Queue Next] Refill added songs! Playing next track at index ${nextRefillIdx}: "${refilled[nextRefillIdx].title}"`);
          persistQueue(refilled, nextRefillIdx);
          import("@/store/player/playback.actions").then(({ playbackActions }) => {
            playbackActions.play(refilled[nextRefillIdx]);
          });
        } else {
          console.log("[Queue Next] Refill returned no new tracks. Stopping playback.");
          import("@/store/player/playback.actions").then(({ playbackActions }) =>
            playbackActions.setIsPlaying(false),
          );
        }
      });
    }
  },

  /**
   * Moves back to the previous song in the queue.
   */
  previous: () => {
    const { queue, lastQueueIndex, currentTime } = playerStore.state;

    console.log(`[Queue Prev] Current Index: ${lastQueueIndex}, Time: ${currentTime.toFixed(1)}s`);

    // If more than 3 seconds played, restart the current track
    if (currentTime > 3) {
      console.log("[Queue Prev] >3s played. Restarting current track.");
      import("@/store/player/playback.actions").then(({ playbackActions }) =>
        playbackActions.setCurrentTime(0),
      );
      return;
    }

    const prevIdx = lastQueueIndex - 1;
    if (prevIdx >= 0 && prevIdx < queue.length) {
      console.log(`[Queue Prev] Moving to previous song at index ${prevIdx}: "${queue[prevIdx].title}"`);
      persistQueue(queue, prevIdx);
      import("@/store/player/playback.actions").then(({ playbackActions }) =>
        playbackActions.play(queue[prevIdx]),
      );
    } else if (queue.length > 0 && lastQueueIndex >= 0) {
      console.log("[Queue Prev] Already at start of queue. Restarting track.");
      import("@/store/player/playback.actions").then(({ playbackActions }) =>
        playbackActions.setCurrentTime(0),
      );
    }
  },
};
