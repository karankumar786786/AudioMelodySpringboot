import { inngest } from "../inngest";
import { api } from "../axios";

export const indexAlgolia = inngest.createFunction(
    {
        id: "index-algolia",
        triggers: [{ event: "audio/song.index.algolia" }],
        onFailure: async ({ event, error }) => {
            const jobId = event?.data?.event?.data?.jobId;
            if (jobId) {
                console.error(`[ALGOLIA FAILED] Notifying coreEngine of failure for job ${jobId}:`, error?.message);
                try {
                    await api.post(`/${jobId}/failed`, {
                        reason: `Algolia indexing failed: ${error?.message || "Unknown error"}`,
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
        await step.run("sync-with-algolia", async () => {
            console.log(`[ALGOLIA] Indexing job ${jobId} in Algolia via coreEngine...`);
            await api.post(`/${jobId}/save-search`);
            console.log(`[ALGOLIA] Successfully indexed job ${jobId} in Algolia`);
        });
        await step.sendEvent("trigger-finalization", {
            name: "audio/song.final.create",
            data: { jobId }
        });
        return { status: "success", jobId };
    }
);
