import { inngest } from "../inngest";
import { api } from "../axios";
import { transcodeFunction } from "./transcode";

export const fetchJob = inngest.createFunction(
    {
        id: "Fetch Audio",
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

        await step.invoke("invoke-transcode", {
            function: transcodeFunction,
            data: {
                jobId: jobDetails.id || jobId,
                tempSongKey: jobDetails.tempSongKey || data.tempSongKey,
            },
        });
        return jobDetails;
    }
);