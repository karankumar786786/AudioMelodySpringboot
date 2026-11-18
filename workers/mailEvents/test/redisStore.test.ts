// Integration test for the Redis-backed store. Runs only when MAIL_TEST_REDIS_URL
// points at a disposable Redis (e.g. redis://127.0.0.1:6390); keys are namespaced.
import { describe, it, expect, afterAll } from "bun:test";
import { Redis } from "ioredis";
import { createRedisStore } from "../lib/queue";

const url = process.env.MAIL_TEST_REDIS_URL;

describe.skipIf(!url)("createRedisStore (redis)", () => {
    const redis = new Redis(url || "redis://127.0.0.1:1", { lazyConnect: true, maxRetriesPerRequest: 1 });
    const queue = `mail_test_${crypto.randomUUID()}`;
    const store = createRedisStore(redis, queue);

    afterAll(async () => {
        await redis.del(queue, store.delayedKey, store.dlqKey);
        redis.disconnect();
    });

    it("keeps retries off the ready queue until due, then promotes them", async () => {
        const job = { to: "a@b.com", subject: "LOGIN", otp: "123456", retries: 1 };
        await store.scheduleRetry(job, 1000);
        await store.scheduleRetry(job, 1000); // identical job twice must not collapse
        await store.scheduleRetry({ ...job, to: "later@b.com" }, 5000);

        expect(await store.promoteDue(999)).toBe(0);
        expect(await redis.llen(queue)).toBe(0);

        expect(await store.promoteDue(1000)).toBe(2);
        expect(await redis.llen(queue)).toBe(2);
        expect(await redis.zcard(store.delayedKey)).toBe(1);

        const popped = JSON.parse((await store.pop(1))!);
        expect(popped).toMatchObject({ to: "a@b.com", retries: 1, notBefore: 1000 });
    });

    it("stores DLQ entries as given", async () => {
        await store.pushDlq({ to: "a", subject: "s", retries: 3, error: "e", reason: "max_retries", failedAt: "t" });
        const [entry] = await redis.lrange(store.dlqKey, 0, -1);
        expect(JSON.parse(entry!)).toEqual({ to: "a", subject: "s", retries: 3, error: "e", reason: "max_retries", failedAt: "t" });
    });
});
