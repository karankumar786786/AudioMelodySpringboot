/**
 * Delete chain ke har Inngest event ka data (admin API bhejta hai, har step aage pass karta hai).
 * Keys = jo files hatani hain; deleteJobId = admin API ki DeleteJob row.
 */
export interface DeleteEventPayload {
    deleteJobId?: string | null;
    entityType: "SONG" | "PLAYLIST" | "ARTIST" | string;
    entityId: string;
    entityTitle?: string | null;
    songKey?: string | null;
    imageKey?: string | null;
    coverImageKey?: string | null;
    bannerImageKey?: string | null;
    videoKey?: string | null;
    fullVideoKey?: string | null;
}