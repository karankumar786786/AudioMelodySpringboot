import { inngest } from "../inngest";
import { deleteApi } from "../axios";
import type { DeleteEventPayload } from "../types/delete";

export const finalizeDelete = inngest.createFunction(
    {
        id: "finalize-delete",
        triggers: [{ event: "audio/delete.finalize" }],
        onFailure: async ({ event, error }) => {
            const data = (event?.data?.event?.data || event?.data) as DeleteEventPayload | undefined;
            if (data?.entityId && data?.entityType) {
                console.error(`[FINALIZE-DELETE FAILED] Notifying coreEngine for ${data.entityType}:${data.entityId}:`, error?.message);
                try {
                    await deleteApi.post(`/${data.entityType}/${data.entityId}/failed`, {
                        reason: `Finalizing hard delete failed: ${error?.message || "Unknown error"}`,
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

        await step.run("final-delete-callback", async () => {
            console.log(`[FINALIZE-DELETE] Executing database hard delete for ${data.entityType}:${data.entityId}...`);
            await deleteApi.post(`/${data.entityType}/${data.entityId}/hard-delete`, null, {
                params: data.deleteJobId ? { deleteJobId: data.deleteJobId } : undefined,
            });
            console.log(`[FINALIZE-DELETE] Successfully finalized delete for ${data.entityType}:${data.entityId}`);
        });

        return { status: "success", entityId: data.entityId };
    }
);