/**
 * PURANA worker - abhi kahin se chalaya nahi jaata (index.ts isko import nahi karta).
 * Pehle admin API Redis queue me job daalta tha; ab seedha Inngest ko event bhejta hai.
 * Kafka cut-over ke baad hatana hai (dekho infra/kafka/README.md, step 7).
 *
 * Kaam: Redis list se job uthao (BLPOP) aur Inngest ko "audio/fetchjob" bhejo.
 */
import { redis } from "../redis";
import { inngest } from "../inngest";
import { config } from "dotenv";
import { QUEUES } from "../lib/queues";
config();

const EMPTY_QUEUE_DELAY_MS = Number(process.env.QUEUE_EMPTY_DELAY_MS) || 2000;
const POLL_TIMEOUT_SECONDS = Number(process.env.QUEUE_POLL_TIMEOUT_SECS) || 2;

/** Hamesha chalne wala loop: queue se job lo -> Inngest event. JSON galat ho to log karke aage. */
export async function fetchJobsFromList() {
    const jobQueue = QUEUES.AUDIO_PROCESSING;
    console.log(`Worker starting, listening on Redis queue: "${jobQueue}" (idle wait: ${EMPTY_QUEUE_DELAY_MS}ms)`);
    while (true) {
        try {
            // BLPOP: job aane tak POLL_TIMEOUT_SECONDS ruko. ioredis [queueName, value] deta hai, ya timeout pe null
            const result = await redis.blpop(jobQueue, POLL_TIMEOUT_SECONDS);
            if (result && result[1]) {
                const rawData = result[1];
                console.log("Popped job from Redis queue:", rawData);
                try {
                    const data = JSON.parse(rawData);
                    // Inngest ko event bhejo - baaki kaam background me
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
                // Queue khaali: thoda ruko taaki lagatar Redis ko na pukarein
                await new Promise((resolve) => setTimeout(resolve, EMPTY_QUEUE_DELAY_MS));
            }
        } catch (error) {
            console.error("Error popping job from Redis queue:", error);
            // Error pe bhi ruk ke dobara try - warna loop tezi se ghoomta rahega
            await new Promise((resolve) => setTimeout(resolve, EMPTY_QUEUE_DELAY_MS));
        }
    }
};