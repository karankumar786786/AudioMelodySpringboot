import { AudioStatus } from "expo-audio";

export type RemoteCommand = "nextTrack" | "previousTrack" | "skipForward" | "skipBackward";

/** Pure: the lock-screen remote command carried by a status update, if any. */
export function getRemoteCommand(status: AudioStatus): RemoteCommand | null {
  const cmd = (status as any)?.remoteCommand;
  return cmd === "nextTrack" ||
    cmd === "previousTrack" ||
    cmd === "skipForward" ||
    cmd === "skipBackward"
    ? cmd
    : null;
}

/** Pure: a finite, non-NaN number or null. */
export function finiteOrNull(value: unknown): number | null {
  return typeof value === "number" && !isNaN(value) ? value : null;
}

/** Pure: the status duration when known (> 0), else the fallback (e.g. catalogue duration). */
export function resolveDuration(status: AudioStatus, fallback: number): number {
  return typeof status.duration === "number" && status.duration > 0
    ? status.duration
    : fallback;
}

/**
 * Pure: true when the update reports the track finishing at (or within 2s of) its end,
 * as opposed to a spurious didJustFinish after a seek or source swap.
 */
export function isNaturalTrackEnd(status: AudioStatus): boolean {
  return (
    Boolean(status.didJustFinish) &&
    (typeof status.duration === "number" && status.duration > 0
      ? (status.currentTime ?? 0) >= Math.max(0, status.duration - 2)
      : true)
  );
}

/**
 * Pure: whether the UI should show the loading spinner.
 * A paused song is never loading. While playing, only show it on initial load
 * (!isLoaded) or real buffer starvation (buffer within 0.8s of the play head).
 */
export function shouldShowLoading(params: {
  isLoaded: boolean;
  isPlaying: boolean;
  isBuffering: boolean;
  isExplicitlyPaused: boolean;
  bufferedSeconds: number;
  currentTime: number;
}): boolean {
  const isBufferingStarvation =
    params.isPlaying &&
    !params.isExplicitlyPaused &&
    params.isBuffering &&
    params.bufferedSeconds <= params.currentTime + 0.8;
  return !params.isLoaded || isBufferingStarvation;
}

/**
 * Pure: next buffered-seconds estimate. Uses the native buffered position when the
 * platform reports one; otherwise grows an estimate ahead of the play head.
 * Returns null when there is nothing to report (no native value, unknown duration).
 */
export function estimateBufferedSeconds(params: {
  nativeBuffered: unknown;
  previousEstimate: number;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  isBuffering: boolean;
}): number | null {
  const { nativeBuffered, previousEstimate, currentTime, duration, isPlaying, isBuffering } =
    params;
  if (typeof nativeBuffered === "number" && nativeBuffered > 0) {
    return nativeBuffered;
  }
  if (duration > 0) {
    const lead = isBuffering ? 12 : 25;
    const step = isPlaying ? 1.5 : 0.2;
    return Math.min(duration, Math.max(currentTime + lead, previousEstimate + step));
  }
  return null;
}
