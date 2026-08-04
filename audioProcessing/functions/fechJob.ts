import { inngest } from "../inngest";
import { api } from "../axios";
import { NonRetriableError } from "inngest";

export const fetchJob = inngest.createFunction(
    {
        id: "fetch-job",
        triggers: [{ event: "audio/fetchjob" }]
    },
    async ({ event, step }) => {
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
                songId: jobDetails.songId,
            },
        });
        return { status: "success", jobId };
    }
);