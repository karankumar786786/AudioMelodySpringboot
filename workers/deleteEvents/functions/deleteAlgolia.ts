import { inngest } from "../inngest";
import { deleteApi } from "../axios";
import type { DeleteEventPayload } from "../types/delete";

export const deleteAlgolia = inngest.createFunction(
    {
        id: "delete-algolia",
        triggers: [{ event: "audio/delete.algolia" }],
    },
    async ({ event, step }) => {
        const data = event.data as DeleteEventPayload;
        if (!data?.entityId) {
            throw new Error("Missing entityId in delete event data");
        }

        await step.run("delete-algolia-record", async () => {
            await deleteApi.post(`/${data.entityType}/${data.entityId}/delete-search`);
        });

        await step.sendEvent("trigger-delete-recommendation", {
            name: "audio/delete.recombee",
            data,
        });

        return { status: "success", entityId: data.entityId };
    }
);
