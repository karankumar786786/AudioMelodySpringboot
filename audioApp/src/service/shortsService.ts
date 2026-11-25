import { api } from "./baseApi";
import { S3_BASE_URL } from "@/utils/playerUtils";

/**
 * Shorts: standalone vertical videos with their own audio, posted by One Melody or by
 * listeners, optionally linked to a catalog song. Backed by /api/shorts on the core API.
 */

export type ShortStatus = "UPLOADING" | "PROCESSING" | "READY" | "FAILED" | "HIDDEN" | "DELETED";
export type ShortSort = "foryou" | "latest" | "popular";
export type ReportReason = "SPAM" | "NUDITY" | "VIOLENCE" | "HATE" | "COPYRIGHT" | "OTHER";

export interface ShortOwner {
  type: "ADMIN" | "LISTENER";
  userId: string | null;
  userName: string | null;
}

export interface ShortSong {
  id: string;
  title: string;
  artistName: string;
  imageKey: string | null;
  songKey: string | null;
  duration: number | null;
}

export interface Short {
  id: string;
  caption: string | null;
  status: ShortStatus;
  hlsKey: string | null;
  thumbnailKey: string | null;
  durationMs: number | null;
  width: number | null;
  height: number | null;
  likesCount: number;
  viewsCount: number;
  liked: boolean;
  mine: boolean;
  owner: ShortOwner;
  song: ShortSong | null;
  failureReason: string | null;
  publishedAt: string | null;
  createdAt: string | null;
}

export interface ShortsPage {
  items: Short[];
  nextCursor: string | null;
}

export interface UploadTicket {
  shortId: string;
  uploadUrl: string;
  method: "PUT";
  contentType: string;
  expiresInSeconds: number;
}

/** Shorts are served from the production bucket, like songs. */
export function shortMediaUrl(key: string | null | undefined): string {
  if (!key) return "";
  if (/^https?:\/\//.test(key)) return key;
  return `${S3_BASE_URL}/${key.replace(/^\/+/, "")}`;
}

export const shortsService = {
  async feed(params: { sort?: ShortSort; cursor?: string | null; size?: number } = {}): Promise<ShortsPage> {
    const { data } = await api.get<ShortsPage>("/shorts/feed", {
      params: { sort: params.sort ?? "foryou", cursor: params.cursor || undefined, size: params.size ?? 8 },
    });
    return data;
  },

  async bySong(songId: string, cursor?: string | null): Promise<ShortsPage> {
    const { data } = await api.get<ShortsPage>(`/shorts/song/${encodeURIComponent(songId)}`, {
      params: { cursor: cursor || undefined, size: 12 },
    });
    return data;
  },

  async mine(cursor?: string | null): Promise<ShortsPage> {
    const { data } = await api.get<ShortsPage>("/shorts/mine", { params: { cursor: cursor || undefined, size: 24 } });
    return data;
  },

  async liked(cursor?: string | null): Promise<ShortsPage> {
    const { data } = await api.get<ShortsPage>("/shorts/liked", { params: { cursor: cursor || undefined, size: 24 } });
    return data;
  },

  async get(id: string): Promise<Short> {
    const { data } = await api.get<Short>(`/shorts/${encodeURIComponent(id)}`);
    return data;
  },

  async like(id: string): Promise<{ liked: boolean; likesCount: number }> {
    const { data } = await api.post(`/shorts/${encodeURIComponent(id)}/like`);
    return data;
  },

  async unlike(id: string): Promise<{ liked: boolean; likesCount: number }> {
    const { data } = await api.delete(`/shorts/${encodeURIComponent(id)}/like`);
    return data;
  },

  async report(id: string, reason: ReportReason, note?: string): Promise<void> {
    await api.post(`/shorts/${encodeURIComponent(id)}/report`, { reason, note });
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/shorts/${encodeURIComponent(id)}`);
  },

  async startUpload(body: { contentType: string; sizeBytes: number; caption?: string; songId?: string | null }): Promise<UploadTicket> {
    const { data } = await api.post<UploadTicket>("/shorts/uploads", body);
    return data;
  },

  async completeUpload(id: string): Promise<Short> {
    const { data } = await api.post<Short>(`/shorts/${encodeURIComponent(id)}/complete`);
    return data;
  },

  async recordViews(views: { shortId: string; watchedMs: number }[]): Promise<void> {
    if (views.length === 0) return;
    await api.post("/shorts/views", { views });
  },
};

/**
 * PUTs a local file to a pre-signed URL. XMLHttpRequest reports upload progress, which
 * fetch doesn't, and React Native's XHR can send a local file URI directly.
 */
export function putFile(
  url: string,
  file: { uri: string; type: string; name: string },
  onProgress?: (fraction: number) => void,
  xhrFactory: () => XMLHttpRequest = () => new XMLHttpRequest(),
): { promise: Promise<void>; cancel: () => void } {
  const xhr = xhrFactory();
  const promise = new Promise<void>((resolve, reject) => {
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) onProgress?.(e.loaded / e.total);
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
    xhr.onerror = () => reject(new Error("Upload failed: check your connection"));
    xhr.onabort = () => reject(new Error("Upload cancelled"));
    // React Native accepts { uri, type, name } as an XHR body for local files.
    xhr.send(file as unknown as Blob);
  });
  return { promise, cancel: () => xhr.abort() };
}

/** Collects views and sends them in batches, so scrolling the feed isn't one request per short. */
export function createViewTracker(
  send: (views: { shortId: string; watchedMs: number }[]) => Promise<void> = shortsService.recordViews,
  maxBatch = 50,
) {
  let pending: { shortId: string; watchedMs: number }[] = [];
  return {
    /** Call when a short stops being the active one. Views under a second aren't sent. */
    record(shortId: string, watchedMs: number) {
      if (watchedMs < 1000) return;
      pending.push({ shortId, watchedMs: Math.min(Math.round(watchedMs), 600_000) });
      if (pending.length >= maxBatch) void this.flush();
    },
    async flush() {
      if (pending.length === 0) return;
      const batch = pending.slice(0, maxBatch);
      pending = pending.slice(batch.length);
      try {
        await send(batch);
      } catch {
        // Views are best effort; drop the batch rather than retry forever.
      }
    },
    size: () => pending.length,
  };
}
