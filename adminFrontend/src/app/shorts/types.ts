export type ShortStatus =
  | "UPLOADING"
  | "PROCESSING"
  | "READY"
  | "FAILED"
  | "HIDDEN"
  | "DELETED";

export interface ShortItem {
  id: string;
  ownerType: "ADMIN" | "LISTENER";
  userId: string | null;
  adminId: string | null;
  songId: string | null;
  songTitle: string | null;
  caption: string | null;
  status: ShortStatus;
  hlsKey: string | null;
  thumbnailKey: string | null;
  durationMs: number | null;
  width: number | null;
  height: number | null;
  likesCount: number;
  viewsCount: number;
  reportsCount: number;
  failureReason: string | null;
  hiddenReason: string | null;
  createdAt: string | null;
  publishedAt: string | null;
}

export interface ShortReportItem {
  id: number;
  shortId: string;
  shortStatus: ShortStatus;
  shortCaption: string | null;
  thumbnailKey: string | null;
  reporterId: string;
  reporterEmail: string | null;
  reason: string;
  note: string | null;
  resolved: boolean;
  createdAt: string | null;
}

export type ShortAction = "hide" | "unhide" | "delete";

export const SHORT_STATUS_FILTERS = [
  "ALL",
  "READY",
  "PROCESSING",
  "UPLOADING",
  "FAILED",
  "HIDDEN",
] as const;
export type ShortStatusFilter = (typeof SHORT_STATUS_FILTERS)[number];
export type ShortOwnerFilter = "ALL" | "ADMIN" | "LISTENER";

const S3_BASE_URL =
  process.env.NEXT_PUBLIC_S3_BASE_URL ||
  "https://audiomelodyspringboot.s3.ap-south-1.amazonaws.com";

/** Shorts are served from the production bucket, like songs. */
export function shortMediaUrl(key: string | null | undefined): string {
  if (!key) return "";
  if (key.startsWith("http")) return key;
  return `${S3_BASE_URL}/${key.replace(/^\/+/, "")}`;
}

export function formatDuration(ms: number | null | undefined): string {
  if (!ms || ms <= 0) return "–";
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
