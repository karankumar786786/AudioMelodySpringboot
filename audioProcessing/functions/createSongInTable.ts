import { inngest } from "../inngest";
import { api } from "../axios";

export const finalizeSong = inngest.createFunction(
    {
        id: "finalize-song",
        triggers: [{ event: "audio/song.final.create" }]
    },
    async ({ event, step }) => {
        const { jobId } = event.data;

        if (!jobId) {
            throw new Error("Missing jobId in event data");
        }

        await step.run("finalize-process", async () => {
            console.log(`[FINALIZE] Finalizing job ${jobId}...`);
            await api.post(`/${jobId}/finalize`);
        });

        return { status: "success", jobId };
    }
);
