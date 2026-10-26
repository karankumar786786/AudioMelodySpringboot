import { AudioPlayer, AudioStatus } from "expo-audio";
import { PlayerSong, RepeatMode, AudioQuality } from "@/types";
import { store } from "@/store/hook";
import { configureAudioPriority } from "@/utils/audioConfig";
export { configureAudioPriority };
import {
  setCurrentTime,
  setDuration,
  setBufferedTime,
  setIsLoading,
  setIsPlaying,
  setCurrentSong,
  setSleepTimer,
  setAudioQuality,
} from "@/store/playerSlice";
import { PlayerStore } from "@/storage/PlayerStore";
import { audioPlayerPool, resolveStreamUrl } from "./audioPlayerPool";

export class AudioPlayerService {
  private pool = audioPlayerPool;
  private isInitialized = false;
  private currentPlayingSong: PlayerSong | null = null;
  private onTrackEndCallback: (() => void) | null = null;
  private isAdvancingTrack = false;
  private isSeeking = false;
  private seekTargetTime: number | null = null;
  private seekToResolved = false;
  private seekResolvedTimestamp = 0;
  private currentSeekId = 0;
  private seekTimeout: any = null;
  private bufferedSeconds = 0;
  private lastPositionSaveTimestamp = 0;

  private get activePlayer(): AudioPlayer | null {
    return this.pool.getActiveSlot()?.player || null;
  }

  public setOnTrackEnd(callback: (() => void) | null) {
    this.onTrackEndCallback = callback;
  }

  async init(): Promise<void> {
    if (this.isInitialized) return;

    try {
      await configureAudioPriority();
      await this.pool.init();

      this.pool.setStatusListener((status: AudioStatus) => {
        this.handlePlaybackStatusUpdate(status);
      });

      this.isInitialized = true;
      console.log("[AudioPlayerService] Successfully initialized multi-player rotation pool");
    } catch (error) {
      console.error("[AudioPlayerService] Failed to initialize audio player engine:", error);
    }
  }

  private handlePlaybackStatusUpdate(status: AudioStatus): void {
    if (!status) return;

    const dispatch = store.dispatch;

    // Sync current time and duration with seek guard to prevent flicker / rubber-banding
    if (typeof status.currentTime === "number" && !isNaN(status.currentTime)) {
      if (this.isSeeking && this.seekTargetTime !== null) {
        const diff = Math.abs(status.currentTime - this.seekTargetTime);
        const elapsedSinceResolve =
          this.seekResolvedTimestamp > 0 ? Date.now() - this.seekResolvedTimestamp : 0;

        // If native seekTo has resolved and either the reported position matches the target within 2.5s,
        // or 400ms have elapsed since resolution (stale bridge events flushed),
        // accept the position and release the seeking lock.
        if (this.seekToResolved && (diff <= 2.5 || elapsedSinceResolve > 400)) {
          this.isSeeking = false;
          this.seekTargetTime = null;
          this.seekToResolved = false;
          if (this.seekTimeout) {
            clearTimeout(this.seekTimeout);
            this.seekTimeout = null;
          }
          dispatch(setCurrentTime(status.currentTime));
        }
      } else {
        dispatch(setCurrentTime(status.currentTime));
      }
    }
    if (typeof status.duration === "number" && !isNaN(status.duration) && status.duration > 0) {
      dispatch(setDuration(status.duration));
    }

    dispatch(setIsPlaying(Boolean(status.playing)));
    dispatch(setIsLoading(Boolean(status.isBuffering)));

    // Throttle position saving to local storage (every 5 seconds while playing)
    if (status.playing && typeof status.currentTime === "number" && status.currentTime > 0) {
      if (Date.now() - this.lastPositionSaveTimestamp > 5000) {
        this.lastPositionSaveTimestamp = Date.now();
        PlayerStore.savePlaybackPosition(status.currentTime);
      }
    }

    // Sync buffered time to Redux
    const nativeBuffered =
      (status as any).bufferedPosition ?? (this.activePlayer as any)?.bufferedPosition;
    const dur =
      typeof status.duration === "number" && status.duration > 0
        ? status.duration
        : this.currentPlayingSong?.duration || 0;
    const curr =
      typeof status.currentTime === "number" && !isNaN(status.currentTime)
        ? status.currentTime
        : 0;

    if (typeof nativeBuffered === "number" && nativeBuffered >= 0) {
      this.bufferedSeconds = nativeBuffered;
      dispatch(setBufferedTime(nativeBuffered));
    } else if (dur > 0) {
      const forwardWindow = status.isBuffering ? 8 : 25;
      this.bufferedSeconds = Math.min(
        dur,
        Math.max(this.bufferedSeconds, curr + forwardWindow)
      );
      dispatch(setBufferedTime(this.bufferedSeconds));
    }

    // Track finished event (strictly validate track reached end and not currently advancing or seeking)
    if (
      status.didJustFinish &&
      !this.isSeeking &&
      typeof status.duration === "number" &&
      status.duration > 0 &&
      typeof status.currentTime === "number" &&
      status.currentTime >= status.duration - 1.5 &&
      !this.isAdvancingTrack
    ) {
      this.isAdvancingTrack = true;
      setTimeout(() => {
        this.isAdvancingTrack = false;
      }, 1200);

      console.log("[AudioPlayerService] Track finished playback. Determining next action...");
      const state = store.getState();
      const sleepTimer = state.player.sleepTimer;
      if (sleepTimer === -1) {
        console.log("[AudioPlayerService] Sleep timer reached (End of track). Pausing playback.");
        this.pause();
        store.dispatch(setSleepTimer(null));
        return;
      }

      const repeatMode: RepeatMode = state.queue.repeatMode;

      if (repeatMode === "one" && this.activePlayer) {
        console.log("[AudioPlayerService] RepeatMode=one. Replaying current track...");
        const player = this.activePlayer;
        player.seekTo(0).then(() => player?.play());
      } else {
        console.log("[AudioPlayerService] Advancing to next track in queue...");
        this.onTrackEndCallback?.();
      }
    }
  }

