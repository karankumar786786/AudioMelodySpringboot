import { inngest } from "../inngest";
import { api } from "../axios";

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
        const response = await api.get(jobId);
        console.log("Fetched job details:", response.data);
        return response.data;
    }
);