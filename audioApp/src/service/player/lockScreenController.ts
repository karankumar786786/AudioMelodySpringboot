import { AppState, Platform } from "react-native";
import { AudioPlayer } from "expo-audio";
import { Song, PlayerSong } from "@/types";
import { configureAudioPriority } from "@/utils";
import { activateLockScreenFor } from "./lockScreenMetadata";

interface LockScreenDeps {
  getActivePlayer: () => AudioPlayer | null;
  getCurrentSong: () => PlayerSong | null;
}

/**
 * Keeps the lock screen / Now Playing widget in sync with the active player:
 * re-asserts it on app-state transitions and whenever the playing state flips.
 */
export class LockScreenController {
  private hasSyncedActive = false;
  private lastReportedPlayingState: boolean | null = null;
  private appStateSubscription: { remove: () => void } | null = null;
  private resumeTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private deps: LockScreenDeps) {}

  /** Forget what was reported, so the next playing status re-registers Now Playing. */
  public resetSync(lastReported: boolean | null = null): void {
    this.hasSyncedActive = false;
    this.lastReportedPlayingState = lastReported;
  }

  public update(song?: PlayerSong | Song | null, force = true): void {
    const targetSong = song || this.deps.getCurrentSong();
    const player = this.deps.getActivePlayer();
    if (!player || !targetSong) return;
    activateLockScreenFor(player, targetSong, force);
  }

  public refresh(force = true): void {
    const song = this.deps.getCurrentSong();
    if (!this.deps.getActivePlayer() || !song) return;
    this.update(song, force);
  }

  /** Refreshes again 100ms and 300ms later, after native players settle at rate 1.0. */
  public refreshStaggered(isStillPlaying: () => boolean): void {
    setTimeout(() => {
      if (isStillPlaying()) this.refresh(true);
    }, 100);
    setTimeout(() => {
      if (isStillPlaying()) this.refresh(true);
    }, 300);
  }

  /**
   * Called on every active-player status update. Confirms Now Playing once audio is
   * actually emitting with a known duration, and re-syncs when play/pause flips.
   */
  public onStatus(isPlaying: boolean, durationSeconds: number): void {
    if (isPlaying && durationSeconds > 0 && !this.hasSyncedActive) {
      this.hasSyncedActive = true;
      this.lastReportedPlayingState = true;
      this.refresh(true);
    } else if (this.lastReportedPlayingState !== isPlaying) {
      this.lastReportedPlayingState = isPlaying;
      if (this.hasSyncedActive || isPlaying) {
        this.refresh(true);
      }
    }
  }

  public subscribeToAppState(): void {
    if (this.appStateSubscription) return;
    this.appStateSubscription = AppState.addEventListener("change", (nextState) => {
      console.log(`[AudioPlayerService] AppState -> ${nextState}`);
      this.clearResumeTimer();
      if (!this.deps.getActivePlayer() || !this.deps.getCurrentSong()) return;
      if (nextState === "active") {
        // Back in foreground: iOS may have dropped Now Playing / remote commands.
        // Re-assert both after a short delay so iOS finishes unlock transitions.
        this.resumeTimer = setTimeout(() => {
          this.resumeTimer = null;
          configureAudioPriority(true)
            .catch(() => {})
            .finally(() => this.refresh(true));
        }, 300);
      } else if (nextState === "inactive") {
        if (Platform.OS === "ios") {
          // iOS: "inactive" fires BEFORE "background" during lock.
          // Re-assert audio session and ensure lock screen controls are active.
          configureAudioPriority(true).catch(() => {});
          this.refresh(true);
        }
      } else {
        // "background":
        if (Platform.OS === "ios") {
          this.refresh(true);
          // One single safety retry after transition stabilizes
          setTimeout(() => {
            if (AppState.currentState !== "active") {
              this.refresh(true);
            }
          }, 350);
        } else {
          // Android: AudioControlsService remains running in the foreground.
          // Safe in-place metadata sync without tearing down the MediaSession / notification.
          this.refresh(false);
        }
      }
    });
  }

  public clearResumeTimer(): void {
    if (this.resumeTimer) {
      clearTimeout(this.resumeTimer);
      this.resumeTimer = null;
    }
  }
}
