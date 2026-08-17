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
        console.log("[Delete S3] Received event", { entityId: data?.entityId, data });
        
        if (!data?.entityId) {
            throw new Error("Missing entityId in delete event data");
        }

        await step.run("delete-s3-assets", async () => {
            const productionBucket = process.env.PRODUCTION_BUCKET_NAME || "audioprocessingproduction";
            console.log("[Delete S3] Step started", {
                entityId: data.entityId,
                entityType: data.entityType,
                hasSongKey: Boolean(data.songKey),
                songKey: data.songKey,
                bucket: productionBucket,
            });

            if (!data.songKey) {
                console.log("[Delete S3] No songKey, skipping", { entityId: data.entityId });
                return;
            }

            try {
                await deleteObject(productionBucket, data.songKey);
                console.log("[Delete S3] Successfully deleted", {
                    entityId: data.entityId,
                    bucket: productionBucket,
                    songKey: data.songKey,
                });
            } catch (error) {
                console.error("[Delete S3] ERROR deleting song asset", {
                    entityId: data.entityId,
                    bucket: productionBucket,
                    songKey: data.songKey,
                    error: error instanceof Error ? error.message : String(error),
                    stack: error instanceof Error ? error.stack : undefined,
                });
                throw error;
            }
        });

        await step.sendEvent("trigger-delete-finalize", {
            name: "audio/delete.finalize",
            data,
        });

        return { status: "success", entityId: data.entityId };
    }
);
