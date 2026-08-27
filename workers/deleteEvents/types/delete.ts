export interface DeleteEventPayload {
    entityType: "SONG" | "PLAYLIST" | "ARTIST" | string;
    entityId: string;
    songKey?: string | null;
    imageKey?: string | null;
    coverImageKey?: string | null;
    videoKey?: string | null;
}
