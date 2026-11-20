import { BATCH_SIZE, createTelemetryQueue, legacyRequest, MAX_QUEUE, uuidv7 } from "@/service/telemetryQueue";

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: async (k: string) => data.get(k) ?? null,
    setItem: async (k: string, v: string) => {
      data.set(k, v);
    },
  };
}

const httpError = (status: number) => Object.assign(new Error(`HTTP ${status}`), { response: { status } });
const networkError = () => Object.assign(new Error("Network Error"), { code: "ERR_NETWORK" });

describe("uuidv7", () => {
  it("makes valid, time-ordered version 7 ids", () => {
    const a = uuidv7(1_700_000_000_000);
    const b = uuidv7(1_700_000_000_001);
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(a < b).toBe(true);
  });
});

describe("createTelemetryQueue", () => {
  it("sends queued events as one batch with ids and device time", async () => {
    const post = jest.fn().mockResolvedValue({ status: 202 });
    const q = createTelemetryQueue({ post, storage: memoryStorage(), now: () => 1000 });
    await q.enqueue({ type: "play", songId: "s1", percentage: 0.9, durationMs: 200000 });
    await q.enqueue({ type: "skip", songId: "s2" });
    await q.flush();

    expect(post).toHaveBeenCalledTimes(1);
    const [url, body] = post.mock.calls[0];
    expect(url).toBe("/interaction/batch");
    expect(body.events).toHaveLength(2);
    expect(body.events[0]).toMatchObject({ type: "play", songId: "s1", occurredAt: 1000, durationMs: 200000 });
    expect(body.events[0].eventId).toMatch(/-7/);
    expect(await q.size()).toBe(0);
  });

  it("keeps events when the server is unavailable or the device is offline", async () => {
    const post = jest.fn().mockRejectedValueOnce(httpError(503)).mockRejectedValueOnce(networkError());
    const q = createTelemetryQueue({ post, storage: memoryStorage() });
    await q.enqueue({ type: "skip", songId: "s1" });
    await q.flush();
    await q.flush();
    expect(await q.size()).toBe(1);

    post.mockResolvedValue({});
    await q.flush();
    expect(await q.size()).toBe(0);
    // The retried event keeps its id, so the server can drop a duplicate.
    expect(post.mock.calls[2][1].events[0].eventId).toBe(post.mock.calls[0][1].events[0].eventId);
  });

  it("drops a batch the server rejects as invalid", async () => {
    const post = jest.fn().mockRejectedValue(httpError(400));
    const q = createTelemetryQueue({ post, storage: memoryStorage() });
    await q.enqueue({ type: "skip", songId: "s1" });
    await q.flush();
    expect(await q.size()).toBe(0);
  });

  it("falls back to the single endpoints when the server has no batch endpoint", async () => {
    const post = jest.fn((url: string, _body?: unknown) => (url === "/interaction/batch" ? Promise.reject(httpError(404)) : Promise.resolve({})));
    const q = createTelemetryQueue({ post, storage: memoryStorage() });
    await q.enqueue({ type: "play", songId: "s1", percentage: 0.5 });
    await q.enqueue({ type: "search-click", entityType: "ARTIST", entityId: "a1" });
    await q.flush();

    expect(post.mock.calls.map((c) => c[0])).toEqual(["/interaction/batch", "/interaction/play", "/interaction/search-click"]);
    expect(post.mock.calls[2][1]).toEqual({ type: "ARTIST", id: "a1" });
    expect(await q.size()).toBe(0);

    // Batching stays off for a while: no second 404 round trip.
    await q.enqueue({ type: "skip", songId: "s2" });
    await q.flush();
    expect(post.mock.calls[3][0]).toBe("/interaction/skip");
  });

  it("splits large queues into batches of 50 and caps the stored queue", async () => {
    const post = jest.fn().mockResolvedValue({});
    const storage = memoryStorage();
    const q = createTelemetryQueue({ post, storage });
    for (let i = 0; i < MAX_QUEUE + 20; i++) await q.enqueue({ type: "skip", songId: `s${i}` });
    expect(await q.size()).toBe(MAX_QUEUE);
    await q.flush();
    expect(post).toHaveBeenCalledTimes(Math.ceil(MAX_QUEUE / BATCH_SIZE));
    expect(post.mock.calls[0][1].events[0].songId).toBe("s20"); // oldest were dropped first
  });

  it("restores events saved by a previous app session", async () => {
    const storage = memoryStorage();
    const first = createTelemetryQueue({ post: jest.fn().mockRejectedValue(networkError()), storage });
    await first.enqueue({ type: "skip", songId: "s1" });
    await first.flush();

    const post = jest.fn().mockResolvedValue({});
    const second = createTelemetryQueue({ post, storage });
    await second.flush();
    expect(post.mock.calls[0][1].events[0].songId).toBe("s1");
  });

  it("maps events to the old endpoints", () => {
    expect(legacyRequest({ type: "queue-add", eventId: "x", occurredAt: 0, songId: "s" })).toEqual({
      url: "/interaction/queue-add",
      body: { songId: "s" },
    });
  });
});
