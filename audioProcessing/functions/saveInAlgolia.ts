import { inngest } from "../inngest";
import { api } from "../axios";

export const indexAlgolia = inngest.createFunction(
    {
        id: "index-algolia",
        triggers: [{ event: "audio/song.index.algolia" }]
    },
    async ({ event, step }) => {
        const { jobId } = event.data;

        if (!jobId) {
            throw new Error("Missing jobId in event data");
        }

        await step.run("sync-with-algolia", async () => {
            console.log(`[ALGOLIA] Indexing job ${jobId} in Algolia...`);
            await api.post(`/${jobId}/save-search`);
        });

        await step.sendEvent("trigger-finalization", {
            name: "audio/song.final.create",
            data: { jobId }
        });

        return { status: "success", jobId };
    }
);
