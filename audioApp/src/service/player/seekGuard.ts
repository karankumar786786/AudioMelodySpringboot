/** Native time within this many seconds of the seek target counts as "arrived". */
const SEEK_ARRIVAL_TOLERANCE_SECONDS = 2.5;
/** After seekTo() resolves, accept native time anyway once this much time has passed. */
const SEEK_SETTLE_MS = 400;
/** Give up guarding a seek that never resolves after this long. */
const SEEK_GUARD_TIMEOUT_MS = 1500;

/**
 * Pure: decides whether a seek is finished, given the native position reported now.
 */
export function isSeekSettled(params: {
  reportedTime: number;
  targetTime: number;
  seekResolved: boolean;
  msSinceResolve: number;
}): boolean {
  const diff = Math.abs(params.reportedTime - params.targetTime);
  return (
    params.seekResolved &&
    (diff <= SEEK_ARRIVAL_TOLERANCE_SECONDS || params.msSinceResolve > SEEK_SETTLE_MS)
  );
}

/**
 * Suppresses stale native time updates while a seek is in flight, so the scrubber
 * doesn't jump back to the old position before the player catches up.
 */
export class SeekGuard {
  private seeking = false;
  private targetTime: number | null = null;
  private resolved = false;
  private resolvedTimestamp = 0;
  private currentSeekId = 0;
  private timeout: ReturnType<typeof setTimeout> | null = null;

  public get isSeeking(): boolean {
    return this.seeking;
  }

  /** Starts guarding a new seek and returns its id. */
  public begin(targetTime: number): number {
    const seekId = ++this.currentSeekId;
    this.seeking = true;
    this.targetTime = targetTime;
    this.resolved = false;
    this.resolvedTimestamp = 0;

    if (this.timeout) {
      clearTimeout(this.timeout);
    }
    this.timeout = setTimeout(() => {
      if (this.currentSeekId === seekId) {
        this.seeking = false;
        this.targetTime = null;
        this.resolved = false;
        this.timeout = null;
      }
    }, SEEK_GUARD_TIMEOUT_MS);
    return seekId;
  }

  public markResolved(seekId: number): void {
    if (this.currentSeekId === seekId) {
      this.resolved = true;
      this.resolvedTimestamp = Date.now();
    }
  }

  public fail(seekId: number): void {
    if (this.currentSeekId === seekId) {
      this.clear();
    }
  }

  /**
   * Returns true when `reportedTime` should be published to the UI.
   * While a seek is pending this returns false until the seek settles.
   */
  public acceptTime(reportedTime: number): boolean {
    if (!this.seeking || this.targetTime === null) return true;
    const msSinceResolve =
      this.resolvedTimestamp > 0 ? Date.now() - this.resolvedTimestamp : 0;
    if (
      isSeekSettled({
        reportedTime,
        targetTime: this.targetTime,
        seekResolved: this.resolved,
        msSinceResolve,
      })
    ) {
      this.clear();
      return true;
    }
    return false;
  }

  public clear(): void {
    this.seeking = false;
    this.targetTime = null;
    this.resolved = false;
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
  }
}
