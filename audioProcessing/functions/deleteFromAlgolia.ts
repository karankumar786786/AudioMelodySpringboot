import { inngest } from "../inngest";
import { deleteApi } from "../axios";
import type { DeleteEventPayload } from "../types/delete";
import { extractMeaningfulError } from "../lib/errorUtils";

export const deleteFromAlgolia = inngest.createFunction(
    {
        id: "delete-from-algolia",
        triggers: [{ event: "audio/delete.algolia" }],
        onFailure: async ({ event, error }) => {
            const data = (event?.data?.event?.data || event?.data) as DeleteEventPayload | undefined;
            if (data?.entityId && data?.entityType) {
                const reason = extractMeaningfulError(error, "Algolia search document purge failed");
                console.error(`[DELETE-ALGOLIA FAILED] Notifying coreEngine for ${data.entityType}:${data.entityId}:`, reason);
                try {
                    await deleteApi.post(`/${data.entityType}/${data.entityId}/failed`, {
                        reason: `Algolia teardown: ${reason}`,
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

            // Direct Algolia purge fallback if credentials configured
            const appId = process.env.ALGOLIA_APP_ID;
            const apiKey = process.env.ALGOLIA_API_KEY;
            const indexName = process.env.ALGOLIA_INDEX_NAME || "one_melody_springboot";

            if (appId && apiKey && data.entityId) {
                try {
                    const directUrl = `https://${appId}.algolia.net/1/indexes/${encodeURIComponent(indexName)}/${encodeURIComponent(data.entityId)}`;
                    await fetch(directUrl, {
                        method: "DELETE",
                        headers: {
                            "X-Algolia-Application-Id": appId,
                            "X-Algolia-API-Key": apiKey,
                        },
                    });
                    console.log(`[DELETE-ALGOLIA] Direct Algolia purge executed for ${data.entityId}`);
                } catch (delErr) {
                    console.warn(`[DELETE-ALGOLIA] Direct Algolia purge error (webhook handled it):`, delErr);
                }
            }

            console.log(`[DELETE-ALGOLIA] Successfully removed ${data.entityType}:${data.entityId} from Algolia`);
        });

        await step.sendEvent("trigger-delete-recommendation", {
            name: "audio/delete.recombee",
            data,
        });

        return { status: "success", entityId: data.entityId };
    }
);
