import { inngest } from "../inngest";
import { deleteApi } from "../axios";
import type { DeleteEventPayload } from "../types/delete";

export const deleteImageKit = inngest.createFunction(
    {
        id: "delete-imagekit",
        triggers: [{ event: "audio/delete.imagekit" }],
    },
    async ({ event, step }) => {
        const data = event.data as DeleteEventPayload;
        if (!data?.entityId) {
            throw new Error("Missing entityId in delete event data");
        }

        await step.run("delete-imagekit-assets", async () => {
            await deleteApi.post(`/${data.entityType}/${data.entityId}/delete-imagekit`);
        });

        await step.sendEvent("trigger-delete-s3", {
            name: "audio/delete.s3",
            data,
        });

        return { status: "success", entityId: data.entityId };
    }
);
