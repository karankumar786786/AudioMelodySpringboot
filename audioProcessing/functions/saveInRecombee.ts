import { inngest } from "../inngest";
import { api } from "../axios";

export const indexRecombee = inngest.createFunction(
    {
        id: "index-recombee",
        triggers: [{ event: "audio/song.index.recombee" }],
        onFailure: async ({ event, error }) => {
            const jobId = event?.data?.event?.data?.jobId;
            if (jobId) {
                console.error(`[RECOMBEE FAILED] Notifying coreEngine of failure for job ${jobId}:`, error?.message);
                try {
                    await api.post(`/${jobId}/failed`, {
                        reason: `Recombee indexing failed: ${error?.message || "Unknown error"}`,
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
