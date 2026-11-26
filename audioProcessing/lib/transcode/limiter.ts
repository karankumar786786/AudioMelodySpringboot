/**
 * Transcoding ke liye global "limiter": ek saath kitne bhaari FFmpeg jobs chalein.
 * Zyada jobs ek saath chalne se CPU / RAM khatam ho jaati hai aur sab dheema ho jaata hai.
 */
import pLimit from "p-limit";
import { config } from "dotenv";
import * as os from "node:os";

config();

/**
 * Machine pe kitne CPU cores use ho sakte hain (naye Node me availableParallelism, warna cpus().length, warna 2).
 */
const detectedCores = typeof os.availableParallelism === "function"
    ? os.availableParallelism()
    : (os.cpus()?.length || 2);

export const SYSTEM_CPU_CORES = Math.max(1, detectedCores);

/**
 * Ek saath kitne transcoding jobs: default = CPU cores jitne.
 * CONCURRENT_TRANSCODING_LIMIT ya MAX_CONCURRENT_JOBS se badal sakte hain ("cores" / "auto" = default hi).
 * Galat / 0 value ho to bhi cores jitne.
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

// pLimit: isme daale kaam ek saath sirf LIMIT tak chalte hain, baaki line me intezaar karte hain
export const globalTranscodeLimiter = pLimit(CONCURRENT_TRANSCODING_LIMIT);

console.log(
    `[CONCURRENCY] Transcoding concurrency limit initialized: ${CONCURRENT_TRANSCODING_LIMIT} (system CPU cores: ${SYSTEM_CPU_CORES})`
);
