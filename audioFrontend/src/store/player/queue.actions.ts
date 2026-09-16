import { playerStore } from "./index";
import { musicApi } from "@/lib/api";
import { mapListToPlayerSongs, type PlayerSong } from "@/lib/player-utils";

const persistQueue = (_queue: PlayerSong[], _currentIndex: number) => {
  // Queue persistence to localStorage is disabled
};

const dedupeBySongId = (songs: PlayerSong[]) => {
  const seen = new Set<string>();
  return songs.filter((song) => {
    if (seen.has(song.id)) return false;
    seen.add(song.id);
    return true;
  });
};

function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Rolling window: keep at most `maxHistory` played songs behind current index.
 * Returns { trimmedQueue, adjustedIndex }.
 */
const MAX_HISTORY = 2;

function applyRollingWindow(
  queue: PlayerSong[],
  currentIndex: number,
): { trimmedQueue: PlayerSong[]; adjustedIndex: number } {
  const historyCount = currentIndex; // songs before current index
  if (historyCount <= MAX_HISTORY) {
    return { trimmedQueue: queue, adjustedIndex: currentIndex };
  }
  const trimCount = historyCount - MAX_HISTORY;
  const trimmedQueue = queue.slice(trimCount);
  const adjustedIndex = currentIndex - trimCount;
  console.log(
    `[Queue RollingWindow] Trimmed ${trimCount} played songs from front. New index: ${adjustedIndex}, Queue length: ${trimmedQueue.length}`,
  );
  return { trimmedQueue, adjustedIndex };
}

let activeRefillPromise: Promise<PlayerSong[]> | null = null;

