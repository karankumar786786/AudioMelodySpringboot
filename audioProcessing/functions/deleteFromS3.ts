import { inngest } from "../inngest";
import { deletePrefix } from "../lib/s3";
import type { DeleteEventPayload } from "../types/delete";

export const deleteFromS3 = inngest.createFunction(
    {
        id: "delete-from-s3",
        triggers: [{ event: "audio/delete.s3" }]
    },
    async ({ event, step }) => {
        const data = event.data as DeleteEventPayload;
        if (!data?.entityId) {
            throw new Error("Missing entityId in delete event data");
        }

        await step.run("delete-s3-assets", async () => {
            const productionBucket = process.env.PRODUCTION_BUCKET_NAME || "audiomelodyspringboot";

            if (data.songKey) {
                console.log(`[DELETE-S3] Purging audio S3 assets under prefix "${data.songKey}"...`);
                await deletePrefix(productionBucket, data.songKey);
            }

            if (data.fullVideoKey) {
                console.log(`[DELETE-S3] Purging video S3 assets under prefix "${data.fullVideoKey}"...`);
                await deletePrefix(productionBucket, data.fullVideoKey);
            } else if (data.entityId && data.entityType === "SONG") {
                const videoBasePath = process.env.VIDEO_BASE_PATH || "videos";
                await deletePrefix(productionBucket, `${videoBasePath}/${data.entityId}`);
            }

            console.log(`[DELETE-S3] Successfully purged S3 assets for ${data.entityType}:${data.entityId}`);
        });

        await step.sendEvent("trigger-delete-finalize", {
            name: "audio/delete.finalize",
            data,
        });

        return { status: "success", entityId: data.entityId };
    }
);
