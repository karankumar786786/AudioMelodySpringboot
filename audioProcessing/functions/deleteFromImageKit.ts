import { inngest } from "../inngest";
import { deleteApi } from "../axios";
import type { DeleteEventPayload } from "../types/delete";
import { extractMeaningfulError } from "../lib/errorUtils";

export const deleteFromImageKit = inngest.createFunction(
    {
        id: "delete-from-imagekit",
        triggers: [{ event: "audio/delete.imagekit" }],
        onFailure: async ({ event, error }) => {
            const data = (event?.data?.event?.data || event?.data) as DeleteEventPayload | undefined;
            if (data?.entityId && data?.entityType) {
                const reason = extractMeaningfulError(error, "ImageKit CDN asset purge failed");
                console.error(`[DELETE-IMAGEKIT FAILED] Notifying coreEngine for ${data.entityType}:${data.entityId}:`, reason);
                try {
                    await deleteApi.post(`/${data.entityType}/${data.entityId}/failed`, {
                        reason: `ImageKit teardown: ${reason}`,
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

        await step.run("delete-imagekit-assets", async () => {
            console.log(`[DELETE-IMAGEKIT] Purging ImageKit assets for ${data.entityType}:${data.entityId}...`);
            await deleteApi.post(`/${data.entityType}/${data.entityId}/delete-imagekit`, null, {
                params: data.deleteJobId ? { deleteJobId: data.deleteJobId } : undefined,
            });
            console.log(`[DELETE-IMAGEKIT] Successfully purged ImageKit assets for ${data.entityType}:${data.entityId}`);
        });

        await step.sendEvent("trigger-delete-s3", {
            name: "audio/delete.s3",
            data,
        });

        return { status: "success", entityId: data.entityId };
    }
);
