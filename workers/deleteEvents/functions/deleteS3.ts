import { inngest } from "../inngest";
import { deleteObject } from "../lib/s3";
import type { DeleteEventPayload } from "../types/delete";

export const deleteS3 = inngest.createFunction(
    {
        id: "delete-s3",
        triggers: [{ event: "audio/delete.s3" }],
    },
    async ({ event, step }) => {
        const data = event.data as DeleteEventPayload;
        if (!data?.entityId) {
            throw new Error("Missing entityId in delete event data");
        }

        await step.run("delete-s3-assets", async () => {
            if (data.entityType !== "SONG" || !data.songKey) {
                return;
            }

            const productionBucket = process.env.PRODUCTION_BUCKET_NAME || "audioprocessingproduction";
            await deleteObject(productionBucket, data.songKey);
        });

        await step.sendEvent("trigger-delete-finalize", {
            name: "audio/delete.finalize",
            data,
        });

        return { status: "success", entityId: data.entityId };
    }
);
