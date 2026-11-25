/**
 * Listening detail for one play of one track, sent with the play report so the admin
 * dashboard can show which parts of a song are played most, where people drop off or
 * seek, and how fast and smoothly each quality streams.
 *
 * Pure and clock-injected (tests drive it directly). The same file lives in
 * audioApp/src/service/player/listenTracker.ts and audioFrontend/src/lib/listenTracker.ts.
 *
 * Feed it the player's status ticks with tick(positionMs, playing, buffering). Seeks are
 * detected from the play head moving differently from the wall clock, so callers don't
 * have to report them (seek() is there for when they can).
 */

export type ServerQuality = "128kbps" | "240kbps" | "320kbps" | "auto";
export type ListenPlatform = "ios" | "android" | "web";

export interface ListenDetail {
  ranges: [number, number][];
  exitMs: number;
  skipped: boolean;
  seeks: [number, number][];
  quality?: ServerQuality;
  platform?: ListenPlatform;
  startupMs?: number;
  rebufferCount: number;
  rebufferMs: number;
}

export const MAX_RANGES = 200;
export const MAX_SEEKS = 100;
/** Play head and wall clock may drift this much between ticks before it counts as a seek. */
const SEEK_TOLERANCE_MS = 2500;
/** A seek shorter than this is noise (tick jitter, a scrub that went nowhere). */
const MIN_SEEK_MS = 1500;
/** Startup above this is a stuck load, not a measurement. */
const MAX_STARTUP_MS = 60_000;

export function mergeRanges(ranges: [number, number][]): [number, number][] {
  const sorted = ranges
    .filter(([s, e]) => Number.isFinite(s) && Number.isFinite(e) && e > s)
    .map(
      ([s, e]) =>
        [Math.max(0, Math.round(s)), Math.round(e)] as [number, number],
    )
    .sort((a, b) => a[0] - b[0]);
  const out: [number, number][] = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && r[0] <= last[1] + 1000) last[1] = Math.max(last[1], r[1]);
    else out.push([r[0], r[1]]);
  }
  return out;
}

export class ListenTracker {
  private ranges: [number, number][] = [];
  private seeks: [number, number][] = [];
  private open: [number, number] | null = null;
  private lastPos: number | null = null;
  private lastAt = 0;
  private startedAt = 0;
  private startupMs: number | undefined;
  private stallStartedAt: number | null = null;
  private rebufferCount = 0;
  private rebufferMs = 0;
  private quality: ServerQuality | undefined;
  private platform: ListenPlatform | undefined;
  private active = false;

  constructor(private readonly now: () => number = Date.now) {}

  /** A new track was requested (load starts now). */
  begin(
    opts: { quality?: ServerQuality; platform?: ListenPlatform } = {},
  ): void {
    this.ranges = [];
    this.seeks = [];
    this.open = null;
    this.lastPos = null;
    this.lastAt = 0;
    this.startedAt = this.now();
    this.startupMs = undefined;
    this.stallStartedAt = null;
    this.rebufferCount = 0;
    this.rebufferMs = 0;
    this.quality = opts.quality;
    this.platform = opts.platform;
    this.active = true;
  }

  get isActive(): boolean {
    return this.active;
  }

  setQuality(quality: ServerQuality | undefined): void {
    this.quality = quality;
  }

  /** One status update from the player. */
  tick(positionMs: number, playing: boolean, buffering: boolean): void {
    if (!this.active || !Number.isFinite(positionMs) || positionMs < 0) return;
    const t = this.now();

    // Startup: from begin() to the first tick where audio plays without buffering.
    // Over a minute is a load that waited on the user, not a measurement (-1: not sent).
    if (this.startupMs === undefined && playing && !buffering) {
      const ms = t - this.startedAt;
      this.startupMs = ms <= MAX_STARTUP_MS ? ms : -1;
    }

    // Stalls after playback started: buffering while the user wants it to play.
    const started = this.startupMs !== undefined;
    if (started && playing && buffering) {
      if (this.stallStartedAt === null) {
        this.stallStartedAt = t;
        this.rebufferCount += 1;
      }
    } else if (this.stallStartedAt !== null) {
      this.rebufferMs += t - this.stallStartedAt;
      this.stallStartedAt = null;
    }

    if (playing && !buffering) {
      if (this.open && this.lastPos !== null) {
        const moved = positionMs - this.lastPos;
        const expected = t - this.lastAt;
        if (
          Math.abs(moved - expected) > SEEK_TOLERANCE_MS &&
          Math.abs(moved) >= MIN_SEEK_MS
        ) {
          this.recordSeek(this.lastPos, positionMs);
        } else if (positionMs >= this.open[1]) {
          this.open[1] = positionMs;
        }
      } else {
        this.open = [positionMs, positionMs];
      }
    } else {
      this.close();
    }
    this.lastPos = positionMs;
    this.lastAt = t;
  }

  /** The user seeked (when the caller knows; tick() also detects it). */
  seek(fromMs: number, toMs: number): void {
    if (!this.active) return;
    if (Math.abs(toMs - fromMs) < MIN_SEEK_MS) return;
    if (this.open && fromMs > this.open[1]) this.open[1] = fromMs;
    this.recordSeek(fromMs, toMs);
    this.lastPos = toMs;
    this.lastAt = this.now();
  }

  /** The listen is over; returns the detail and stops tracking until the next begin(). */
  finish(exitMs: number, skipped: boolean): ListenDetail | null {
    if (!this.active) return null;
    if (
      this.open &&
      Number.isFinite(exitMs) &&
      exitMs > this.open[1] &&
      exitMs - this.open[1] < SEEK_TOLERANCE_MS
    ) {
      this.open[1] = exitMs;
    }
    this.close();
    if (this.stallStartedAt !== null) {
      this.rebufferMs += this.now() - this.stallStartedAt;
      this.stallStartedAt = null;
    }
    this.active = false;
    const ranges = mergeRanges(this.ranges).slice(0, MAX_RANGES);
    const lastEnd = ranges.length ? ranges[ranges.length - 1][1] : 0;
    return {
      ranges,
      exitMs: Math.max(
        0,
        Math.round(
          Number.isFinite(exitMs) ? exitMs : (this.lastPos ?? lastEnd),
        ),
      ),
      skipped,
      seeks: this.seeks
        .slice(0, MAX_SEEKS)
        .map(([a, b]) => [Math.round(a), Math.round(b)] as [number, number]),
      quality: this.quality,
      platform: this.platform,
      startupMs:
        this.startupMs !== undefined && this.startupMs >= 0
          ? this.startupMs
          : undefined,
      rebufferCount: this.rebufferCount,
      rebufferMs: Math.round(this.rebufferMs),
    };
  }

  private recordSeek(fromMs: number, toMs: number): void {
    this.close();
    if (this.seeks.length < MAX_SEEKS)
      this.seeks.push([Math.max(0, fromMs), Math.max(0, toMs)]);
    this.open = [Math.max(0, toMs), Math.max(0, toMs)];
  }

  private close(): void {
    if (this.open) {
      if (this.open[1] > this.open[0] && this.ranges.length < MAX_RANGES * 2)
        this.ranges.push(this.open);
      this.open = null;
    }
  }
}
