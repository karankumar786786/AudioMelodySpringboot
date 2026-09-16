import { redis } from "../redis";
import { inngest } from "../inngest";
import { config } from "dotenv";
import { cleanupStaleTmpFiles } from "../lib/transcode/cleanup";
config();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const EMPTY_QUEUE_DELAY_MS = Number(process.env.QUEUE_EMPTY_DELAY_MS) || 2000;
const POLL_TIMEOUT_SECONDS = Number(process.env.QUEUE_POLL_TIMEOUT_SECS) || 2;

export async function fetchCancelEventsFromList() {
    const cancelQueue = process.env.CANCEL_EVENT_QUEUE || "audio_cancel_queue";
    console.log(`Cancel worker starting, listening on Redis queue: "${cancelQueue}" (idle wait: ${EMPTY_QUEUE_DELAY_MS}ms)`);

    while (true) {
        try {
            const result = await redis.blpop(cancelQueue, POLL_TIMEOUT_SECONDS);
            if (result && result[1]) {
                const rawData = result[1];
                try {
                    const data = JSON.parse(rawData);
                    const jobId = data?.jobId || data?.id || (typeof data === "string" ? data : null);

                    if (!jobId) {
                        console.warn("[CANCEL WORKER] Skipping malformed cancel event payload:", rawData);
                        await sleep(EMPTY_QUEUE_DELAY_MS);
                        continue;
                    }

                    console.log(`[CANCEL WORKER] Received cancellation for job: ${jobId}`);

                    // 1. Dispatch cancellation event to Inngest to halt any running / queued functions
                    await inngest.send({
                        name: "audio/job.cancel",
                        data: { jobId },
                    });
                    console.log(`[CANCEL WORKER] Dispatched audio/job.cancel to Inngest for job: ${jobId}`);

                    // 2. Clean up any stale/active local temporary transcoding directories
                    cleanupStaleTmpFiles().catch(() => {});
                } catch (parseError) {
                    console.error("[CANCEL WORKER] Failed to parse cancel event JSON:", parseError);
                }
            } else {
                // Queue is empty: pause for 1-3 seconds to prevent continuous polling
                await sleep(EMPTY_QUEUE_DELAY_MS);
            }
        } catch (error) {
            console.error("[CANCEL WORKER] Error popping cancel event from Redis queue:", error);
            await sleep(EMPTY_QUEUE_DELAY_MS);
        }
    }
}
