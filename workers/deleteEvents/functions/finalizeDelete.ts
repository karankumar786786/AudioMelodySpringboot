import { inngest } from "../inngest";
import { deleteApi } from "../axios";
import type { DeleteEventPayload } from "../types/delete";

export const finalizeDelete = inngest.createFunction(
    {
        id: "finalize-delete",
        triggers: [{ event: "audio/delete.finalize" }],
    },
    async ({ event, step }) => {
        const data = event.data as DeleteEventPayload;
        if (!data?.entityId) {
            throw new Error("Missing entityId in delete event data");
        }

        await step.run("final-delete-callback", async () => {
            await deleteApi.post(`/${data.entityType}/${data.entityId}/hard-delete`);
        });

        return { status: "success", entityId: data.entityId };
    }
);