  /**
   * Synchronizes the upcoming 2 songs in the Redux queue into Standby 1 & 2.
   */
  public syncUpcomingPreload(): void {
    const state = store.getState();
    const { queue, lastQueueIndex } = state.queue;
    const quality = state.player.audioQuality || "auto";

    if (queue && queue.length > 0) {
      this.pool.syncPreloadQueue(queue, lastQueueIndex, quality).catch((err) => {
        console.warn("[AudioPlayerService] syncPreloadQueue error:", err);
      });
    }
  }

  public async play(song: PlayerSong, startTime = 0, force = false): Promise<void> {
    await this.init();

    // 1. If this song is already playing and no seek/force is requested, resume
    if (!force && this.currentPlayingSong?.id === song.id && startTime === 0) {
      const isPlaying = store.getState().player.isPlaying;
      if (isPlaying) {
        return;
      }
      this.resume();
      return;
    }

    const state = store.getState();
    const currentQuality = state.player.audioQuality || "auto";

    // 2. CHECK IF SONG IS READY IN STANDBY 1 (0ms Handover!)
    const standby1 = this.pool.getStandbySlot("standby1");
    if (startTime === 0 && standby1.song?.id === song.id) {
      console.log(
        `[AudioPlayerService] Zero-delay gapless handover! Playing "${song.title}" from Standby 1.`
      );
      this.isAdvancingTrack = false;
      this.currentPlayingSong = song;
      this.bufferedSeconds = 10;

      store.dispatch(setCurrentSong(song));
      store.dispatch(setCurrentTime(0));
      store.dispatch(setBufferedTime(10));
      if (song.duration) {
        store.dispatch(setDuration(song.duration));
      }
      store.dispatch(setIsPlaying(true));
      store.dispatch(setIsLoading(false));

      await this.pool.promoteStandby("standby1", currentQuality);
      PlayerStore.saveLastSong(song, 0);

      // Re-prime pool for the newly upcoming songs
      this.syncUpcomingPreload();
      return;
    }

    // 3. CHECK IF SONG IS READY IN STANDBY 2 (0ms Handover on fast double-skip)
    const standby2 = this.pool.getStandbySlot("standby2");
    if (startTime === 0 && standby2.song?.id === song.id) {
      console.log(
        `[AudioPlayerService] Zero-delay gapless handover! Playing "${song.title}" from Standby 2.`
      );
      this.isAdvancingTrack = false;
      this.currentPlayingSong = song;
      this.bufferedSeconds = 10;

      store.dispatch(setCurrentSong(song));
      store.dispatch(setCurrentTime(0));
      store.dispatch(setBufferedTime(10));
      if (song.duration) {
        store.dispatch(setDuration(song.duration));
      }
      store.dispatch(setIsPlaying(true));
      store.dispatch(setIsLoading(false));

      await this.pool.promoteStandby("standby2", currentQuality);
      PlayerStore.saveLastSong(song, 0);

      // Re-prime pool for the newly upcoming songs
      this.syncUpcomingPreload();
      return;
    }

    // 4. Fallback: Cold start or cache miss (load directly into active player slot)
    // Clear stale standby slots immediately so network bandwidth is 100% focused on loading the clicked song
    this.pool.clearStandbySlots();

    const activeSlot = this.pool.getActiveSlot();
    const player = activeSlot.player;
    if (!player) return;

    try {
      this.isAdvancingTrack = false;
      this.currentPlayingSong = song;
      activeSlot.song = song;
      this.bufferedSeconds = startTime;

      store.dispatch(setCurrentSong(song));
      store.dispatch(setCurrentTime(startTime));
      store.dispatch(setBufferedTime(startTime));
      if (song.duration) {
        store.dispatch(setDuration(song.duration));
      }
      store.dispatch(setIsLoading(true));

      const uri = resolveStreamUrl(song, currentQuality);
      if (!uri) {
        console.warn(`[AudioPlayerService] No stream URL found for song ${song.title} (${song.id})`);
        store.dispatch(setIsLoading(false));
        return;
      }

      activeSlot.resolvedUri = uri;
      console.log(`[AudioPlayerService] Loading stream for "${song.title}" (${currentQuality}): ${uri}`);
      await configureAudioPriority(false);

      // Ensure active player has 0 buffer constraint so playback begins immediately on first segment
      if ("preferredForwardBufferDuration" in player) {
        (player as any).preferredForwardBufferDuration = 0;
      }

      player.volume = 1.0;
      if (typeof (player as any)?.replaceAsync === "function") {
        await (player as any).replaceAsync({ uri });
      } else {
        player.replace({ uri });
      }

      if (startTime > 0) {
        await player.seekTo(startTime);
      }

      const savedRate = store.getState().player.playbackRate;
      if (typeof savedRate === "number" && savedRate > 0) {
        if (typeof (player as any).setPlaybackRate === "function") {
          (player as any).setPlaybackRate(savedRate);
        }
      }

      player.play();
      store.dispatch(setIsPlaying(true));
      store.dispatch(setIsLoading(false));

      // Persist active song and initial playback position to local storage
      PlayerStore.saveLastSong(song, startTime);

      // Update native lock screen & notification controls
      try {
        player.setActiveForLockScreen(
          true,
          {
            title: song.title,
            artist: song.artistName,
            albumTitle: song.album || "Melody",
            artworkUrl: song.coverUrl,
          },
          {
            showSeekForward: true,
            showSeekBackward: true,
            seekForwardIntervalSeconds: 10,
            seekBackwardIntervalSeconds: 10,
          }
        );
      } catch (lockErr) {
        console.log("[AudioPlayerService] Lock screen metadata note:", lockErr);
      }

      // Preload next 2 songs immediately
      this.syncUpcomingPreload();
    } catch (err) {
      console.error(`[AudioPlayerService] Error playing song "${song.title}":`, err);
      store.dispatch(setIsLoading(false));
      store.dispatch(setIsPlaying(false));
    }
  }

