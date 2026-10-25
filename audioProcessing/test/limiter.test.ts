import { describe, it, expect } from "bun:test";
import { globalTranscodeLimiter, CONCURRENT_TRANSCODING_LIMIT, SYSTEM_CPU_CORES } from "../lib/transcode/limiter";

describe("Global Concurrency Limiter", () => {
    it("should detect host CPU cores and set CONCURRENT_TRANSCODING_LIMIT >= 1", () => {
        expect(SYSTEM_CPU_CORES).toBeGreaterThanOrEqual(1);
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
