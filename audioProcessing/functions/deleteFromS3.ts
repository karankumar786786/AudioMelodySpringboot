import { inngest } from "../inngest";
import { deletePrefix } from "../lib/s3";
import { deleteApi } from "../axios";
import type { DeleteEventPayload } from "../types/delete";
import { extractMeaningfulError } from "../lib/errorUtils";

export const deleteFromS3 = inngest.createFunction(
    {
        id: "delete-from-s3",
        triggers: [{ event: "audio/delete.s3" }],
        onFailure: async ({ event, error }) => {
            const data = (event?.data?.event?.data || event?.data) as DeleteEventPayload | undefined;
            if (data?.entityId && data?.entityType) {
                const reason = extractMeaningfulError(error, "S3 asset deletion failed");
                console.error(`[DELETE-S3 FAILED] Notifying coreEngine for ${data.entityType}:${data.entityId}:`, reason);
                try {
                    await deleteApi.post(`/${data.entityType}/${data.entityId}/failed`, {
                        reason: `S3 deletion: ${reason}`,
                    }, {
                        params: data.deleteJobId ? { deleteJobId: data.deleteJobId } : undefined
                    });
                } catch (e) {
                    console.error(`Failed to notify coreEngine of delete failure:`, e);
                }
            }
        },
    },
    async ({ event, step }) => {
        const data = event.data as DeleteEventPayload;
        if (!data?.entityId || !data?.entityType) {
            throw new Error("Missing entityId or entityType in delete event data");
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

            // Notify coreEngine of S3 stage completion
            try {
                await deleteApi.post(`/${data.entityType}/${data.entityId}/delete-s3`, null, {
                    params: data.deleteJobId ? { deleteJobId: data.deleteJobId } : undefined,
                });
            } catch (notifyError) {
                console.warn(`[DELETE-S3] Webhook stage notification warning for ${data.entityId}:`, notifyError);
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