  public pause(): void {
    const player = this.activePlayer;
    if (!player) return;
    player.pause();
    store.dispatch(setIsPlaying(false));
    if (typeof player.currentTime === "number" && player.currentTime >= 0) {
      PlayerStore.savePlaybackPosition(player.currentTime);
    }
  }

  public resume(): void {
    // If resuming from cold-start with a restored song, trigger native playback
    if (!this.currentPlayingSong) {
      const state = store.getState();
      const restoredSong = state.player.currentSong;
      if (restoredSong) {
        const savedTime = state.player.currentTime || 0;
        this.play(restoredSong, savedTime);
        return;
      }
    }

    const player = this.activePlayer;
    if (!player) return;
    const curTime = player.currentTime || 0;
    const dur = player.duration || 0;
    if (dur > 0 && curTime >= dur - 0.5) {
      // Track is already at EOF: restart from 0 instead of immediately triggering didJustFinish
      player.seekTo(0).then(() => {
        player?.play();
      });
    } else {
      player.play();
    }
    store.dispatch(setIsPlaying(true));
  }

  public togglePlay(): void {
    // If cold-start restored song exists but hasn't begun native playback yet
    if (!this.currentPlayingSong) {
      const state = store.getState();
      const restoredSong = state.player.currentSong;
      if (restoredSong) {
        const savedTime = state.player.currentTime || 0;
        this.play(restoredSong, savedTime);
        return;
      }
    }

    const player = this.activePlayer;
    if (!player) return;
    if (player.playing) {
      this.pause();
    } else {
      this.resume();
    }
  }

