/**
 * The listener upload flow as a small state machine, kept free of React and native
 * modules so it can be unit tested:
 *   idle → checking → uploading(progress) → finalizing → done
 *                 ↘ error (any step), retry from idle
 */

export type UploadState =
  | { step: "idle" }
  | { step: "checking" }
  | { step: "uploading"; progress: number }
  | { step: "finalizing" }
  | { step: "done"; shortId: string }
  | { step: "error"; message: string };

export interface PickedVideo {
  uri: string;
  mimeType?: string | null;
  fileSize?: number | null;
  durationMs?: number | null;
  width?: number;
  height?: number;
  fileName?: string | null;
}

export const MAX_SHORT_MS = 60_000;
export const MAX_SHORT_BYTES = 100 * 1024 * 1024;

/** Why a picked video can't be posted, or null. Mirrors the server and pipeline checks. */
export function validatePick(v: PickedVideo): string | null {
  const type = normalizeType(v);
  if (type !== "video/mp4" && type !== "video/quicktime") return "Choose an MP4 or MOV video";
  if (v.fileSize != null && v.fileSize > MAX_SHORT_BYTES) return "Videos can be at most 100 MB";
  if (v.durationMs != null && v.durationMs > MAX_SHORT_MS + 500) return "Shorts can be at most 60 seconds";
  return null;
}

export function normalizeType(v: PickedVideo): string {
  const t = (v.mimeType || "").toLowerCase();
  if (t === "video/mp4" || t === "video/quicktime") return t;
  const name = (v.fileName || v.uri).toLowerCase();
  if (name.endsWith(".mov")) return "video/quicktime";
  if (name.endsWith(".mp4") || name.endsWith(".m4v")) return "video/mp4";
  return t || "video/mp4";
}

export interface UploadDeps {
  startUpload: (body: { contentType: string; sizeBytes: number; caption?: string; songId?: string | null }) => Promise<{ shortId: string; uploadUrl: string }>;
  putFile: (url: string, file: { uri: string; type: string; name: string }, onProgress: (f: number) => void) => Promise<void>;
  completeUpload: (shortId: string) => Promise<unknown>;
}

/** Runs one upload, reporting each state to `onState`. Resolves with the final state. */
export async function runUpload(
  video: PickedVideo,
  input: { caption?: string; songId?: string | null },
  deps: UploadDeps,
  onState: (s: UploadState) => void,
): Promise<UploadState> {
  const set = (s: UploadState) => {
    onState(s);
    return s;
  };
  set({ step: "checking" });
  const problem = validatePick(video);
  if (problem) return set({ step: "error", message: problem });
  const type = normalizeType(video);
  try {
    const ticket = await deps.startUpload({
      contentType: type,
      sizeBytes: video.fileSize ?? 1,
      caption: input.caption?.trim() || undefined,
      songId: input.songId ?? null,
    });
    set({ step: "uploading", progress: 0 });
    await deps.putFile(
      ticket.uploadUrl,
      { uri: video.uri, type, name: video.fileName || `short.${type === "video/quicktime" ? "mov" : "mp4"}` },
      (f) => set({ step: "uploading", progress: Math.max(0, Math.min(1, f)) }),
    );
    set({ step: "finalizing" });
    await deps.completeUpload(ticket.shortId);
    return set({ step: "done", shortId: ticket.shortId });
  } catch (e) {
    return set({ step: "error", message: errorMessage(e) });
  }
}

function errorMessage(e: unknown): string {
  const status = (e as { response?: { status?: number; data?: { message?: string } } })?.response;
  if (status?.data?.message) return status.data.message;
  if (status?.status === 429) return "You've posted the maximum shorts for today. Try again tomorrow.";
  if (status?.status === 403) return "You can't post shorts right now.";
  return e instanceof Error ? e.message : "Upload failed";
}
