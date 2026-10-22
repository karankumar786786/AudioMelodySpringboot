import pLimit from "p-limit";
import { config } from "dotenv";

config();

/**
 * Global concurrency limit for media transcoding and heavy audio processing.
 * Configured via CONCURRENT_TRANSCODING_LIMIT in .env (default: 2).
 */
export const CONCURRENT_TRANSCODING_LIMIT = Math.max(
    1,
    Number(process.env.CONCURRENT_TRANSCODING_LIMIT || process.env.MAX_CONCURRENT_JOBS || 2)
);

export const globalTranscodeLimiter = pLimit(CONCURRENT_TRANSCODING_LIMIT);

console.log(`[CONCURRENCY] Global transcoding concurrency limit initialized: ${CONCURRENT_TRANSCODING_LIMIT}`);
