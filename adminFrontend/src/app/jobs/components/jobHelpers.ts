import { JobStage, DeleteJobStage } from "@/lib/api";

/**
 * Transforms raw system/CLI/Inngest exceptions into user-friendly, actionable failure descriptions.
 */
export function formatFailureNotice(reason?: string | null): { title: string; explanation: string; raw?: string } {
  if (!reason) {
    return { title: "Pipeline Failure Notice", explanation: "Execution halted unexpectedly during processing." };
  }

  // 1. HTTP 413 / Inngest SDK Payload error
  if (/413|Payload Too Large|before the SDK responded/i.test(reason)) {
    return {
      title: "Worker Payload Limit Exceeded (HTTP 413)",
      explanation:
        "Express body parser limit was exceeded by large job logs. The server limit has been raised to 50MB; click Retry Now to resume.",
      raw: reason,
    };
  }

  // 2. Corrupted audio or video packets
  if (
    /Invalid data found|channel element.*not allocated|Reserved bit set|decode_pce|Input buffer exhausted|Error submitting packet|Prediction is not allowed|Gain control is not implemented|Corrupt/i.test(
      reason
    )
  ) {
    return {
      title: "Corrupt Media Stream Detected",
      explanation:
        "The uploaded file contains damaged or non-standard audio/video packets. The worker has been updated to auto-discard bad packets; click Retry Now.",
      raw: reason,
    };
  }

  // 3. S3 Storage
  if (/NoSuchKey|The specified key does not exist|Missing tempSongKey|Missing tempVideoKey/i.test(reason)) {
    return {
      title: "Storage Key Missing or Expired",
      explanation:
        "The temporary uploaded media file could not be found in S3 (it may have expired or already been cleaned up).",
      raw: reason,
    };
  }

  // 4. Invalid Duration
  if (/Invalid (audio|video) duration/i.test(reason)) {
    return {
      title: "Invalid Media Duration",
      explanation: "The uploaded file has 0 seconds duration or an unreadable media container header.",
      raw: reason,
    };
  }

  // 5. Network Timeout
  if (/ECONNREFUSED|ETIMEDOUT|timeout/i.test(reason)) {
    return {
      title: "Internal Service Timeout",
      explanation: "The worker timed out while communicating with backend microservices or S3.",
      raw: reason,
    };
  }

  // 6. Generic FFmpeg command failure
  if (/Command failed:\s*ffmpeg/i.test(reason)) {
    return {
      title: "Transcoder Conversion Failed",
      explanation: "FFmpeg encountered an encoding or packaging error while processing renditions.",
      raw: reason,
    };
  }

  // Default clean output
  const cleanReason = reason.length > 200 ? `${reason.slice(0, 197)}...` : reason;
  return {
    title: "Pipeline Failure Notice",
    explanation: cleanReason,
    raw: reason.length > 200 ? reason : undefined,
  };
}

export function formatMs(ms?: number | null): string {
  if (ms == null) return "-";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function formatTime(isoString?: string | null): string {
  if (!isoString) return "-";
  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return isoString;
  }
}

export function getStatusBadge(status: string) {
  switch (status) {
    case "COMPLETED":
      return { label: "Completed", dot: "bg-emerald-500", text: "text-emerald-500", bg: "bg-emerald-500/10 border-emerald-500/20" };
    case "PROCESSING":
    case "IN_PROGRESS":
      return { label: "Processing", dot: "bg-indigo-500 animate-ping", text: "text-indigo-500", bg: "bg-indigo-500/10 border-indigo-500/20" };
    case "PENDING":
      return { label: "Queued", dot: "bg-amber-500", text: "text-amber-500", bg: "bg-amber-500/10 border-amber-500/20" };
    case "FAILED":
      return { label: "Failed", dot: "bg-rose-500", text: "text-rose-500", bg: "bg-rose-500/10 border-rose-500/20" };
    default:
      return { label: status, dot: "bg-zinc-500", text: "text-zinc-500", bg: "bg-zinc-500/10 border-zinc-500/20" };
  }
}

export function getStageBadge(stage: JobStage) {
  switch (stage) {
    case "QUEUED":
      return { label: "Queued", bg: "bg-amber-500/10 text-amber-500 border-amber-500/20" };
    case "TRANSCODING":
      return { label: "Transcoding", bg: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20 animate-pulse" };
    case "RECOMMENDATION_INDEXING":
      return { label: "Recombee Sync", bg: "bg-purple-500/10 text-purple-500 border-purple-500/20" };
    case "SEARCH_INDEXING":
      return { label: "Algolia Sync", bg: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20" };
    case "FINALIZING":
      return { label: "Finalizing", bg: "bg-blue-500/10 text-blue-500 border-blue-500/20" };
    case "COMPLETED":
      return { label: "Completed", bg: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" };
    case "FAILED":
      return { label: "Failed", bg: "bg-rose-500/10 text-rose-500 border-rose-500/20" };
    default:
      return { label: stage, bg: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20" };
  }
}

export function getDeleteStatusBadge(status: string) {
  return getStatusBadge(status);
}

export function getDeleteStageBadge(stage: DeleteJobStage) {
  switch (stage) {
    case "QUEUED":
      return { label: "Queued", bg: "bg-amber-500/10 text-amber-500 border-amber-500/20" };
    case "SEARCH_DELETED":
      return { label: "Algolia Purged", bg: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20" };
    case "RECOMMENDATION_DELETED":
      return { label: "Recombee Purged", bg: "bg-purple-500/10 text-purple-500 border-purple-500/20" };
    case "IMAGEKIT_DELETED":
      return { label: "ImageKit Purged", bg: "bg-pink-500/10 text-pink-500 border-pink-500/20" };
    case "S3_DELETED":
      return { label: "S3 Purged", bg: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20" };
    case "COMPLETED":
      return { label: "Hard Deleted", bg: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" };
    case "FAILED":
      return { label: "Delete Failed", bg: "bg-rose-500/10 text-rose-500 border-rose-500/20" };
    default:
      return { label: stage, bg: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20" };
  }
}
