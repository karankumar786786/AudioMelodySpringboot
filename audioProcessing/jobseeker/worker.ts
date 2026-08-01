import { redis } from "../redis";
import { inngest } from "../inngest";
import { config } from "dotenv";
config();

export async function fetchJobsFromList() {
    const jobQueue = process.env.JOB_PROCESSING_QUEUE || "audio_processing_queue";
    console.log(`Worker starting, listening on Redis queue: "${jobQueue}"`);
    while (true) {
        try {
            // blpop blocks for up to 5 seconds waiting for a job
            // ioredis returns [queueName, element] or null if timeout occurs
            const result = await redis.blpop(jobQueue, 5);
            if (result && result[1]) {
                const rawData = result[1];
                console.log("Popped job from Redis queue:", rawData);
                try {
                    const data = JSON.parse(rawData);
                    // Send event to Inngest for async background processing
                    console.log(data);
                    await inngest.send({
                        name: "audio/fetchjob",
                        data: data,
                    });
                    console.log("Successfully forwarded job event to Inngest");
                } catch (parseError) {
                    console.error("Failed to parse job data JSON:", parseError);
                }
            }
        } catch (error) {
            console.error("Error popping job from Redis queue:", error);
            // Delay for 1 second before retrying on error to avoid rapid spin loops
            await new Promise((resolve) => setTimeout(resolve, 1000));
        }
    }
};