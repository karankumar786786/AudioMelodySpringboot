/**
 * PURANA worker - abhi kahin se chalaya nahi jaata (index.ts isko import nahi karta).
 * Pehle admin API Redis queue me job daalta tha; ab seedha Inngest ko event bhejta hai.
 * Kafka cut-over ke baad hatana hai (dekho infra/kafka/README.md, step 7).
 *
 * Kaam: Redis delete queue se event uthao aur Inngest ko "audio/delete.algolia" bhejo (delete chain shuru).
 */
import { redis } from "../redis";
import { inngest } from "../inngest";
import { config } from "dotenv";
import type { DeleteEventPayload } from "../types/delete";
import { QUEUES } from "../lib/queues";

config();

const EMPTY_QUEUE_DELAY_MS = Number(process.env.QUEUE_EMPTY_DELAY_MS) || 2000;
const POLL_TIMEOUT_SECONDS = Number(process.env.QUEUE_POLL_TIMEOUT_SECS) || 2;

/** Hamesha chalne wala loop. entityType / entityId na ho to event chhod do. */
export async function fetchDeleteEventsFromList() {
    const deleteQueue = QUEUES.DELETE_EVENT;
    console.log(`Delete worker starting, listening on Redis queue: "${deleteQueue}" (idle wait: ${EMPTY_QUEUE_DELAY_MS}ms)`);

    while (true) {
        try {
            const result = await redis.blpop(deleteQueue, POLL_TIMEOUT_SECONDS);
            if (result && result[1]) {
                const rawData = result[1];
                try {
                    const data = JSON.parse(rawData) as DeleteEventPayload;
                    if (!data?.entityType || !data?.entityId) {
                        console.warn("Skipping malformed delete event:", rawData);
                        continue;
                    }

                    await inngest.send({
                        name: "audio/delete.algolia",
                        data,
                    });

                    console.log(`Forwarded delete event for ${data.entityType}:${data.entityId}`);
                } catch (parseError) {
                    console.error("Failed to parse delete event JSON:", parseError);
                }
            } else {
                // Queue khaali: thoda ruko taaki lagatar Redis ko na pukarein
                await new Promise((resolve) => setTimeout(resolve, EMPTY_QUEUE_DELAY_MS));
            }
        } catch (error) {
            console.error("Error popping delete event from Redis queue:", error);
            await new Promise((resolve) => setTimeout(resolve, EMPTY_QUEUE_DELAY_MS));
        }
    }
}