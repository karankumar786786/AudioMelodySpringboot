import { inngest } from "../inngest";
import { deleteApi } from "../axios";
import type { DeleteEventPayload } from "../types/delete";

export const deleteFromRecombee = inngest.createFunction(
    {
        id: "delete-from-recombee",
        triggers: [{ event: "audio/delete.recombee" }],
        onFailure: async ({ event, error }) => {
            const data = (event?.data?.event?.data || event?.data) as DeleteEventPayload | undefined;
            if (data?.entityId && data?.entityType) {
                console.error(`[DELETE-RECOMMENDATION FAILED] Notifying coreEngine for ${data.entityType}:${data.entityId}:`, error?.message);
                try {
                    await deleteApi.post(`/${data.entityType}/${data.entityId}/failed`, {
                        reason: `Recombee delete failed: ${error?.message || "Unknown error"}`,
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

        await step.run("delete-recommendation-record", async () => {
            console.log(`[DELETE-RECOMMENDATION] Removing ${data.entityType}:${data.entityId} from Recombee...`);
            await deleteApi.post(`/${data.entityType}/${data.entityId}/delete-recommendation`, null, {
                params: data.deleteJobId ? { deleteJobId: data.deleteJobId } : undefined,
            });
            console.log(`[DELETE-RECOMMENDATION] Successfully removed ${data.entityType}:${data.entityId} from Recombee`);
        });

        await step.sendEvent("trigger-delete-imagekit", {
            name: "audio/delete.imagekit",
            data,
        });

        return { status: "success", entityId: data.entityId };
    }
);
