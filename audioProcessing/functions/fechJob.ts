import { inngest } from "../inngest";
import { api } from "../axios";

export const fetchJob = inngest.createFunction(
    {
        id: "fetch-job",
        triggers: [{ event: "audio/fetchjob" }]
    },
    async ({ event, step }) => {
        const data = event.data;
        if (!data.jobId) {
            throw new Error("Missing jobId in event data");
        }
        const jobId = data.jobId;
        const jobDetails = await step.run("fetch-job-details", async () => {
            const response = await api.get(`/${jobId}`);
            return response.data;
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