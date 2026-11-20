/**
 * Pure math and decisions for track transitions (gapless handover and crossfade).
 * Nothing here touches players, the store or timers, so it can be unit tested directly.
 */
import type { RepeatMode } from "@/types";
import { isEndOfTrackSleep } from "./sleepTimer";

export const MIN_CROSSFADE_SECONDS = 0;
export const MAX_CROSSFADE_SECONDS = 12;
export const DEFAULT_CROSSFADE_SECONDS = 0;

/**
 * Gapless: start the preloaded next track this many seconds before the current one
 * ends. The outgoing player keeps playing to its real end, so nothing is cut off; the
 * lead only has to cover the JS → native start latency.
 */
export const GAPLESS_LEAD_SECONDS = 0.15;

/** Make sure the next track is buffered at least this long before the current one ends. */
export const PRELOAD_DEADLINE_SECONDS = 30;

/** Start the fast transition ticker this long before a handover/fade is due. */
export const TRANSITION_WATCH_WINDOW_SECONDS = 2;

/** A fade shorter than this is not worth doing; fall back to a gapless handover. */
const MIN_EFFECTIVE_FADE_SECONDS = 1;

/** Don't start a fade with less than this left (e.g. right after a seek to the end). */
const MIN_REMAINING_TO_START_FADE = 0.5;

/** Clamp a stored/entered setting to a whole number of seconds in 0..12. Invalid → 0. */
export function clampCrossfadeSeconds(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return DEFAULT_CROSSFADE_SECONDS;
  return Math.min(MAX_CROSSFADE_SECONDS, Math.max(MIN_CROSSFADE_SECONDS, Math.round(n)));
}

export interface CrossfadeVolumes {
  outgoing: number;
  incoming: number;
}

/**
 * Equal-power crossfade curve. `elapsed` is seconds since the fade began.
 * At 0 → {1, 0}; at the midpoint both are ~0.707 (constant perceived loudness);
 * at `duration` → {0, 1}. A zero/negative duration is an instant cut.
 */
export function crossfadeVolumes(elapsed: number, duration: number): CrossfadeVolumes {
  if (!(duration > 0)) {
    return elapsed >= 0 ? { outgoing: 0, incoming: 1 } : { outgoing: 1, incoming: 0 };
  }
  const t = Math.min(1, Math.max(0, elapsed / duration));
  return {
    outgoing: Math.cos((t * Math.PI) / 2),
    incoming: Math.sin((t * Math.PI) / 2),
  };
}

/**
 * The fade length actually used: the user's setting, capped at half of each track so a
 * fade never eats more than half a song. Returns 0 (gapless) when that is under 1s.
 */
export function effectiveCrossfadeDuration(
  settingSeconds: number,
  currentTrackDuration: number,
  nextTrackDuration?: number | null
): number {
  const setting = clampCrossfadeSeconds(settingSeconds);
  if (setting <= 0 || !(currentTrackDuration > 0)) return 0;
  let limit = currentTrackDuration / 2;
  if (typeof nextTrackDuration === "number" && nextTrackDuration > 0) {
    limit = Math.min(limit, nextTrackDuration / 2);
  }
  const d = Math.min(setting, limit);
  return d >= MIN_EFFECTIVE_FADE_SECONDS ? d : 0;
}

/**
 * Seconds into the fade, derived from the outgoing track's position (so pausing the
 * player freezes the fade). Negative means the fade has not started yet.
 */
export function fadeElapsed(position: number, trackDuration: number, fadeDuration: number): number {
  return fadeDuration - (trackDuration - position);
}

/** The lock screen / queue switch to the incoming track once the fade passes halfway. */
export function hasPassedFadeMidpoint(elapsed: number, fadeDuration: number): boolean {
  return fadeDuration > 0 && elapsed >= fadeDuration / 2;
}

/** The fade is over: outgoing silent, incoming at full volume. */
export function isFadeComplete(elapsed: number, fadeDuration: number): boolean {
  return elapsed >= fadeDuration;
}

export interface TransitionEligibility {
  repeatMode: RepeatMode;
  sleepTimer: number | null;
  /** The pool's standby 1 holds the queue's next song and has finished loading. */
  nextReady: boolean;
  isSeeking: boolean;
  isPlaying: boolean;
}

/**
 * Whether the current track may hand over early to the preloaded next one.
 * Not with repeat-one (the same track restarts), not when the sleep timer is set
 * to stop at the end of this track, and not without a ready next track (last in queue).
 */
export function canTransition(e: TransitionEligibility): boolean {
  return (
    e.isPlaying &&
    !e.isSeeking &&
    e.nextReady &&
    e.repeatMode !== "one" &&
    !isEndOfTrackSleep(e.sleepTimer)
  );
}

export type TransitionStart =
  | { kind: "none" }
  | { kind: "gapless" }
  | { kind: "crossfade"; fadeDuration: number };

/**
 * What to start right now, given the play head. A crossfade starts once the remaining
 * time is within the fade length; a gapless handover starts within GAPLESS_LEAD_SECONDS.
 */
export function decideTransitionStart(params: {
  position: number;
  trackDuration: number;
  fadeDuration: number;
}): TransitionStart {
  const { position, trackDuration, fadeDuration } = params;
  if (!(trackDuration > 0)) return { kind: "none" };
  const remaining = trackDuration - position;
  if (fadeDuration > 0) {
    if (remaining <= fadeDuration && remaining > MIN_REMAINING_TO_START_FADE) {
      return { kind: "crossfade", fadeDuration };
    }
    if (remaining > MIN_REMAINING_TO_START_FADE) return { kind: "none" };
    // Too close to the end for a fade (e.g. seeked there): fall through to gapless.
  }
  return remaining <= GAPLESS_LEAD_SECONDS ? { kind: "gapless" } : { kind: "none" };
}

/** Whether the play head is close enough to a transition to need the fast ticker. */
export function isInTransitionWindow(
  position: number,
  trackDuration: number,
  fadeDuration: number
): boolean {
  if (!(trackDuration > 0)) return false;
  return trackDuration - position <= fadeDuration + TRANSITION_WATCH_WINDOW_SECONDS;
}

/** Whether the next track should be (re)preloaded now so it is ready before the end. */
export function shouldEnsurePreload(params: {
  position: number;
  trackDuration: number;
  fadeDuration: number;
  hasNextInQueue: boolean;
  nextReady: boolean;
}): boolean {
  const { position, trackDuration, fadeDuration, hasNextInQueue, nextReady } = params;
  if (!hasNextInQueue || nextReady || !(trackDuration > 0)) return false;
  return trackDuration - position <= fadeDuration + PRELOAD_DEADLINE_SECONDS;
}
