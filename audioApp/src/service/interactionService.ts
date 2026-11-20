import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, AppStateStatus } from "react-native";
import { api } from "./baseApi";
import { createTelemetryQueue, FLUSH_INTERVAL_MS, TelemetryType } from "./telemetryQueue";

const LEGACY_QUEUE_KEY = "audiomelody_telemetry_outbox";

const telemetry = createTelemetryQueue({
  post: (url, body) => api.post(url, body),
  storage: AsyncStorage,
});

export const flushTelemetryQueue = (): Promise<void> => telemetry.flush();

// Events from app versions before batching used a different key; they carried no ids,
// so drop them rather than risk counting a listen twice.
AsyncStorage.removeItem(LEGACY_QUEUE_KEY).catch(() => {});

if (typeof setInterval !== "undefined") {
  setInterval(() => {
    flushTelemetryQueue().catch(() => {});
  }, FLUSH_INTERVAL_MS);
}

// Flush when the app comes back and before the OS may suspend it.
if (typeof AppState !== "undefined" && AppState.addEventListener) {
  AppState.addEventListener("change", (status: AppStateStatus) => {
    if (status === "active" || status === "background" || status === "inactive") {
      flushTelemetryQueue().catch(() => {});
    }
  });
}

async function record(
  type: TelemetryType,
  fields: { songId?: string; percentage?: number; durationMs?: number; entityType?: string; entityId?: string },
  flushNow = false,
): Promise<void> {
  await telemetry.enqueue({ type, ...fields });
  if (flushNow) flushTelemetryQueue().catch(() => {});
}

/**
 * Interaction Telemetry Service
 *
 * Every call becomes an event with its own id and device time, kept in AsyncStorage
 * until the server accepts it and sent in batches (see telemetryQueue.ts), so
 * listens made offline or during a server outage are not lost or double counted.
 */
export const interactionService = {
  /**
   * Records a play with the listen completion percentage. Sent right away (track change).
   * @param songId — ID of the song that was played
   * @param percentage — 0.0 to 1.0 of the track that was listened to
   * @param durationSec — track length, if known (lets the server apply the 30-second rule)
   */
  async recordPlay(songId: string, percentage: number, durationSec?: number): Promise<void> {
    if (!songId) return;
    const safePercentage = Math.min(1.0, Math.max(0.0, isNaN(percentage) ? 0.05 : percentage));
    const durationMs = durationSec && durationSec > 0 ? Math.round(durationSec * 1000) : undefined;
    await record("play", { songId, percentage: safePercentage, durationMs }, true);
  },

  /** Records a skip (the user pressed next). */
  async recordSkip(songId: string): Promise<void> {
    if (!songId) return;
    await record("skip", { songId });
  },

  /** Records a play that started from a search result. */
  async recordSearchPlay(songId: string): Promise<void> {
    if (!songId) return;
    await record("search-play", { songId });
  },

  /** Records a click on a search result. */
  async recordSearchClick(type: "SONG" | "ARTIST" | "PLAYLIST", id: string): Promise<void> {
    if (!id) return;
    await record("search-click", { entityType: type, entityId: id });
  },

  async recordQueueAdd(songId: string): Promise<void> {
    if (!songId) return;
    await record("queue-add", { songId });
  },

  async recordQueueRemove(songId: string): Promise<void> {
    if (!songId) return;
    await record("queue-remove", { songId });
  },

  async recordDislike(songId: string): Promise<void> {
    if (!songId) return;
    await record("dislike", { songId });
  },

  async recordShare(songId: string): Promise<void> {
    if (!songId) return;
    await record("share", { songId });
  },
};
