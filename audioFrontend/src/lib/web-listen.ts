import {
  type ListenDetail,
  ListenTracker,
  type ServerQuality,
} from "./listenTracker";

/**
 * The web player's listen tracker (one audio element, one track at a time). useAudioSync
 * begins it on each track, feeds it the element's events and sends finish() with the
 * play report; a skip marks the listen as skipped before the track changes.
 */
export const webListen = new ListenTracker();
let skipPending = false;

/** The player's quality setting ("auto" or an hls.js level bitrate) as the server names it. */
export function qualityLabel(selected: unknown): ServerQuality {
  if (typeof selected !== "number" || !Number.isFinite(selected)) return "auto";
  if (selected < 180_000) return "128kbps";
  if (selected < 280_000) return "240kbps";
  return "320kbps";
}

export function beginWebListen(selectedQuality: unknown): void {
  skipPending = false;
  webListen.begin({ quality: qualityLabel(selectedQuality), platform: "web" });
}

export function markWebSkip(): void {
  skipPending = true;
}

/** Feeds one audio element event; buffering = not enough data to keep playing. */
export function tickWebListen(el: HTMLMediaElement): void {
  if (!Number.isFinite(el.currentTime)) return;
  webListen.tick(
    el.currentTime * 1000,
    !el.paused && !el.ended,
    !el.paused && el.readyState < 3,
  );
}

export function finishWebListen(exitSec: number): ListenDetail | null {
  const detail = webListen.finish(exitSec * 1000, skipPending);
  skipPending = false;
  return detail;
}
