/**
 * Inngest function "delete-short": short ki published files (shorts/<id>/) aur raw upload hatao.
 * Event "shorts/delete" (admin / core API bhejta hai).
 */
import { inngest } from "../inngest";
import { deleteObject, deletePrefix } from "../lib/s3";
import { SHORTS_BASE_PATH } from "./processShort";

/** Event ka data. */
export interface DeleteShortData {
    shortId: string;
    rawKey?: string | null;
}

/** shortId na ho to skip. Pehle published folder, phir (ho to) raw upload delete. */
export const deleteShort = inngest.createFunction(
    {
        id: "delete-short",
        triggers: [{ event: "shorts/delete" }],
        retries: 3,
    },
    async ({ event, step }) => {
        const { shortId, rawKey } = event.data as DeleteShortData;
        if (!shortId) return { skipped: true };
        const tempBucket = process.env.TEMP_BUCKET_NAME || "audiomelodyspringboottemp";
        const prodBucket = process.env.PRODUCTION_BUCKET_NAME || "audiomelodyspringboot";

        await step.run("delete-published-files", async () => {
            await deletePrefix(prodBucket, `${SHORTS_BASE_PATH}/${shortId}/`);
        });
        if (rawKey) {
            await step.run("delete-raw-upload", async () => {
                await deleteObject(tempBucket, rawKey);
            });
        }
        return { deleted: shortId };
    }
);
