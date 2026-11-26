/**
 * Inngest function "fetch-job" - upload pipeline ka PEHLA step.
 * Upload pipeline (Inngest): audio/fetchjob -> transcode -> index.recombee -> index.algolia -> final.create.
 *
 * Event "audio/fetchjob" (admin API bhejta hai) aata hai -> admin API se job ki detail lo -> transcode event bhejo.
 */
import { inngest } from "../inngest";
import { api } from "../axios";
import { NonRetriableError } from "inngest";
import { extractMeaningfulError } from "../lib/errorUtils";

/**
 * Job ki detail admin API (GET /webhook/job/<id>) se lao aur "audio/song.transcode" bhejo.
 * Job na mile (404) = NonRetriableError (retry bekaar). Saare retries fail = onFailure admin ko /failed batata hai.
 * cancelOn: "audio/job.cancel" event (same jobId) aaye to ye run ruk jaata hai.
 */
export const fetchJob = inngest.createFunction(
    {
        id: "fetch-job",
        cancelOn: [
            {
                event: "audio/job.cancel",
                match: "data.jobId",
            },
        ],
        triggers: [{ event: "audio/fetchjob" }],
        retries: 3,
        onFailure: async ({ event, error }) => {
            const jobId = event?.data?.event?.data?.jobId;
            if (jobId) {
                const reason = extractMeaningfulError(error, "Job initialization failed");
                console.error(`[FETCH-JOB FAILED] Notifying coreEngine of failure for job ${jobId}:`, reason);
                try {
                    await api.post(`/${jobId}/failed`, {
                        reason: `Job fetch: ${reason}`,
                    });
                } catch (e) {
                    console.error(`Failed to notify Spring Boot of job ${jobId} failure:`, e);
                }
            }
        },
    },
    async ({ event, step, attempt }) => {
        const data = event.data;
        if (!data.jobId) {
            throw new NonRetriableError("Missing jobId in event data");
        }
        const jobId = data.jobId;
        const jobDetails = await step.run("fetch-job-details", async () => {
            try {
                const response = await api.get(`/${jobId}`);
                return response.data;
            } catch (err: any) {
                if (err?.response?.status === 404) {
                    throw new NonRetriableError(`Job not found in database: ${jobId}`);
                }
                throw err;
            }
        });
        console.log("Fetched job details:", jobDetails);

        await step.sendEvent("trigger-transcode", {
            name: "audio/song.transcode",
            data: {
                jobId: jobDetails.id || jobId,
                tempSongKey: jobDetails.tempSongKey,
                tempVideoKey: jobDetails.tempVideoKey,
                clipStartSec: jobDetails.clipStartSec,
                clipEndSec: jobDetails.clipEndSec,
                videoKey: jobDetails.videoKey,
                songId: jobDetails.songId,
                isVideoReprocess: jobDetails.isVideoReprocess === true,
                isAudioReprocess: jobDetails.isAudioReprocess === true,
            },
        });
        return { status: "success", jobId };
    }
);