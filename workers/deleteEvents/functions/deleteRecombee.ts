import { inngest } from "../inngest";
import { deleteApi } from "../axios";
import type { DeleteEventPayload } from "../types/delete";

export const deleteRecombee = inngest.createFunction(
    {
        id: "delete-recombee",
        triggers: [{ event: "audio/delete.recombee" }],
    },
    async ({ event, step }) => {
        const data = event.data as DeleteEventPayload;
        if (!data?.entityId) {
            throw new Error("Missing entityId in delete event data");
        }

        await step.run("delete-recommendation-record", async () => {
            await deleteApi.post(`/${data.entityType}/${data.entityId}/delete-recommendation`);
        });

        await step.sendEvent("trigger-delete-imagekit", {
            name: "audio/delete.imagekit",
            data,
        });

        return { status: "success", entityId: data.entityId };
    }
);