export const queueActions = {
  setQueue: (songs: PlayerSong[]) => {
    const nextQueue = dedupeBySongId(songs);
    const { isShuffle } = playerStore.state;
    let queueToPlay = nextQueue;
    let originalQueue: PlayerSong[] = [];

    if (isShuffle && nextQueue.length > 1) {
      originalQueue = [...nextQueue];
      const first = nextQueue[0];
      const rest = shuffleArray(nextQueue.slice(1));
      queueToPlay = [first, ...rest];
    }

    const nextIndex = queueToPlay.length > 0 ? 0 : -1;
    console.log(`[Queue] setQueue: ${queueToPlay.length} songs`);
    playerStore.setState((s) => {
      persistQueue(queueToPlay, nextIndex);
      return {
        ...s,
        queue: queueToPlay,
        originalQueue: isShuffle ? originalQueue : [],
        currentSong: queueToPlay[0] || null,
        lastQueueIndex: nextIndex,
        radioSession: {
          seedSongId: null,
          isActive: false,
          sessionHistoryIds: [],
        },
      };
    });
  },

  playAll: (songs: PlayerSong[], startPlaying = true) => {
    if (songs.length === 0) return;
    const nextQueue = dedupeBySongId(songs);
    const { isShuffle } = playerStore.state;

    let queueToPlay = nextQueue;
    let originalQueue: PlayerSong[] = [];

    if (isShuffle && nextQueue.length > 1) {
      originalQueue = [...nextQueue];
      const first = nextQueue[0];
      const rest = shuffleArray(nextQueue.slice(1));
      queueToPlay = [first, ...rest];
    }

    console.log(`[Queue] playAll: ${queueToPlay.length} songs (Shuffle: ${isShuffle})`);
    playerStore.setState((s) => {
      persistQueue(queueToPlay, 0);
      return {
        ...s,
        queue: queueToPlay,
        originalQueue: isShuffle ? originalQueue : [],
        currentSong: queueToPlay[0] || null,
        lastQueueIndex: 0,
        radioSession: {
          seedSongId: null,
          isActive: false,
          sessionHistoryIds: [],
        },
      };
    });

    if (startPlaying && queueToPlay[0]) {
      import("@/store/player/playback.actions").then(({ playbackActions }) => {
        playbackActions.play(queueToPlay[0]);
      });
    }
  },

  playAllFrom: (songs: PlayerSong[], startIndex: number, startPlaying = true) => {
    if (songs.length === 0) return;
    const nextQueue = dedupeBySongId(songs);
    const safeIndex = Math.min(Math.max(0, startIndex), nextQueue.length - 1);
    const { isShuffle } = playerStore.state;

    let queueToPlay = nextQueue;
    let playIndex = safeIndex;
    let originalQueue: PlayerSong[] = [];

    if (isShuffle && nextQueue.length > 1) {
      originalQueue = [...nextQueue];
      const selected = nextQueue[safeIndex];
      const others = nextQueue.filter((_, i) => i !== safeIndex);
      const shuffledOthers = shuffleArray(others);
      queueToPlay = [selected, ...shuffledOthers];
      playIndex = 0;
    }

    console.log(
      `[Queue] playAllFrom: ${queueToPlay.length} songs, starting at index ${playIndex} (Shuffle: ${isShuffle})`,
    );

    playerStore.setState((s) => {
      persistQueue(queueToPlay, playIndex);
      return {
        ...s,
        queue: queueToPlay,
        originalQueue: isShuffle ? originalQueue : [],
        currentSong: queueToPlay[playIndex] || null,
        lastQueueIndex: playIndex,
        radioSession: {
          seedSongId: null,
          isActive: false,
          sessionHistoryIds: [],
        },
      };
    });

    if (startPlaying && queueToPlay[playIndex]) {
      import("@/store/player/playback.actions").then(({ playbackActions }) => {
        playbackActions.play(queueToPlay[playIndex]);
      });
    }
  },

  playWithRadio: (seedSong: PlayerSong) => {
    console.log(`[Queue] Starting Infinite Radio for song: "${seedSong.title}" (${seedSong.id})`);
    const preparedSong: PlayerSong = {
      ...seedSong,
      queueId:
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `${seedSong.id}-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    };

    playerStore.setState((s) => {
      persistQueue([preparedSong], 0);
      return {
        ...s,
        queue: [preparedSong],
        originalQueue: [],
        currentSong: preparedSong,
        lastQueueIndex: 0,
        isPlaying: true,
        isLoading: true,
        currentTime: 0,
        radioSession: {
          seedSongId: seedSong.id,
          seedTitle: seedSong.title,
          isActive: true,
          sessionHistoryIds: [seedSong.id],
        },
      };
    });

    if (typeof window !== "undefined") {
      localStorage.setItem("last_current_time", "0");
      localStorage.setItem("last_current_song", JSON.stringify(preparedSong));
    }

    import("@/store/player/playback.actions").then(({ playbackActions }) => {
      playbackActions.play(preparedSong);
    });

    // Proactively fetch first radio batch for upcoming queue buffer
    setTimeout(() => {
      queueActions.refillQueue(true, "Radio session initialized");
    }, 80);
  },

  enqueue: (songs: PlayerSong[]) => {
    if (songs.length === 0) return;

    playerStore.setState((s) => {
      // Ensure each enqueued song has its own distinct unique queueId
      const preparedSongs: PlayerSong[] = songs.map((song) => ({
        ...song,
        queueId:
          typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : `${song.id}-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      }));

      // Insert immediately after the current song so it is first in the upcoming queue
      const insertIdx = Math.min(Math.max(0, s.lastQueueIndex + 1), s.queue.length);
      const nextQueue = [...s.queue];
      nextQueue.splice(insertIdx, 0, ...preparedSongs);

      const nextOriginal =
        s.originalQueue && s.originalQueue.length > 0
          ? (() => {
              const orig = [...s.originalQueue];
              orig.splice(insertIdx, 0, ...preparedSongs);
              return orig;
            })()
          : [];

      let nextCurrentSong = s.currentSong;
      let nextIndex = s.lastQueueIndex;
      if (!nextCurrentSong && nextQueue.length > 0) {
        nextCurrentSong = nextQueue[0];
        nextIndex = 0;
      }

      persistQueue(nextQueue, nextIndex >= 0 ? nextIndex : 0);
      console.log(
        `[Queue] Enqueued ${preparedSongs.length} songs at upcoming position ${insertIdx}. Total: ${nextQueue.length}`,
      );

      return {
        ...s,
        queue: nextQueue,
        originalQueue: nextOriginal,
        currentSong: nextCurrentSong,
        lastQueueIndex: nextIndex >= 0 ? nextIndex : 0,
      };
    });
  },

  playNext: (song: PlayerSong) => {
    playerStore.setState((s) => {
      const preparedSong: PlayerSong = {
        ...song,
        queueId:
          typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : `${song.id}-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      };

      if (s.queue.length === 0) {
        persistQueue([preparedSong], 0);
        return {
          ...s,
          queue: [preparedSong],
          originalQueue: [],
          currentSong: preparedSong,
          lastQueueIndex: 0,
        };
      }

      const updatedQueue = [...s.queue];
      const insertIdx = Math.min(Math.max(0, s.lastQueueIndex + 1), updatedQueue.length);
      updatedQueue.splice(insertIdx, 0, preparedSong);

      persistQueue(updatedQueue, s.lastQueueIndex);
      console.log(`[Queue] Added "${song.title}" to play next at index ${insertIdx}.`);

      return {
        ...s,
        queue: updatedQueue,
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

      // If reordering upcoming tracks, prevent moving before the currently playing song
      const minUpcomingIdx = Math.max(0, s.lastQueueIndex + 1);
      const safeFrom = fromIndex;
      const safeTo = fromIndex >= minUpcomingIdx ? Math.max(minUpcomingIdx, toIndex) : toIndex;

      if (safeFrom === safeTo) return s;

      const nextQueue = [...s.queue];
      const [item] = nextQueue.splice(safeFrom, 1);
      nextQueue.splice(safeTo, 0, item);

      let nextIndex = s.lastQueueIndex;
      if (safeFrom === s.lastQueueIndex) {
        nextIndex = safeTo;
      } else if (safeFrom < s.lastQueueIndex && safeTo >= s.lastQueueIndex) {
        nextIndex = s.lastQueueIndex - 1;
      } else if (safeFrom > s.lastQueueIndex && safeTo <= s.lastQueueIndex) {
        nextIndex = s.lastQueueIndex + 1;
      }

      persistQueue(nextQueue, nextIndex);
      return {
        ...s,
        queue: nextQueue,
        lastQueueIndex: nextIndex,
        currentSong: nextQueue[nextIndex] || s.currentSong,
      };
    });
  },

  /**
   * Refills the queue with recommended or trending songs.
   * Only considers UPCOMING songs (ahead of current index) when deduping,
   * so previously played songs can cycle back as recommendations.
   */
  refillQueue: async (isInit = false, reason = "Auto-refill"): Promise<PlayerSong[]> => {
    if (activeRefillPromise) {
      console.log(`[Queue Refill] Refill already in progress. Awaiting in-flight promise (Reason: ${reason}).`);
      return activeRefillPromise;
    }

    const { queue, currentSong, systemUser, lastQueueIndex, radioSession } =
      playerStore.state;

    const remaining = queue.length - (lastQueueIndex + 1);
    if (!isInit && remaining > 2 && reason !== "End of queue reached") {
      console.log(`[Queue Refill] ${remaining} songs remaining ahead. Skipping refill.`);
      return [];
    }

    activeRefillPromise = (async () => {
      try {
        playerStore.setState((s) => ({ ...s, isRefilling: true }));
        const isLoggedIn = Boolean(systemUser?.id);
        const isRadioActive = Boolean(radioSession?.isActive && radioSession?.seedSongId);

        console.group(`🎵 [Queue Refill Triggered] Reason: ${reason}`);
        console.log(`📊 Queue status: ${playerStore.state.queue.length} total songs | Current index: ${playerStore.state.lastQueueIndex} | Remaining ahead: ${Math.max(0, remaining)}`);
        console.log(`📻 Radio mode: ${isRadioActive ? `ACTIVE (Seed: ${radioSession?.seedTitle || radioSession?.seedSongId})` : "INACTIVE (Standard recommendations)"}`);
        console.log(`👤 User authentication: ${isLoggedIn ? `Logged in (${systemUser?.name || systemUser?.email || systemUser?.id})` : "Unauthenticated (Guest)"}`);

        let res: any;
        if (isRadioActive) {
          try {
            console.log(`📡 Endpoint: Requesting Radio stream for seed [${radioSession.seedSongId}] with history exclusions...`);
            res = await musicApi.interactions.getRadioSongs(
              radioSession.seedSongId!,
              radioSession.sessionHistoryIds || [],
              10
            );
            const data = res?.data?.data || res?.data;
            if (!data || (Array.isArray(data) && data.length === 0)) {
              console.log("⚠️ Radio stream returned 0 tracks. Fallback: Requesting trending songs from GET /api/songs...");
              res = await musicApi.interactions.getTrending(20);
            }
          } catch (err) {
            console.warn("⚠️ Radio stream request failed. Fallback: Requesting trending songs...", err);
            res = await musicApi.interactions.getTrending(20);
          }
        } else if (isLoggedIn) {
          try {
            console.log("📡 Endpoint: Requesting recommendations from GET /api/recommendations/user...");
            res = await musicApi.interactions.getRecommendations();
            const data = res?.data?.data || res?.data;
            if (!data || (Array.isArray(data) && data.length === 0)) {
              console.log("⚠️ Recommendations returned 0 tracks. Fallback: Requesting trending songs from GET /api/songs...");
              res = await musicApi.interactions.getTrending(20);
            }
          } catch (err) {
            console.warn("⚠️ Recommendations request failed. Fallback: Requesting trending songs from GET /api/songs...", err);
            res = await musicApi.interactions.getTrending(20);
          }
        } else {
          console.log("📡 Endpoint: Requesting trending songs for guest user from GET /api/songs...");
          res = await musicApi.interactions.getTrending(20);
        }

        if (res?.data) {
          const rawData = Array.isArray(res.data)
            ? res.data
            : res.data.data || [];
          
          console.log(`🎵 [FETCH SUMMARY] Raw songs fetched from API: ${rawData.length} tracks.`);
          if (rawData.length === 0) {
            console.warn("⚠️ [FETCH EMPTY]: API returned 0 songs from backend! Backend database catalog returned no available tracks.");
          }

          const newSongs = mapListToPlayerSongs(rawData);
          const { queue: latestQueue, lastQueueIndex: latestIndex, currentSong: activeSong } = playerStore.state;

          // 🔑 KEY FIX: Only exclude UPCOMING songs from dedup, not played ones.
          const upcomingSongs = latestQueue.slice(latestIndex + 1);
          const existingIds = new Set(upcomingSongs.map((s) => s.id));
          if (activeSong?.id) existingIds.add(activeSong.id);

          let uniqueNewSongs = newSongs.filter((s) => !existingIds.has(s.id));

          // If all tracks were duplicates against upcoming, relax dedup to current song only
          if (uniqueNewSongs.length === 0 && newSongs.length > 0) {
            uniqueNewSongs = newSongs.filter((s) => s.id !== activeSong?.id);
          }

          console.log(`✨ [UNIQUE FILTERED]: ${uniqueNewSongs.length} new songs added to queue.`);

          if (uniqueNewSongs.length > 0) {
            playerStore.setState((s) => {
              const updatedQueue = [...s.queue, ...uniqueNewSongs];
              const nextHistory = isRadioActive
                ? Array.from(new Set([...(s.radioSession?.sessionHistoryIds || []), ...uniqueNewSongs.map((song) => song.id)]))
                : s.radioSession?.sessionHistoryIds || [];

              console.log(`📈 [QUEUE SIZE UPDATE]: Previous: ${s.queue.length} songs ➔ New total: ${updatedQueue.length} songs.`);
              persistQueue(updatedQueue, s.lastQueueIndex);
              return {
                ...s,
                queue: updatedQueue,
                radioSession: {
                  ...s.radioSession,
                  sessionHistoryIds: nextHistory,
                },
              };
            });

            // If no song is loaded in player, set first song as current
            const { currentSong: cur } = playerStore.state;
            if (!cur && uniqueNewSongs.length > 0) {
              console.log(`▶️ [PLAYER LOAD]: Auto-loading first song into player bar: "${uniqueNewSongs[0].title}"`);
              playerStore.setState((s) => ({
                ...s,
                currentSong: uniqueNewSongs[0],
                lastQueueIndex: 0,
                isPlaying: false,
              }));
              persistQueue(playerStore.state.queue, 0);
            }
            console.groupEnd();
            return uniqueNewSongs;
          }
        }
        console.groupEnd();
        return [];
      } catch (err) {
        console.error("❌ Exception during queue refill:", err);
        console.groupEnd();
        return [];
      } finally {
        activeRefillPromise = null;
        playerStore.setState((s) => ({ ...s, isRefilling: false }));
      }
    })();

    return activeRefillPromise;
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

  next: (isExplicitSkip = true) => {
    const { queue, lastQueueIndex, repeatMode, currentSong, currentTime, duration } =
      playerStore.state;

    // Only record an explicit skip penalty (-1.0) if the user actively skipped before 75% completion
    const listenRatio = duration > 0 ? currentTime / duration : 0;
    if (isExplicitSkip && currentSong?.id && listenRatio < 0.75) {
      console.log(
        `[Interaction] Recording explicit skip (-1.0) for "${currentSong.title}" (Listened: ${(listenRatio * 100).toFixed(1)}%)`,
      );
      import("@/store/player/playback.actions").then(({ playbackActions }) => {
        playbackActions.recordSkip(currentSong.id);
      });
    }

    console.log(
      `[Queue Next] Current Index: ${lastQueueIndex}, Queue Length: ${queue.length}, Repeat: ${repeatMode}`,
    );

    // If queue is empty, attempt initial refill
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

    const nextIdx = lastQueueIndex + 1;

    // Proactive background refill when within 2 songs of the end
    if (queue.length - (nextIdx + 1) <= 2) {
      queueActions.refillQueue(false, "Proactive background refill near end of queue");
    }

    if (nextIdx < queue.length) {
      console.log(
        `[Queue Next] Advancing to song index ${nextIdx}: "${queue[nextIdx].title}"`,
      );

      // 🔑 Apply rolling window: trim played songs > MAX_HISTORY behind new index
      const { trimmedQueue, adjustedIndex } = applyRollingWindow(queue, nextIdx);

      playerStore.setState((s) => ({
        ...s,
        queue: trimmedQueue,
        lastQueueIndex: adjustedIndex,
      }));

      persistQueue(trimmedQueue, adjustedIndex);
      import("@/store/player/playback.actions").then(({ playbackActions }) =>
        playbackActions.play(trimmedQueue[adjustedIndex]),
      );
    } else if (repeatMode === "all" || repeatMode === "one") {
      console.log(
        "[Queue Next] Reached end of queue. Looping back to start of playlist.",
      );
      if (queue.length > 0) {
        persistQueue(queue, 0);
        import("@/store/player/playback.actions").then(({ playbackActions }) =>
          playbackActions.play(queue[0]),
        );
      }
    } else {
      console.log("[Queue Next] Reached end of queue. Awaiting recommendations/radio refill...");
      // If we weren't in radio mode, promote currentSong to seed the radio for infinite playback!
      if (!playerStore.state.radioSession.isActive && currentSong?.id) {
        console.log(`📻 [Autoplay Promotion] Promoting "${currentSong.title}" as Radio Seed for infinite autoplay.`);
        playerStore.setState((s) => ({
          ...s,
          radioSession: {
            seedSongId: currentSong.id,
            seedTitle: currentSong.title,
            isActive: true,
            sessionHistoryIds: [currentSong.id],
          },
        }));
      }
      queueActions.refillQueue(false, "End of queue reached").then(() => {
        const { queue: updatedQueue, lastQueueIndex: updatedIdx } = playerStore.state;
        const targetIdx = updatedIdx + 1;
        if (targetIdx < updatedQueue.length) {
          console.log(
            `[Queue Next] Auto-playing refilled recommended song at index ${targetIdx}: "${updatedQueue[targetIdx].title}"`,
          );
          const { trimmedQueue, adjustedIndex } = applyRollingWindow(updatedQueue, targetIdx);
          playerStore.setState((s) => ({
            ...s,
            queue: trimmedQueue,
            lastQueueIndex: adjustedIndex,
          }));
          persistQueue(trimmedQueue, adjustedIndex);
          import("@/store/player/playback.actions").then(({ playbackActions }) =>
            playbackActions.play(trimmedQueue[adjustedIndex]),
          );
        } else if (updatedQueue.length > 0) {
          console.log("[Queue Next] Restarting from first song as fallback.");
          persistQueue(updatedQueue, 0);
          import("@/store/player/playback.actions").then(({ playbackActions }) =>
            playbackActions.play(updatedQueue[0]),
          );
        } else {
          console.log("[Queue Next] No new tracks available. Stopping playback.");
          import("@/store/player/playback.actions").then(({ playbackActions }) => {
            playbackActions.setIsPlaying(false);
          });
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
