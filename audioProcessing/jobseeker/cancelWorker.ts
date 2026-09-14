import { redis } from "../redis";
import { inngest } from "../inngest";
import { config } from "dotenv";
import { cleanupStaleTmpFiles } from "../lib/transcode/cleanup";

config();

export async function fetchCancelEventsFromList() {
    const cancelQueue = process.env.CANCEL_EVENT_QUEUE || "audio_cancel_queue";
    console.log(`Cancel worker starting, listening on Redis queue: "${cancelQueue}"`);

    while (true) {
        try {
            const result = await redis.blpop(cancelQueue, 5);
            if (result && result[1]) {
                const rawData = result[1];
                try {
                    const data = JSON.parse(rawData);
                    const jobId = data?.jobId || data?.id || (typeof data === "string" ? data : null);

                    if (!jobId) {
                        console.warn("[CANCEL WORKER] Skipping malformed cancel event payload:", rawData);
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
            }
        } catch (error) {
            console.error("[CANCEL WORKER] Error popping cancel event from Redis queue:", error);
            await new Promise((resolve) => setTimeout(resolve, 1000));
        }
    }
}
