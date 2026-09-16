import { redis } from "../redis";
import { inngest } from "../inngest";
import { config } from "dotenv";
import type { DeleteEventPayload } from "../types/delete";

config();

const EMPTY_QUEUE_DELAY_MS = Number(process.env.QUEUE_EMPTY_DELAY_MS) || 2000;
const POLL_TIMEOUT_SECONDS = Number(process.env.QUEUE_POLL_TIMEOUT_SECS) || 2;

export async function fetchDeleteEventsFromList() {
    const deleteQueue = process.env.DELETE_EVENT_QUEUE || "delete_event_queue";
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
                // Queue is empty: pause for 1-3 seconds to prevent continuous polling
                await new Promise((resolve) => setTimeout(resolve, EMPTY_QUEUE_DELAY_MS));
            }
        } catch (error) {
            console.error("Error popping delete event from Redis queue:", error);
            await new Promise((resolve) => setTimeout(resolve, EMPTY_QUEUE_DELAY_MS));
        }
    }
}