import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, AppStateStatus } from "react-native";
import { api } from "./baseApi";

interface QueuedTelemetryEvent {
  endpoint: string;
  payload: any;
  timestamp: number;
}

const TELEMETRY_QUEUE_KEY = "audiomelody_telemetry_outbox";
const MAX_QUEUE_SIZE = 60;

let isFlushing = false;
let memoryQueue: QueuedTelemetryEvent[] | null = null;

async function loadQueue(): Promise<QueuedTelemetryEvent[]> {
  if (memoryQueue !== null) return memoryQueue;
  try {
    const raw = await AsyncStorage.getItem(TELEMETRY_QUEUE_KEY);
    memoryQueue = raw ? JSON.parse(raw) : [];
  } catch {
    memoryQueue = [];
  }
  return memoryQueue || [];
}

async function persistQueue(queue: QueuedTelemetryEvent[]): Promise<void> {
  memoryQueue = queue.slice(-MAX_QUEUE_SIZE);
  try {
    await AsyncStorage.setItem(TELEMETRY_QUEUE_KEY, JSON.stringify(memoryQueue));
  } catch {
    // Non-blocking storage error
  }
}

async function queueOfflineEvent(endpoint: string, payload: any): Promise<void> {
  const queue = await loadQueue();
  queue.push({ endpoint, payload, timestamp: Date.now() });
  await persistQueue(queue);
}

export async function flushTelemetryQueue(): Promise<void> {
  if (isFlushing) return;
  const queue = await loadQueue();
  if (!queue || queue.length === 0) return;

  isFlushing = true;
  try {
    const remaining: QueuedTelemetryEvent[] = [];
    for (let i = 0; i < queue.length; i++) {
      const item = queue[i]!;
      try {
        await api.post(item.endpoint, item.payload);
      } catch (err: any) {
        const isNetworkError =
          !err?.response ||
          err?.code === "ERR_NETWORK" ||
          err?.code === "ECONNABORTED" ||
          err?.message?.includes("Network Error");
        if (isNetworkError) {
          // Device still offline or timed out; preserve item and rest of queue for next retry
          remaining.push(...queue.slice(i));
          break;
        }
        // HTTP 4xx/5xx: discard to avoid unresolvable poison pill
      }
    }
    await persistQueue(remaining);
  } finally {
    isFlushing = false;
  }
}

// Automatically flush pending offline telemetry when returning to foreground
if (typeof AppState !== "undefined" && AppState.addEventListener) {
  AppState.addEventListener("change", (status: AppStateStatus) => {
    if (status === "active") {
      flushTelemetryQueue().catch(() => {});
    }
  });
}

/**
 * Sends telemetry to backend, queuing to persistent offline storage if network fails.
 */
async function sendTelemetry(endpoint: string, payload: any): Promise<void> {
  try {
    await api.post(endpoint, payload);
    flushTelemetryQueue().catch(() => {});
  } catch (err: any) {
    const isNetworkError =
      !err?.response ||
      err?.code === "ERR_NETWORK" ||
      err?.code === "ECONNABORTED" ||
      err?.message?.includes("Network Error");
    if (isNetworkError) {
      await queueOfflineEvent(endpoint, payload);
    }
  }
}

/**
 * Interaction Telemetry Service
 *
 * Mirrors the backend InteractionApiController endpoints for mobile telemetry.
 * All methods are resilient and offline-aware: events are queued locally in AsyncStorage
 * during poor connectivity or airplane mode, then flushed automatically on reconnect.
 */
export const interactionService = {
  /**
   * Records a play event with the listen completion percentage.
   * @param songId  — ID of the song that was played
   * @param percentage — 0.0 to 1.0 representing how much of the track was listened to
   */
  async recordPlay(songId: string, percentage: number): Promise<void> {
    if (!songId) return;
    const safePercentage = Math.min(1.0, Math.max(0.0, isNaN(percentage) ? 0.05 : percentage));
    await sendTelemetry("/interaction/play", { songId, percentage: safePercentage });
  },

  /**
   * Records a skip event (user manually skipped a track).
   * @param songId — ID of the song that was skipped
   */
  async recordSkip(songId: string): Promise<void> {
    if (!songId) return;
    await sendTelemetry("/interaction/skip", { songId });
  },

  /**
   * Records a play event that originated from a search result.
   * @param songId — ID of the song played from search
   */
  async recordSearchPlay(songId: string): Promise<void> {
    if (!songId) return;
    await sendTelemetry("/interaction/search-play", { songId });
  },

  /**
   * Records a click on a search result (song, artist, or playlist).
   * @param type — "SONG" | "ARTIST" | "PLAYLIST"
   * @param id   — ID of the clicked entity
   */
  async recordSearchClick(type: "SONG" | "ARTIST" | "PLAYLIST", id: string): Promise<void> {
    if (!id) return;
    await sendTelemetry("/interaction/search-click", { type, id });
  },

  /**
   * Records a song being added to the playback queue.
   * @param songId — ID of the song added
   */
  async recordQueueAdd(songId: string): Promise<void> {
    if (!songId) return;
    await sendTelemetry("/interaction/queue-add", { songId });
  },

  /**
   * Records a song being removed from the playback queue.
   * @param songId — ID of the song removed
   */
  async recordQueueRemove(songId: string): Promise<void> {
    if (!songId) return;
    await sendTelemetry("/interaction/queue-remove", { songId });
  },

  /**
   * Records a dislike event for a song.
   * @param songId — ID of the disliked song
   */
  async recordDislike(songId: string): Promise<void> {
    if (!songId) return;
    await sendTelemetry("/interaction/dislike", { songId });
  },

  /**
   * Records a share event for a song.
   * @param songId — ID of the shared song
   */
  async recordShare(songId: string): Promise<void> {
    if (!songId) return;
    await sendTelemetry("/interaction/share", { songId });
  },
};
