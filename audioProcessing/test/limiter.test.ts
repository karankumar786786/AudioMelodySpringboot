import { describe, it, expect } from "bun:test";
import { globalTranscodeLimiter, CONCURRENT_TRANSCODING_LIMIT } from "../lib/transcode/limiter";

describe("Global Concurrency Limiter", () => {
    it("should default to CONCURRENT_TRANSCODING_LIMIT >= 2", () => {
        expect(CONCURRENT_TRANSCODING_LIMIT).toBeGreaterThanOrEqual(1);
    });

    it("should enforce active concurrency limit across asynchronous transcode operations", async () => {
        let activeCount = 0;
        let peakActive = 0;
        const totalTasks = 6;
        const taskDurationsMs = 50;

        const tasks = Array.from({ length: totalTasks }, (_, i) =>
            globalTranscodeLimiter(async () => {
                activeCount++;
                peakActive = Math.max(peakActive, activeCount);
                await new Promise((resolve) => setTimeout(resolve, taskDurationsMs));
                activeCount--;
                return `task-${i}-completed`;
            })
        );

        const results = await Promise.all(tasks);

        expect(results.length).toBe(totalTasks);
        expect(peakActive).toBeLessThanOrEqual(CONCURRENT_TRANSCODING_LIMIT);
        expect(activeCount).toBe(0);
    });
});
