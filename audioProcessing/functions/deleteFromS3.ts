/**
 * Inngest function "delete-from-s3": production S3 se audio / video chunks hatao.
 * Delete chain (Inngest): delete.algolia -> delete.recombee -> delete.imagekit -> delete.s3 -> delete.finalize.
 *
 * Agla event: audio/delete.finalize. Saare retries fail = onFailure admin API ko /failed batata hai (DeleteJob FAILED).
 */
import { inngest } from "../inngest";
import { deletePrefix } from "../lib/s3";
import { deleteApi } from "../axios";
import type { DeleteEventPayload } from "../types/delete";
import { deleteJobParams } from "./deleteParams";
import { extractMeaningfulError } from "../lib/errorUtils";

/** S3 se files yahin hatao, admin ko /delete-s3 batao, phir agla step. entityId / entityType na ho to error. */
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
                        params: deleteJobParams(data)
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

        // S3 files yahan (media pipeline) hi hatate hain; admin API ko sirf stage batate hain
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
                // fullVideoKey nahi pata to song ke default video folder ko hatao
                const videoBasePath = process.env.VIDEO_BASE_PATH || "videos";
                await deletePrefix(productionBucket, `${videoBasePath}/${data.entityId}`);
            }

            // Admin API ko batao ki S3 stage ho gaya (fail = sirf warning, delete chain chalti rahe)
            try {
                await deleteApi.post(`/${data.entityType}/${data.entityId}/delete-s3`, null, {
                    params: deleteJobParams(data),
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
