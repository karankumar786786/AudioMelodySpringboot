/** Sleep-timer value that means "pause when the current track ends". */
export const SLEEP_AT_END_OF_TRACK = -1;

/** Pure: true when the sleep timer is set to stop at the end of the current track. */
export function isEndOfTrackSleep(sleepTimer: number | null | undefined): boolean {
  return sleepTimer === SLEEP_AT_END_OF_TRACK;
}

/**
 * Timed sleep timer. "End of track" (-1) is not a timeout: it is checked by the
 * track-end logic, so `set(-1)` only clears any running countdown.
 */
export class SleepTimer {
  private timeout: ReturnType<typeof setTimeout> | null = null;

  public set(minutes: number | null, onFire: (minutes: number) => void): void {
    this.clear();
    if (typeof minutes === "number" && minutes > 0) {
      this.timeout = setTimeout(() => {
        this.timeout = null;
        onFire(minutes);
      }, minutes * 60 * 1000);
    }
  }

  public clear(): void {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
  }
}
