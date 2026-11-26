/**
 * Inngest function "index-recombee": song Recombee (recommendation engine) me daalo.
 * Upload pipeline (Inngest): audio/fetchjob -> transcode -> index.recombee -> index.algolia -> final.create.
 *
 * Asli kaam admin API ka webhook karta hai; uske baad agla event "audio/song.index.algolia" bhejte hain.
 */
import { inngest } from "../inngest";
import { api } from "../axios";
import { extractMeaningfulError } from "../lib/errorUtils";

/** Admin API /save-recommendation call karo, phir Algolia step shuru. Fail = onFailure /failed. */
export const indexRecombee = inngest.createFunction(
    {
        id: "index-recombee",
        cancelOn: [
            {
                event: "audio/job.cancel",
                match: "data.jobId",
            },
        ],
        triggers: [{ event: "audio/song.index.recombee" }],
        onFailure: async ({ event, error }) => {
            const jobId = event?.data?.event?.data?.jobId;
            if (jobId) {
                const reason = extractMeaningfulError(error, "Recombee recommendation indexing failed");
                console.error(`[RECOMBEE FAILED] Notifying coreEngine of failure for job ${jobId}:`, reason);
                try {
                    await api.post(`/${jobId}/failed`, {
                        reason: `Recombee indexing: ${reason}`,
                    });
                } catch (e) {
                    console.error(`Failed to notify Spring Boot of job ${jobId} failure:`, e);
                }
            }
        },
    },
    async ({ event, step }) => {
        const { jobId } = event.data;
        if (!jobId) {
            throw new Error("Missing jobId in event data");
        }
        await step.run("sync-with-recombee", async () => {
            console.log(`[RECOMBEE] Syncing job ${jobId} with Recombee via coreEngine...`);
            await api.post(`/${jobId}/save-recommendation`);
            console.log(`[RECOMBEE] Successfully synced job ${jobId} with Recombee`);
        });
        await step.sendEvent("trigger-algolia-indexing", {
            name: "audio/song.index.algolia",
            data: { jobId }
        });
        return { status: "success", jobId };
    }
);
