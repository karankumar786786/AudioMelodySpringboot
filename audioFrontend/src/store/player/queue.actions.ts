import { playerStore } from "./index";
import { musicApi } from "@/lib/api";
import { mapListToPlayerSongs, type PlayerSong } from "@/lib/player-utils";

export const queueActions = {
  setQueue: (songs: PlayerSong[]) => {
    playerStore.setState((s) => {
      if (typeof window !== "undefined") {
        localStorage.setItem("last_queue", JSON.stringify(songs));
      }
      console.log(`[Queue] Setting queue: ${songs.length} songs`);
      return { ...s, queue: songs, lastQueueIndex: -1 };
    });
  },

  playAll: (songs: PlayerSong[], startPlaying = true) => {
    if (songs.length === 0) return;

    playerStore.setState((s) => {
      const currentIdx = s.lastQueueIndex;
      const existingIds = new Set(s.queue.map((sq) => sq.id));
      const uniqueNewSongs = songs.filter((ns) => !existingIds.has(ns.id));

      if (uniqueNewSongs.length === 0 && songs.length > 0) {
        console.log(
          "[Queue] All songs in playAll are already in queue. Skipping append.",
        );
        return s;
      }

      const newQueue = [...s.queue];
      newQueue.splice(currentIdx + 1, 0, ...uniqueNewSongs);

      if (typeof window !== "undefined") {
        localStorage.setItem("last_queue", JSON.stringify(newQueue));
      }

      console.log(
        `[Queue] Added ${songs.length} songs to queue after current. New total: ${newQueue.length}`,
      );
      return { ...s, queue: newQueue };
    });

    if (startPlaying) {
      import("@/store/player/playback.actions").then(({ playbackActions }) => {
        playbackActions.play(songs[0]);
      });
    }
  },

  /**
   * Refills the internal queue with recommended/trending songs.
   * Called automatically when:
   * - Queue is initialized empty (isInit=true)
   * - Remaining songs in queue drop to ≤2 (after playing or skipping)
   *
   * The queue acts as a FIFO-like buffer:
   * - Songs are appended at the end
   * - Old played songs are pruned when queue grows too large
   * - Duplicates are filtered out to avoid replaying the same song
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
    } else {
      // Even if queue has songs, check if we need more
      const { lastQueueIndex } = playerStore.state;
      const remaining = queue.length - (lastQueueIndex + 1);
      if (remaining <= 2) {
        await queueActions.refillQueue();
      }
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
      if (typeof window !== "undefined") {
        localStorage.setItem("last_queue_index", nextIdx.toString());
      }
      import("@/store/player/playback.actions").then(({ playbackActions }) =>
        playbackActions.play(queue[nextIdx]),
      );

      // Check if we need to refill: 2 or fewer songs remaining after this one
      const remaining = queue.length - (nextIdx + 1);
      if (remaining <= 2) {
        console.log(
          `[Queue] Only ${remaining} songs remaining after current. Triggering refill...`,
        );
        queueActions.refillQueue();
      }
    } else if (repeatMode === "all") {
      // Wrap around to beginning
      if (typeof window !== "undefined") {
        localStorage.setItem("last_queue_index", "0");
      }
      import("@/store/player/playback.actions").then(({ playbackActions }) =>
        playbackActions.play(queue[0]),
      );
    } else {
      // Queue exhausted, no repeat — try to fetch more songs before stopping
      console.log(
        "[Queue] Queue exhausted. Attempting to refill before stopping...",
      );
      queueActions.refillQueue().then(() => {
        const { queue: refreshed, lastQueueIndex: currentIdx } =
          playerStore.state;
        const nextAvailable = currentIdx + 1;
        if (nextAvailable < refreshed.length) {
          if (typeof window !== "undefined") {
            localStorage.setItem("last_queue_index", nextAvailable.toString());
          }
          import("@/store/player/playback.actions").then(
            ({ playbackActions }) =>
              playbackActions.play(refreshed[nextAvailable]),
          );
        } else {
          // Truly exhausted
          console.log("[Queue] No more songs available. Stopping playback.");
          import("@/store/player/playback.actions").then(
            ({ playbackActions }) => playbackActions.setIsPlaying(false),
          );
        }
      });
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
      if (typeof window !== "undefined") {
        localStorage.setItem("last_queue_index", prevIdx.toString());
      }
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
