import pLimit from "p-limit";
import { config } from "dotenv";
import * as os from "node:os";

config();

/**
 * Automatically detects the number of available physical/logical CPU cores on the host.
 */
const detectedCores = typeof os.availableParallelism === "function"
    ? os.availableParallelism()
    : (os.cpus()?.length || 2);

export const SYSTEM_CPU_CORES = Math.max(1, detectedCores);

/**
 * Dynamic concurrency limit for media transcoding and heavy audio processing.
 * Defaults to the exact number of CPU cores available on the system.
 * Can be explicitly overridden via CONCURRENT_TRANSCODING_LIMIT or MAX_CONCURRENT_JOBS
 * (unless set to "cores" or "auto").
 */
function resolveConcurrencyLimit(): number {
    const rawVal = process.env.CONCURRENT_TRANSCODING_LIMIT || process.env.MAX_CONCURRENT_JOBS;
    if (rawVal && rawVal !== "cores" && rawVal !== "auto") {
        const parsed = Number(rawVal);
        if (!isNaN(parsed) && parsed > 0) {
            return parsed;
        }
    }
    return SYSTEM_CPU_CORES;
}

export const CONCURRENT_TRANSCODING_LIMIT = resolveConcurrencyLimit();

export const globalTranscodeLimiter = pLimit(CONCURRENT_TRANSCODING_LIMIT);

console.log(
    `[CONCURRENCY] Transcoding concurrency limit initialized: ${CONCURRENT_TRANSCODING_LIMIT} (system CPU cores: ${SYSTEM_CPU_CORES})`
);
