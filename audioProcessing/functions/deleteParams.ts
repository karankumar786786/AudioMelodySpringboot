/**
 * Delete chain ke functions ka chhota helper (pehle har file me copy tha).
 */
import type { DeleteEventPayload } from "../types/delete";

/**
 * Admin API ke delete webhooks ke liye query params: deleteJobId ho to { deleteJobId }, warna undefined.
 * deleteJobId se admin API sahi DeleteJob row update karta hai (ek entity ke kai delete jobs ho sakte hain).
 */
export function deleteJobParams(data: DeleteEventPayload): { deleteJobId: string } | undefined {
    return data.deleteJobId ? { deleteJobId: data.deleteJobId } : undefined;
}
