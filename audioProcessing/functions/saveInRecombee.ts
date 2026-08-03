import { inngest } from "../inngest";
import { api } from "../axios";

export const indexRecombee = inngest.createFunction(
    {
        id: "index-recombee",
        triggers: [{ event: "audio/song.index.recombee" }]
    },
    async ({ event, step }) => {
        const { jobId } = event.data;

        if (!jobId) {
            throw new Error("Missing jobId in event data");
        }

        await step.run("sync-with-recombee", async () => {
            console.log(`[RECOMBEE] Indexing job ${jobId} in Recombee...`);
            await api.post(`/${jobId}/save-recommendation`);
        });

        await step.sendEvent("trigger-algolia-indexing", {
            name: "audio/song.index.algolia",
            data: { jobId }
        });

        return { status: "success", jobId };
    }
);