  public async seek(seconds: number): Promise<void> {
    const player = this.activePlayer;
    if (!player) return;
    const safeTime = Math.max(0, seconds);
    const seekId = ++this.currentSeekId;

    this.isSeeking = true;
    this.seekTargetTime = safeTime;
    this.seekToResolved = false;
    this.seekResolvedTimestamp = 0;

    if (this.seekTimeout) {
      clearTimeout(this.seekTimeout);
    }
    // Safety fallback: auto-unlock seeking after 1500ms in case native update never matches
    this.seekTimeout = setTimeout(() => {
      if (this.currentSeekId === seekId) {
        this.isSeeking = false;
        this.seekTargetTime = null;
        this.seekToResolved = false;
        this.seekTimeout = null;
      }
    }, 1500);

    // Optimistically update store currentTime immediately so UI is completely responsive
    this.bufferedSeconds = safeTime;
    store.dispatch(setCurrentTime(safeTime));
    store.dispatch(setBufferedTime(safeTime));
    PlayerStore.savePlaybackPosition(safeTime);

    try {
      await player.seekTo(safeTime);
      if (this.currentSeekId === seekId) {
        this.seekToResolved = true;
        this.seekResolvedTimestamp = Date.now();
      }
    } catch (err) {
      console.warn(`[AudioPlayerService] seekTo(${safeTime}) error:`, err);
      if (this.currentSeekId === seekId) {
        this.isSeeking = false;
        this.seekTargetTime = null;
        this.seekToResolved = false;
        if (this.seekTimeout) {
          clearTimeout(this.seekTimeout);
          this.seekTimeout = null;
        }
      }
    }
  }

  public setVolume(vol: number): void {
    const player = this.activePlayer;
    if (!player) return;
    const safeVol = Math.max(0, Math.min(1, vol));
    player.volume = safeVol;
  }

  private sleepTimerTimeout: any = null;

  public setPlaybackRate(rate: number): void {
    const player = this.activePlayer;
    if (!player) return;
    if (typeof (player as any).setPlaybackRate === "function") {
      (player as any).setPlaybackRate(rate);
    }
  }

  public setSleepTimer(minutes: number | null): void {
    if (this.sleepTimerTimeout) {
      clearTimeout(this.sleepTimerTimeout);
      this.sleepTimerTimeout = null;
    }
    if (typeof minutes === "number" && minutes > 0) {
      this.sleepTimerTimeout = setTimeout(() => {
        console.log(`[AudioPlayerService] Sleep timer finished (${minutes}m). Pausing.`);
        this.pause();
        store.dispatch(setSleepTimer(null));
      }, minutes * 60 * 1000);
    }
  }

  public setAudioQuality(quality: AudioQuality): void {
    store.dispatch(setAudioQuality(quality));
    console.log(`[AudioPlayerService] Audio quality preference set to "${quality}". Applies to streaming tracks.`);
    this.syncUpcomingPreload();
  }

  public getCurrentTime(): number {
    return this.activePlayer?.currentTime ?? 0;
  }

  public isPlaying(): boolean {
    return this.activePlayer?.playing ?? false;
  }

  public getCurrentSong(): PlayerSong | null {
    return this.currentPlayingSong;
  }
}

export const audioPlayerService = new AudioPlayerService();
