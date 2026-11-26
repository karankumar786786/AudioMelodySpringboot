/**
 * Inngest function "delete-from-recombee": Recombee se item hatao.
 * Delete chain (Inngest): delete.algolia -> delete.recombee -> delete.imagekit -> delete.s3 -> delete.finalize.
 *
 * Agla event: audio/delete.imagekit. Saare retries fail = onFailure admin API ko /failed batata hai (DeleteJob FAILED).
 */
import { inngest } from "../inngest";
import { deleteApi } from "../axios";
import type { DeleteEventPayload } from "../types/delete";
import { deleteJobParams } from "./deleteParams";
import { extractMeaningfulError } from "../lib/errorUtils";

/** Admin API /delete-recommendation call karo, phir agla step. entityId / entityType na ho to error. */
export const deleteFromRecombee = inngest.createFunction(
    {
        id: "delete-from-recombee",
        triggers: [{ event: "audio/delete.recombee" }],
        onFailure: async ({ event, error }) => {
            const data = (event?.data?.event?.data || event?.data) as DeleteEventPayload | undefined;
            if (data?.entityId && data?.entityType) {
                const reason = extractMeaningfulError(error, "Recombee vector purge failed");
                console.error(`[DELETE-RECOMMENDATION FAILED] Notifying coreEngine for ${data.entityType}:${data.entityId}:`, reason);
                try {
                    await deleteApi.post(`/${data.entityType}/${data.entityId}/failed`, {
                        reason: `Recombee teardown: ${reason}`,
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

        await step.run("delete-recommendation-record", async () => {
            console.log(`[DELETE-RECOMMENDATION] Removing ${data.entityType}:${data.entityId} from Recombee...`);
            await deleteApi.post(`/${data.entityType}/${data.entityId}/delete-recommendation`, null, {
                params: deleteJobParams(data),
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
