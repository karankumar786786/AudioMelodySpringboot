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
    playerStore.setState((s) => {
      console.log(`[Queue] Setting queue: ${nextQueue.length} songs`);
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

    playerStore.setState((s) => {
      console.log(
        `[Queue] Replacing queue with ${nextQueue.length} songs from playAll`,
      );
      persistQueue(nextQueue, nextQueue.length > 0 ? 0 : -1);
      return {
        ...s,
        queue: nextQueue,
        currentSong: nextQueue[0] || null,
        lastQueueIndex: nextQueue.length > 0 ? 0 : -1,
      };
    });

    if (startPlaying) {
      import("@/store/player/playback.actions").then(({ playbackActions }) => {
        playbackActions.play(nextQueue[0]);
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
        `[Queue] Enqueued ${uniqueNewSongs.length} songs. Total queue length: ${nextQueue.length}`,
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
      } else if (index === s.lastQueueIndex) {
        nextIndex = Math.min(index, nextQueue.length - 1);
        nextCurrent = nextQueue[nextIndex] || null;
      } else if (s.currentSong?.queueId) {
        const foundIdx = nextQueue.findIndex(
          (song) => song.queueId === s.currentSong?.queueId,
        );

        if (foundIdx >= 0) {
          nextIndex = foundIdx;
          nextCurrent = nextQueue[foundIdx];
        } else if (index < s.lastQueueIndex) {
          nextIndex = Math.max(0, s.lastQueueIndex - 1);
          nextCurrent = nextQueue[nextIndex] || null;
        } else {
          nextIndex = s.lastQueueIndex;
          nextCurrent = nextQueue[nextIndex] || null;
        }
      } else if (index < s.lastQueueIndex) {
        nextIndex = s.lastQueueIndex - 1;
      } else if (index === s.lastQueueIndex) {
        nextIndex = Math.min(index, nextQueue.length - 1);
        nextCurrent = nextQueue[nextIndex] || null;
      }

      persistQueue(nextQueue, nextIndex);

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
      if (s.currentSong?.queueId) {
        const foundIdx = nextQueue.findIndex(
          (song) => song.queueId === s.currentSong?.queueId,
        );
        if (foundIdx >= 0) nextIndex = foundIdx;
      } else if (s.lastQueueIndex >= 0 && s.lastQueueIndex < nextQueue.length) {
        nextIndex = s.lastQueueIndex;
      }

      persistQueue(nextQueue, nextIndex);

      return {
        ...s,
        queue: nextQueue,
        lastQueueIndex: nextIndex,
        currentSong: nextIndex >= 0 ? nextQueue[nextIndex] || null : null,
      };
    });
  },

  /**
    * Refills the queue with recommended/trending songs.
    * Used as a bootstrap when the queue is empty, or as a manual fallback.
    * Duplicates are filtered out to avoid replaying the same song.
   */
  refillQueue: async (isInit = false) => {
    const { queue, currentSong, systemUser, isRefilling, lastQueueIndex } =
      playerStore.state;
    if (isRefilling) return;

    // Calculate remaining songs ahead of the current position
    const remaining = queue.length - (lastQueueIndex + 1);

    // Don't refill if we have enough songs ahead (unless it's an init call)
    if (!isInit && remaining > 2) return;

    try {
      playerStore.setState((s) => ({ ...s, isRefilling: true }));
      let res: any;
      if (systemUser?.id) {
        try {
          res = await musicApi.interactions.getRecommendations();
          // If recommendation is empty, fallback to trending
          const data = res?.data?.data || res?.data;
          if (!data || (Array.isArray(data) && data.length === 0)) {
            res = await musicApi.interactions.getTrending(1, 2);
          }
        } catch (err) {
          res = await musicApi.interactions.getTrending(1, 2);
        }
      } else {
        res = await musicApi.interactions.getTrending(1, 2);
      }

      if (res?.success && res?.data) {
        const rawData = Array.isArray(res.data)
          ? res.data
          : res.data.data || [];
        const newSongs = mapListToPlayerSongs(rawData);
        // Strictly filter against current queue to ensure uniqueness
        const { queue: latestQueue } = playerStore.state;
        const existingIds = new Set(latestQueue.map((s) => s.id));
        // Also exclude currently playing song
        if (currentSong?.id) existingIds.add(currentSong.id);
        const uniqueNewSongs = newSongs.filter((s) => !existingIds.has(s.id));

        console.log(
          `[Queue] API returned ${newSongs.length} songs. ${uniqueNewSongs.length} are unique and new.`,
        );

        if (uniqueNewSongs.length > 0) {
          playerStore.setState((s) => {
            let updatedQueue = [...s.queue, ...uniqueNewSongs];
            let updatedIdx = s.lastQueueIndex;

            // Prune history if it grows too large (keep only 20 previous songs)
            if (updatedIdx > 50) {
              const toRemove = updatedIdx - 20;
              updatedQueue = updatedQueue.slice(toRemove);
              updatedIdx = 20;
              console.log(`[Queue] Pruned ${toRemove} old songs from history.`);
            }

            console.log(
              `[Queue] APPENDED ${uniqueNewSongs.length} songs. New total: ${updatedQueue.length}. Titles: ${uniqueNewSongs.map((s) => s.title).join(", ")}`,
            );
            if (typeof window !== "undefined") {
              localStorage.setItem("last_queue", JSON.stringify(updatedQueue));
            }
            return { ...s, queue: updatedQueue, lastQueueIndex: updatedIdx };
          });

          if (isInit && !currentSong && uniqueNewSongs.length > 0) {
            import("@/store/player/playback.actions").then(
              ({ playbackActions }) => {
                playbackActions.play(uniqueNewSongs[0]);
                playbackActions.setIsPlaying(false);
              },
            );
          }
        } else if (newSongs.length === 0) {
          // API returned no songs at all — nothing we can do
          console.warn("[Queue] API returned 0 songs. Queue may be exhausted.");
        }
      }
    } catch (err) {
      console.error("[PlayerStore] Refill failed:", err);
    } finally {
      playerStore.setState((s) => ({ ...s, isRefilling: false }));
    }
  },

  clearQueue: () => {
    playerStore.setState((s) => {
      console.log("[Queue] Clearing queue and stopping playback...");
      if (typeof window !== "undefined") {
        localStorage.removeItem("last_queue");
        localStorage.removeItem("last_queue_index");
      }
      return {
        ...s,
        queue: [],
        lastQueueIndex: -1,
        currentSong: null,
        isPlaying: false,
        currentTime: 0,
        duration: 0,
        qualityTracks: [],
      };
    });
  },

  initQueue: async () => {
    const { queue } = playerStore.state;
    if (queue.length === 0) {
      await queueActions.refillQueue(true);
    }
  },

  /**
   * Advances to the next song in the queue.
   * After playing, the song is effectively "consumed" by advancing the index.
   * If only 2 songs remain ahead, triggers a refill from recommendations.
   * If queue is exhausted and no repeat mode, tries to refill before stopping.
   */
  next: () => {
    const { queue, lastQueueIndex, isShuffle, repeatMode, currentSong } =
      playerStore.state;

    // Edge case: empty queue — try to refill
    if (queue.length === 0) {
      console.log("[Queue] Queue empty on next(). Attempting refill...");
      queueActions.refillQueue().then(() => {
        const { queue: refilled } = playerStore.state;
        if (refilled.length > 0) {
          import("@/store/player/playback.actions").then(
            ({ playbackActions }) => {
              playbackActions.play(refilled[0]);
            },
          );
        }
      });
      return;
    }

    // Repeat one: replay current song
    if (repeatMode === "one" && currentSong) {
      import("@/store/player/playback.actions").then(({ playbackActions }) =>
        playbackActions.play(currentSong),
      );
      return;
    }

    let nextIdx = lastQueueIndex + 1;
    if (isShuffle) {
      // Improved shuffle: pick from songs AHEAD in the queue to avoid replaying old songs
      const aheadIndices = Array.from(
        { length: queue.length },
        (_, i) => i,
      ).filter((i) => i > lastQueueIndex && i !== lastQueueIndex);

      if (aheadIndices.length > 0) {
        nextIdx = aheadIndices[Math.floor(Math.random() * aheadIndices.length)];
      } else {
        // No songs ahead; if repeat all, pick from whole queue
        if (repeatMode === "all") {
          const allIndices = Array.from(
            { length: queue.length },
            (_, i) => i,
          ).filter((i) => i !== lastQueueIndex);
          if (allIndices.length > 0) {
            nextIdx = allIndices[Math.floor(Math.random() * allIndices.length)];
          } else {
            nextIdx = 0;
          }
        } else {
          // No songs ahead and no repeat — try to refill
          nextIdx = queue.length; // Will trigger the refill logic below
        }
      }
    }

    if (nextIdx < queue.length) {
      persistQueue(queue, nextIdx);
      import("@/store/player/playback.actions").then(({ playbackActions }) =>
        playbackActions.play(queue[nextIdx]),
      );
    } else if (repeatMode === "all") {
      // Wrap around to beginning
      persistQueue(queue, 0);
      import("@/store/player/playback.actions").then(({ playbackActions }) =>
        playbackActions.play(queue[0]),
      );
    } else {
      console.log("[Queue] Queue exhausted. Stopping playback.");
      import("@/store/player/playback.actions").then(({ playbackActions }) =>
        playbackActions.setIsPlaying(false),
      );
    }
  },

  previous: () => {
    const { queue, lastQueueIndex, currentTime } = playerStore.state;
    // If more than 3 seconds into the song, restart it
    if (currentTime > 3) {
      import("@/store/player/playback.actions").then(({ playbackActions }) =>
        playbackActions.setCurrentTime(0),
      );
      return;
    }

    const prevIdx = lastQueueIndex - 1;
    if (prevIdx >= 0) {
      persistQueue(queue, prevIdx);
      import("@/store/player/playback.actions").then(({ playbackActions }) =>
        playbackActions.play(queue[prevIdx]),
      );
    } else if (queue.length > 0) {
      // At the beginning of the queue, restart the current song
      import("@/store/player/playback.actions").then(({ playbackActions }) =>
        playbackActions.setCurrentTime(0),
      );
    }
  },
};
