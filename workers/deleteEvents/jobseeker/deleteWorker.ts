import { redis } from "../redis";
import { inngest } from "../inngest";
import { config } from "dotenv";
import type { DeleteEventPayload } from "../types/delete";

config();

export async function fetchDeleteEventsFromList() {
    const deleteQueue = process.env.DELETE_EVENT_QUEUE || "delete_event_queue";
    console.log(`Delete worker starting, listening on Redis queue: "${deleteQueue}"`);

    while (true) {
        try {
            const result = await redis.blpop(deleteQueue, 5);
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
            }
        } catch (error) {
            console.error("Error popping delete event from Redis queue:", error);
            await new Promise((resolve) => setTimeout(resolve, 1000));
        }
    }
}
