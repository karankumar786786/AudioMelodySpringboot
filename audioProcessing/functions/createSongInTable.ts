/**
 * Inngest function "finalize-song": upload pipeline ka AAKHRI step.
 * Upload pipeline (Inngest): audio/fetchjob -> transcode -> index.recombee -> index.algolia -> final.create.
 *
 * Admin API /finalize call karta hai - wahi songs table me song banata / update karta hai aur job COMPLETED.
 */
import { inngest } from "../inngest";
import { api } from "../axios";
import { extractMeaningfulError } from "../lib/errorUtils";

/** Admin API /finalize call karo. Fail = onFailure admin ko /failed batata hai. */
export const finalizeSong = inngest.createFunction(
    {
        id: "finalize-song",
        cancelOn: [
            {
                event: "audio/job.cancel",
                match: "data.jobId",
            },
        ],
        triggers: [{ event: "audio/song.final.create" }],
        onFailure: async ({ event, error }) => {
            const jobId = event?.data?.event?.data?.jobId;
            if (jobId) {
                const reason = extractMeaningfulError(error, "Song publication failed");
                console.error(`[FINALIZE FAILED] Notifying coreEngine of failure for job ${jobId}:`, reason);
                try {
                    await api.post(`/${jobId}/failed`, {
                        reason: `Finalization: ${reason}`,
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

        await step.run("finalize-process", async () => {
            console.log(`[FINALIZE] Finalizing job ${jobId} via coreEngine...`);
            await api.post(`/${jobId}/finalize`);
            console.log(`[FINALIZE] Successfully finalized job ${jobId}`);
        });

        return { status: "success", jobId };
    }
);
