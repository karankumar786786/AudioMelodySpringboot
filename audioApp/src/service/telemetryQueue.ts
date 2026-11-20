/**
 * Telemetry queue: every interaction becomes an event with its own id and device time,
 * is kept in storage until the server accepts it, and goes up in batches of up to 50
 * (POST /interaction/batch) every 10 s, on track change and when the app goes to the
 * background or comes back.
 *
 * - 202: the batch is accepted (the server dedupes by eventId, so resending is safe).
 * - 404: the server still runs without the event pipeline; events are sent one by one
 *   to the old endpoints and batching is retried 10 minutes later.
 * - 503 / 429 / network: events stay queued and go with the next flush.
 * - other 4xx: the batch can't ever be accepted, so it's dropped.
 */

export type TelemetryType =
  | "play"
  | "skip"
  | "search-play"
  | "search-click"
  | "queue-add"
  | "queue-remove"
  | "dislike"
  | "share";

export interface TelemetryEvent {
  type: TelemetryType;
  eventId: string;
  occurredAt: number;
  songId?: string;
  percentage?: number;
  durationMs?: number;
  entityType?: string;
  entityId?: string;
}

export interface QueueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export interface HttpError {
  response?: { status?: number };
  code?: string;
  message?: string;
}

export interface TelemetryQueueDeps {
  post: (url: string, body: unknown) => Promise<unknown>;
  storage: QueueStorage;
  now?: () => number;
  random?: () => number;
}

export const STORAGE_KEY = "audiomelody_telemetry_events_v2";
export const MAX_QUEUE = 500;
export const BATCH_SIZE = 50;
export const FLUSH_INTERVAL_MS = 10_000;
const LEGACY_RETRY_MS = 10 * 60_000;

/** RFC 9562 UUID v7: time-ordered, so the server's ids sort roughly by creation time. */
export function uuidv7(now: number, random: () => number = Math.random): string {
  const hex = (n: number, width: number) => Math.floor(n).toString(16).padStart(width, "0");
  const ms = hex(now, 12);
  const rand = (bits: number) => Math.floor(random() * 2 ** bits);
  const variant = (0x8 | rand(2)).toString(16);
  return (
    `${ms.slice(0, 8)}-${ms.slice(8, 12)}-7${hex(rand(12), 3)}-` +
    `${variant}${hex(rand(12), 3)}-${hex(rand(24), 6)}${hex(rand(24), 6)}`
  );
}

/** Old single-event endpoint and body, for servers without /interaction/batch. */
export function legacyRequest(e: TelemetryEvent): { url: string; body: Record<string, unknown> } {
  switch (e.type) {
    case "play":
      return { url: "/interaction/play", body: { songId: e.songId, percentage: e.percentage ?? 0 } };
    case "search-click":
      return { url: "/interaction/search-click", body: { type: e.entityType ?? "SONG", id: e.entityId } };
    default:
      return { url: `/interaction/${e.type}`, body: { songId: e.songId } };
  }
}

function status(err: unknown): number | undefined {
  return (err as HttpError)?.response?.status;
}

function isRetryable(err: unknown): boolean {
  const s = status(err);
  if (s === undefined) return true; // network error / timeout
  return s === 503 || s === 429 || s === 502 || s === 504 || s === 500;
}

export function createTelemetryQueue(deps: TelemetryQueueDeps) {
  const now = deps.now ?? Date.now;
  let queue: TelemetryEvent[] | null = null;
  let flushing: Promise<void> | null = null;
  let batchUnsupportedUntil = 0;

  async function load(): Promise<TelemetryEvent[]> {
    if (queue) return queue;
    try {
      const raw = await deps.storage.getItem(STORAGE_KEY);
      queue = raw ? (JSON.parse(raw) as TelemetryEvent[]) : [];
    } catch {
      queue = [];
    }
    return queue;
  }

  async function save(): Promise<void> {
    if (!queue) return;
    if (queue.length > MAX_QUEUE) queue = queue.slice(-MAX_QUEUE); // keep the newest
    try {
      await deps.storage.setItem(STORAGE_KEY, JSON.stringify(queue));
    } catch {
      // storage full or unavailable: events stay in memory until the app restarts
    }
  }

  async function enqueue(event: Omit<TelemetryEvent, "eventId" | "occurredAt">): Promise<TelemetryEvent> {
    const q = await load();
    const full: TelemetryEvent = { ...event, eventId: uuidv7(now(), deps.random), occurredAt: now() };
    q.push(full);
    await save();
    return full;
  }

  async function sendLegacy(events: TelemetryEvent[]): Promise<TelemetryEvent[]> {
    const kept: TelemetryEvent[] = [];
    for (let i = 0; i < events.length; i++) {
      const e = events[i]!;
      try {
        const { url, body } = legacyRequest(e);
        await deps.post(url, body);
      } catch (err) {
        if (isRetryable(err)) {
          kept.push(...events.slice(i));
          break;
        }
      }
    }
    return kept;
  }

  async function flushOnce(): Promise<void> {
    const q = await load();
    while (q.length > 0) {
      const batch = q.slice(0, BATCH_SIZE);
      if (now() < batchUnsupportedUntil) {
        const kept = await sendLegacy(batch);
        q.splice(0, batch.length, ...kept);
        await save();
        if (kept.length > 0) return;
        continue;
      }
      try {
        await deps.post("/interaction/batch", { events: batch });
        q.splice(0, batch.length);
        await save();
      } catch (err) {
        if (status(err) === 404) {
          batchUnsupportedUntil = now() + LEGACY_RETRY_MS;
          continue;
        }
        if (isRetryable(err)) return; // keep everything for the next flush
        q.splice(0, batch.length); // 400/401/403/...: can never succeed
        await save();
      }
    }
  }

  function flush(): Promise<void> {
    if (!flushing) {
      flushing = flushOnce().finally(() => {
        flushing = null;
      });
    }
    return flushing;
  }

  return {
    enqueue,
    flush,
    async size(): Promise<number> {
      return (await load()).length;
    },
  };
}
