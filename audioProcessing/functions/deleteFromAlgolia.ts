import { inngest } from "../inngest";
import { deleteApi } from "../axios";
import type { DeleteEventPayload } from "../types/delete";

export const deleteFromAlgolia = inngest.createFunction(
    {
        id: "delete-from-algolia",
        triggers: [{ event: "audio/delete.algolia" }],
        onFailure: async ({ event, error }) => {
            const data = (event?.data?.event?.data || event?.data) as DeleteEventPayload | undefined;
            if (data?.entityId && data?.entityType) {
                console.error(`[DELETE-ALGOLIA FAILED] Notifying coreEngine for ${data.entityType}:${data.entityId}:`, error?.message);
                try {
                    await deleteApi.post(`/${data.entityType}/${data.entityId}/failed`, {
                        reason: `Algolia delete failed: ${error?.message || "Unknown error"}`,
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

        await step.run("delete-algolia-record", async () => {
            console.log(`[DELETE-ALGOLIA] Removing ${data.entityType}:${data.entityId} from Algolia...`);
            await deleteApi.post(`/${data.entityType}/${data.entityId}/delete-search`, null, {
                params: data.deleteJobId ? { deleteJobId: data.deleteJobId } : undefined,
            });
            console.log(`[DELETE-ALGOLIA] Successfully removed ${data.entityType}:${data.entityId} from Algolia`);
        });

        await step.sendEvent("trigger-delete-recommendation", {
            name: "audio/delete.recombee",
            data,
        });

        return { status: "success", entityId: data.entityId };
    }
);
