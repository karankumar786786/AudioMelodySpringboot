import { redis } from "../redis";
import { inngest } from "../inngest";
import { config } from "dotenv";
config();

const EMPTY_QUEUE_DELAY_MS = Number(process.env.QUEUE_EMPTY_DELAY_MS) || 2000;
const POLL_TIMEOUT_SECONDS = Number(process.env.QUEUE_POLL_TIMEOUT_SECS) || 2;

export async function fetchJobsFromList() {
    const jobQueue = process.env.JOB_PROCESSING_QUEUE || "audio_processing_queue";
    console.log(`Worker starting, listening on Redis queue: "${jobQueue}" (idle wait: ${EMPTY_QUEUE_DELAY_MS}ms)`);
    while (true) {
        try {
            // blpop blocks for up to POLL_TIMEOUT_SECONDS waiting for a job
            // ioredis returns [queueName, element] or null if timeout occurs
            const result = await redis.blpop(jobQueue, POLL_TIMEOUT_SECONDS);
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
            } else {
                // Queue is empty: pause for 1-3 seconds to prevent continuous polling
                await new Promise((resolve) => setTimeout(resolve, EMPTY_QUEUE_DELAY_MS));
            }
        } catch (error) {
            console.error("Error popping job from Redis queue:", error);
            // Delay before retrying on error to avoid rapid spin loops
            await new Promise((resolve) => setTimeout(resolve, EMPTY_QUEUE_DELAY_MS));
        }
    }
};