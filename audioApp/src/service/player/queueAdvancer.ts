import { PlayerSong, RepeatMode, Song } from "@/types";
import { store } from "@/store/hook";
import { selectCurrentSongFromQueue } from "@/store/queueSlice";
import { PlayerStore } from "@/storage/PlayerStore";
import { AudioPlayerPool } from "../audioPlayerPool";
import { isEndOfTrackSleep } from "./sleepTimer";

/** How long a natural track end blocks a second advance. */
const ADVANCE_GUARD_MS = 1200;

export type TrackEndAction = "pause-for-sleep" | "repeat-one" | "advance";

/** Pure: what to do when the current track finishes naturally. */
export function decideTrackEndAction(params: {
  sleepTimer: number | null;
  repeatMode: RepeatMode;
  hasActivePlayer: boolean;
}): TrackEndAction {
  if (isEndOfTrackSleep(params.sleepTimer)) return "pause-for-sleep";
  if (params.repeatMode === "one" && params.hasActivePlayer) return "repeat-one";
  return "advance";
}

/**
 * Follows the Redux queue: persists it, auto-plays when the current index or song
 * changes from outside the service, and keeps the pool's standby slots primed with
 * the next two tracks.
 */
export class QueueAdvancer {
  private unsubscribe: (() => void) | null = null;
  private lastPlayedSongId: string | null = null;
  private lastPlayedIndex = -1;
  private isAutoPlaySuppressed = false;
  private lastSavedQueueLength = 0;
  private advancing = false;

  constructor(private pool: AudioPlayerPool) {}

  public get isAdvancing(): boolean {
    return this.advancing;
  }

  public set isAdvancing(value: boolean) {
    this.advancing = value;
  }

  /** Marks an advance in progress for a short window, so a second end event is ignored. */
  public beginAdvance(): void {
    this.advancing = true;
    setTimeout(() => {
      this.advancing = false;
    }, ADVANCE_GUARD_MS);
  }

  public suppressAutoPlayOnce(): void {
    this.isAutoPlaySuppressed = true;
  }

  public setLastPlayed(songId: string, index: number): void {
    this.lastPlayedSongId = songId;
    this.lastPlayedIndex = index;
  }

  public setLastPlayedSongId(songId: string | null): void {
    this.lastPlayedSongId = songId;
  }

  public reset(): void {
    this.lastPlayedSongId = null;
    this.lastPlayedIndex = -1;
    this.advancing = false;
  }

  public subscribe(onPlay: (song: Song | PlayerSong) => Promise<void>): void {
    if (this.unsubscribe) return;

    this.unsubscribe = store.subscribe(() => {
      const state = store.getState();
      const { queue, currentIndex } = state.queue;

      if (
        !queue ||
        queue.length === 0 ||
        currentIndex < 0 ||
        currentIndex >= queue.length
      ) {
        return;
      }

      const currentSong = selectCurrentSongFromQueue(state.queue);
      if (!currentSong) return;

      const hasIndexChanged = currentIndex !== this.lastPlayedIndex;
      const hasSongChanged = currentSong.id !== this.lastPlayedSongId;
      const hasQueueLengthChanged = queue.length !== this.lastSavedQueueLength;

      if (hasQueueLengthChanged || hasIndexChanged) {
        this.lastSavedQueueLength = queue.length;
        PlayerStore.saveLastQueue(queue, currentIndex);
      }

      if (hasIndexChanged || hasSongChanged) {
        this.lastPlayedIndex = currentIndex;
        this.lastPlayedSongId = currentSong.id;

        if (this.isAutoPlaySuppressed) {
          this.isAutoPlaySuppressed = false;
          return;
        }

        onPlay(currentSong).catch((err) => {
          console.warn("[AudioPlayerService] Auto-play from queue error:", err);
        });
      }
    });
  }

  /**
   * Synchronizes the upcoming 2 songs in the Redux queue into Standby 1 & 2.
   */
  public syncUpcomingPreload(): void {
    const state = store.getState();
    const { queue, currentIndex } = state.queue;
    const quality = state.player.audioQuality || "auto";

    if (queue && queue.length > 0 && currentIndex >= 0) {
      const next1 = queue[currentIndex + 1] || null;
      const next2 = queue[currentIndex + 2] || null;
      console.log(
        `[AudioPlayerPool:PRELOAD] Queue Pos: ${currentIndex}/${queue.length - 1} | Standby 1: ${next1 ? `"${next1.title}" (${next1.id})` : "None"} | Standby 2: ${next2 ? `"${next2.title}" (${next2.id})` : "None"}`
      );
      this.pool.syncPreloadQueue(queue, currentIndex, quality).catch((err) => {
        console.warn("[AudioPlayerPool] syncPreloadQueue error:", err);
      });
    }
  }
}
