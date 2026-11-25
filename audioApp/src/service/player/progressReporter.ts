import { AudioPlayer } from "expo-audio";
import { PlayerSong } from "@/types";
import { PlayerStore } from "@/storage/PlayerStore";
import { interactionService } from "../interactionService";
import { userProgressService } from "../userProgressService";
import { ListenPlatform, ListenTracker, ServerQuality } from "./listenTracker";

const LOCAL_SAVE_INTERVAL_MS = 5000;
// Every save is a Redis write on the core API (Upstash bills per command), so sync once
// a minute; pause saves at once and a new track saves about 5 s in.
const SERVER_SYNC_INTERVAL_MS = 60_000;
const MIN_PARTIAL_LISTEN_RATIO = 0.05;

/**
 * Pure: fraction of the track listened to, or null when it can't be counted
 * (unknown duration, nothing played, or below the 5% threshold).
 */
export function partialListenRatio(currentTime: number, duration: number): number | null {
  if (duration <= 0 || currentTime <= 0) return null;
  const percentage = Math.min(1.0, currentTime / duration);
  return percentage >= MIN_PARTIAL_LISTEN_RATIO ? percentage : null;
}

/**
 * Listening telemetry and resume-position persistence:
 * - saves the playback position locally every 5s and to the server every 60s,
 * - reports one listen per track (full on natural end, partial when skipped away).
 */
/** The app's quality preference as the server names the renditions. */
export function serverQuality(pref: string | undefined | null): ServerQuality {
  switch (pref) {
    case "standard":
      return "128kbps";
    case "high":
      return "240kbps";
    case "lossless":
      return "320kbps";
    default:
      return "auto";
  }
}

export class ProgressReporter {
  private lastPositionSaveTimestamp = 0;
  private lastServerProgressTimestamp = 0;
  private hasReportedListen = false;
  /** What was played, seeks, startup and stalls for the current track (song analytics). */
  readonly listen = new ListenTracker();

  constructor(
    private getCurrentSong: () => PlayerSong | null,
    private getQuality: () => string | undefined = () => undefined,
    private platform: ListenPlatform | undefined = undefined,
  ) {}

  public get hasReported(): boolean {
    return this.hasReportedListen;
  }

  public markReported(): void {
    this.hasReportedListen = true;
  }

  public resetForNewTrack(): void {
    this.hasReportedListen = false;
    this.listen.begin({ quality: serverQuality(this.getQuality()), platform: this.platform });
    // Save the new track about 5 s in, so resume on another device points at it
    // without waiting a full interval.
    this.lastServerProgressTimestamp = Date.now() - SERVER_SYNC_INTERVAL_MS + 5000;
  }

  /** Every status update of the active player (feeds the listen tracker). */
  public onStatus(currentTimeSec: number | null, playing: boolean, buffering: boolean): void {
    if (currentTimeSec === null) return;
    this.listen.tick(currentTimeSec * 1000, playing, buffering);
  }

  /** Throttled local + server position saves while playing. */
  public onPlayingStatus(currentTime: number, duration?: number): void {
    const now = Date.now();
    if (now - this.lastPositionSaveTimestamp > LOCAL_SAVE_INTERVAL_MS) {
      this.lastPositionSaveTimestamp = now;
      PlayerStore.savePlaybackPosition(currentTime);
    }
    if (now - this.lastServerProgressTimestamp > SERVER_SYNC_INTERVAL_MS) {
      this.lastServerProgressTimestamp = now;
      this.syncServerProgress(currentTime, duration);
    }
  }

  /** Records a full listen when the track reaches its end. */
  public reportFullListen(): void {
    const song = this.getCurrentSong();
    const songId = song?.id;
    if (songId && !this.hasReportedListen) {
      const durationSec = song?.duration || undefined;
      const detail = this.listen.finish(durationSec ? durationSec * 1000 : NaN, false);
      interactionService.recordPlay(songId, 1.0, durationSec, detail);
      this.hasReportedListen = true;
    }
  }

  /**
   * Records a partial listen (>= 5%) for the current track before it is replaced.
   * skipped: the user moved on (next, jump); false when playback just stopped.
   */
  public reportPartialListen(player: AudioPlayer | null, skipped = true): void {
    const song = this.getCurrentSong();
    if (!song?.id || !player || this.hasReportedListen) return;

    const currentTime = player.currentTime || 0;
    const duration = player.duration || song.duration || 0;
    const ratio = partialListenRatio(currentTime, duration);
    if (ratio !== null) {
      const detail = this.listen.finish(currentTime * 1000, skipped);
      interactionService.recordPlay(song.id, ratio, duration || undefined, detail);
      this.hasReportedListen = true;
    }
  }

  public syncServerProgress(currentTime: number, duration?: number): void {
    const song = this.getCurrentSong();
    const songId = song?.id;
    if (!songId || currentTime < 2) return;
    const dur = duration && duration > 0 ? duration : song?.duration || 0;
    userProgressService
      .saveProgress({
        songId,
        currentTime: Math.round(currentTime * 10) / 10,
        duration: dur,
      })
      .catch(() => {});
  }
}
