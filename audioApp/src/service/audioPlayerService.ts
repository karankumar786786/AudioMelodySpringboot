import { AudioPlayer, AudioStatus } from "expo-audio";
import { Song, PlayerSong, AudioQuality } from "@/types";
import { store } from "@/store/hook";
import { configureAudioPriority } from "@/utils";
export { configureAudioPriority };
import { mapToPlayerSong } from "@/utils/playerUtils";
import { homeService } from "./homeService";
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
import { audioPlayerPool } from "./audioPlayerPool";
import { LockScreenController } from "./player/lockScreenController";
import { ProgressReporter } from "./player/progressReporter";
import { QueueAdvancer, decideTrackEndAction } from "./player/queueAdvancer";
import { SeekGuard } from "./player/seekGuard";
import { SleepTimer } from "./player/sleepTimer";
import {
  estimateBufferedSeconds,
  finiteOrNull,
  getRemoteCommand,
  isNaturalTrackEnd,
  resolveDuration,
  shouldShowLoading,
} from "./player/playbackStatus";

/**
 * Public facade for audio playback. Owns the player lifecycle (init, play, pause,
 * resume, seek) and routes native status updates to the focused modules in
 * `./player/`: queue advancement, lock screen, sleep timer, progress reporting.
 */
export class AudioPlayerService {
  private pool = audioPlayerPool;
  private isInitialized = false;
  private currentPlayingSong: PlayerSong | null = null;
  private onTrackEndCallback: (() => void) | null = null;
  private onRemoteNextTrack: (() => void) | null = null;
  private onRemotePreviousTrack: (() => void) | null = null;
  private remoteSyncInterval: ReturnType<typeof setInterval> | null = null;
  private currentQuality: AudioQuality = "auto";
  private playRequestId = 0;
  private bufferedSeconds = 0;
  private lastLoggedBuffering: boolean | null = null;
  private lastTrackChangeAt = 0;
  private lastProgressRatio = 0;
  private preloadedForSongId: string | null = null;
  private isExplicitlyPaused = false;

  private seekGuard = new SeekGuard();
  private sleepTimer = new SleepTimer();
  private queue = new QueueAdvancer(this.pool);
  private progress = new ProgressReporter(() => this.currentPlayingSong);
  private lockScreen = new LockScreenController({
    getActivePlayer: () => this.activePlayer,
    getCurrentSong: () => this.currentPlayingSong,
  });

  public get currentSong(): PlayerSong | null {
    return this.currentPlayingSong;
  }

  public markCurrentTrackReported(): void {
    this.progress.markReported();
  }

  public setRemoteCommandHandlers(handlers: {
    onNext?: () => void;
    onPrev?: () => void;
  }): void {
    if (handlers.onNext) this.onRemoteNextTrack = handlers.onNext;
    if (handlers.onPrev) this.onRemotePreviousTrack = handlers.onPrev;
  }

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

      this.pool.setStatusListener((status: AudioStatus, song: PlayerSong | null) => {
        this.handlePlaybackStatusUpdate(status, song);
      });

      this.initQueueSubscription();
      this.startRemoteSyncHeartbeat();
      this.lockScreen.subscribeToAppState();

      this.isInitialized = true;
      console.log(
        "[AudioPlayerService] Successfully initialized 3-player rotation pool and queue subscription"
      );
    } catch (error) {
      console.error(
        "[AudioPlayerService] Failed to initialize audio player engine:",
        error
      );
    }
  }

  private startRemoteSyncHeartbeat(): void {
    if (this.remoteSyncInterval) return;
    this.remoteSyncInterval = setInterval(() => {
      const player = this.activePlayer;
      if (!player || this.queue.isAdvancing || this.seekGuard.isSeeking) return;
      const isReduxPlaying = store.getState().player.isPlaying;
      const isNativePlaying = Boolean((player as any).playing);

      if (isReduxPlaying !== isNativePlaying) {
        const isBuffering = Boolean((player as any).isBuffering);
        if (!isBuffering) {
          store.dispatch(setIsPlaying(isNativePlaying));
        }
      }
    }, 1000);
  }

  public suppressAutoPlayOnce(): void {
    this.queue.suppressAutoPlayOnce();
  }

  public setLastPlayed(songId: string, index: number): void {
    this.queue.setLastPlayed(songId, index);
  }

  public initQueueSubscription(): void {
    this.queue.subscribe((song) => this.play(song));
  }

  private handleRemoteCommand(status: AudioStatus): boolean {
    const command = getRemoteCommand(status);
    if (!command) return false;
    const cur = typeof status.currentTime === "number" ? status.currentTime : 0;
    switch (command) {
      case "nextTrack":
        console.log("[AudioPlayerService] Remote next track command from lock screen");
        this.onRemoteNextTrack?.();
        break;
      case "previousTrack":
        console.log("[AudioPlayerService] Remote previous track command from lock screen");
        this.onRemotePreviousTrack?.();
        break;
      case "skipForward":
        this.seek(cur + 10);
        break;
      case "skipBackward":
        this.seek(Math.max(0, cur - 10));
        break;
    }
    return true;
  }

  private handlePlaybackStatusUpdate(status: AudioStatus, slotSong: PlayerSong | null): void {
    if (!status) return;

    // Lock screen scrub & skip commands
    if (this.handleRemoteCommand(status)) return;

    const dispatch = store.dispatch;
    const reportedTime = finiteOrNull(status.currentTime);

    // Sync current time with seek guard
    if (reportedTime !== null && this.seekGuard.acceptTime(reportedTime)) {
      dispatch(setCurrentTime(reportedTime));
    }

    // Sync duration
    if (
      typeof status.duration === "number" &&
      !isNaN(status.duration) &&
      status.duration > 0
    ) {
      dispatch(setDuration(status.duration));
    }

    const isPlaying = Boolean(status.playing);
    const isBuffering = Boolean(status.isBuffering);
    const isLoaded = Boolean((status as any).isLoaded ?? true);

    // Only log buffer transitions during active playback to prevent noise while paused
    if (isPlaying && isBuffering !== this.lastLoggedBuffering) {
      this.lastLoggedBuffering = isBuffering;
      console.log(
        `[Buffer] ${isBuffering ? "🔴 BUFFERING" : "🟢 buffered"} | "${this.currentPlayingSong?.title || slotSong?.title}" | pos=${(status.currentTime ?? 0).toFixed(1)}s | est=${this.bufferedSeconds.toFixed(1)}s | playing=${isPlaying}`
      );
    }
    dispatch(setIsPlaying(isPlaying));

    dispatch(
      setIsLoading(
        shouldShowLoading({
          isLoaded,
          isPlaying,
          isBuffering,
          isExplicitlyPaused: this.isExplicitlyPaused,
          bufferedSeconds: this.bufferedSeconds,
          currentTime: status.currentTime ?? 0,
        })
      )
    );

    // One-time preload trigger: start buffering upcoming songs into Standby 1 & 2
    // only AFTER current song is actually playing, so it never competes for bandwidth
    if (
      isPlaying &&
      !isBuffering &&
      this.currentPlayingSong &&
      this.preloadedForSongId !== this.currentPlayingSong.id
    ) {
      this.preloadedForSongId = this.currentPlayingSong.id;
      this.syncUpcomingPreload();
    }

    // Confirm lock screen active status once playback actually starts emitting audio & duration is known
    const dur = resolveDuration(status, this.currentPlayingSong?.duration || 0);
    this.lockScreen.onStatus(isPlaying, dur);

    // Save playback position periodically (local + server sync)
    if (
      status.playing &&
      typeof status.currentTime === "number" &&
      status.currentTime > 0
    ) {
      this.progress.onPlayingStatus(status.currentTime, status.duration);
    }

    // Sync buffered time to Redux
    const buffered = estimateBufferedSeconds({
      nativeBuffered:
        (status as any)?.bufferedPosition ?? (this.activePlayer as any)?.bufferedPosition,
      previousEstimate: this.bufferedSeconds,
      currentTime: reportedTime ?? 0,
      duration: dur,
      isPlaying,
      isBuffering,
    });
    if (buffered !== null) {
      this.bufferedSeconds = buffered;
      dispatch(setBufferedTime(buffered));
    }

    if (dur > 0 && reportedTime !== null) {
      this.lastProgressRatio = Math.min(1, reportedTime / dur);
    }

    // Handle track completion on natural track end
    if (isNaturalTrackEnd(status) && !this.seekGuard.isSeeking && !this.queue.isAdvancing) {
      this.handleNaturalTrackEnd();
    }
  }

  private handleNaturalTrackEnd(): void {
    this.queue.beginAdvance();
    this.progress.reportFullListen();

    console.log(
      "[AudioPlayerService] Reached end of track. Determining next action..."
    );
    const state = store.getState();
    const action = decideTrackEndAction({
      sleepTimer: state.player.sleepTimer,
      repeatMode: state.queue.repeatMode,
      hasActivePlayer: Boolean(this.activePlayer),
    });

    if (action === "pause-for-sleep") {
      console.log(
        "[AudioPlayerService] Sleep timer reached (End of track). Pausing playback."
      );
      this.pause();
      store.dispatch(setSleepTimer(null));
      return;
    }

    if (action === "repeat-one") {
      this.progress.resetForNewTrack();
      this.activePlayer?.seekTo(0).then(() => this.activePlayer?.play());
    } else {
      this.onTrackEndCallback?.();
    }
  }

  /**
   * Synchronizes the upcoming 2 songs in the Redux queue into Standby 1 & 2.
   */
  public syncUpcomingPreload(): void {
    this.queue.syncUpcomingPreload();
  }

  /**
   * Maps to a PlayerSong and, when the stream key is missing, fetches the full song.
   * `fetched` says whether a network round-trip happened (so callers can re-check
   * that their play request is still current).
   */
  private async hydrate(
    song: Song | PlayerSong
  ): Promise<{ playerSong: PlayerSong; fetched: boolean }> {
    let playerSong: PlayerSong = (song as PlayerSong).audioStreamUrl
      ? (song as PlayerSong)
      : mapToPlayerSong(song);

    if (!playerSong.songKey && playerSong.id) {
      try {
        const fullSong = await homeService.getSongById(playerSong.id);
        if (fullSong?.songKey) {
          playerSong = mapToPlayerSong(fullSong);
        }
      } catch (e) {
        console.warn("[AudioPlayerService] Hydration fallback note:", e);
      }
      return { playerSong, fetched: true };
    }
    return { playerSong, fetched: false };
  }

  /**
   * Plays `song` at the current queue index.
   * If `song` matches Standby 1 or Standby 2, performs an instant 0ms handover.
   * Otherwise loads directly into the Active slot and primes upcoming standby slots.
   */
  public async play(
    song: Song | PlayerSong,
    startTime = 0,
    force = false,
    autoplay = true
  ): Promise<void> {
    const requestId = ++this.playRequestId;
    this.queue.setLastPlayedSongId(song.id);

    await this.init();
    if (requestId !== this.playRequestId) return;

    this.progress.reportPartialListen(this.activePlayer);

    const { playerSong, fetched } = await this.hydrate(song);
    if (fetched && requestId !== this.playRequestId) return;

    console.log(
      `▶ [AudioPlayerService:PLAY] "${playerSong.title}" - ${playerSong.artistName} [ID: ${playerSong.id}]`
    );

    const state = store.getState();
    const currentQuality = state.player.audioQuality || "auto";
    this.currentQuality = currentQuality;
    const queue = state.queue.queue;
    const currentIndex = state.queue.currentIndex;

    const queueSongs = queue && queue.length > 0 ? queue : [playerSong];
    const targetIndex =
      currentIndex >= 0 &&
      currentIndex < queueSongs.length &&
      queueSongs[currentIndex].id === playerSong.id
        ? currentIndex
        : Math.max(0, queueSongs.findIndex((s) => s.id === playerSong.id));

    // If already playing the same song at same position and no force, resume
    if (
      !force &&
      this.currentPlayingSong?.id === playerSong.id &&
      startTime === 0
    ) {
      if (store.getState().player.isPlaying) return;
      this.resume();
      return;
    }

    this.queue.isAdvancing = false;
    this.isExplicitlyPaused = false;
    this.currentPlayingSong = playerSong;
    this.progress.resetForNewTrack();
    this.queue.setLastPlayed(playerSong.id, targetIndex);
    this.lastProgressRatio = 0;
    this.bufferedSeconds = startTime;
    this.lockScreen.resetSync(null);

    store.dispatch(setCurrentSong(playerSong));
    store.dispatch(setCurrentTime(startTime));
    store.dispatch(setBufferedTime(startTime));
    if (playerSong.duration) {
      store.dispatch(setDuration(playerSong.duration));
    }
    store.dispatch(setIsLoading(true));

    const now = Date.now();
    console.log(
      `[Track] ⏭ start "${playerSong.title}" | +${this.lastTrackChangeAt ? now - this.lastTrackChangeAt : 0}ms since last change`
    );
    this.lastTrackChangeAt = now;

    // 1 & 2. Song is ready in Standby 1 or Standby 2: 0ms instant handover
    for (const role of ["standby1", "standby2"] as const) {
      const standby = this.pool.getStandbySlot(role);
      if (startTime === 0 && !force && standby.song?.id === playerSong.id) {
        console.log(
          `[AudioPlayerPool] ⚡ Zero-delay gapless handover! Playing "${playerSong.title}" from ${role === "standby1" ? "Standby 1" : "Standby 2"}.`
        );
        this.preloadedForSongId = playerSong.id;
        this.bufferedSeconds = 10;
        store.dispatch(setBufferedTime(10));
        store.dispatch(setIsPlaying(autoplay));
        store.dispatch(setIsLoading(false));

        await this.pool.promoteStandby(role, currentQuality);
        PlayerStore.saveLastSong(playerSong, 0);

        // Re-prime pool for newly upcoming songs
        this.syncUpcomingPreload();
        return;
      }
    }

    // 3. FALLBACK: Load directly into Active slot (cold start / random jump)
    await this.pool.loadActive(playerSong, currentQuality, startTime, autoplay);

    store.dispatch(setIsPlaying(autoplay));
    store.dispatch(setIsLoading(false));
    PlayerStore.saveLastSong(playerSong, startTime);

    // Prime Standby 1 & 2 for upcoming tracks
    this.syncUpcomingPreload();

    if (autoplay) {
      this.lockScreen.refreshStaggered(() => store.getState().player.isPlaying);
    }
  }

  /**
   * Pre-primes the active slot with a restored song and position without starting playback.
   */
  public async primeRestoredPlayback(
    song: Song | PlayerSong,
    startTime = 0
  ): Promise<void> {
    await this.init();
    const { playerSong } = await this.hydrate(song);

    this.currentPlayingSong = playerSong;
    this.progress.resetForNewTrack();
    this.queue.setLastPlayedSongId(playerSong.id);
    this.bufferedSeconds = startTime;
    this.lockScreen.resetSync(false);

    const quality = store.getState().player.audioQuality || "auto";
    await this.pool.loadActive(playerSong, quality, startTime, false);
    this.refreshLockScreen(true);
  }

  public pause(): void {
    const player = this.activePlayer;
    if (!player) return;
    this.isExplicitlyPaused = true;
    player.pause();
    this.lockScreen.resetSync(false);
    store.dispatch(setIsPlaying(false));
    store.dispatch(setIsLoading(false));
    if (typeof player.currentTime === "number" && player.currentTime >= 0) {
      PlayerStore.savePlaybackPosition(player.currentTime);
      this.progress.syncServerProgress(player.currentTime, player.duration);
    }
    this.refreshLockScreen(true);
  }

  public resume(): void {
    this.isExplicitlyPaused = false;
    configureAudioPriority(true).catch(() => {});
    this.lockScreen.resetSync(null);

    const activeSlot = this.pool.getActiveSlot();
    const hasSongLoaded = Boolean(activeSlot?.song && activeSlot?.resolvedUri);

    // If active player has no song loaded yet (cold start fallback)
    if (!hasSongLoaded || !this.currentPlayingSong) {
      const state = store.getState();
      const songToPlay =
        this.currentPlayingSong ||
        state.player.currentSong ||
        state.queue.queue[state.queue.currentIndex];
      if (songToPlay) {
        const savedTime = state.player.currentTime || 0;
        this.play(songToPlay, savedTime, true, true);
        return;
      }
    }

    const player = this.activePlayer;
    if (!player) return;

    // Un-mute active player (in case it was loaded in muted/standby state)
    player.volume = 1.0;
    const curTime = player.currentTime || 0;
    const dur = player.duration || 0;
    if (dur > 0 && curTime >= dur - 0.5) {
      player.seekTo(0).then(() => {
        player.play();
        this.refreshLockScreen(true);
      });
    } else {
      player.play();
      this.refreshLockScreen(true);
    }
    store.dispatch(setIsPlaying(true));
    store.dispatch(setIsLoading(false));

    // Staggered refresh after native AVPlayer/ExoPlayer transitions to rate = 1.0
    this.lockScreen.refreshStaggered(() => store.getState().player.isPlaying);
  }

  public updateLockScreen(song?: PlayerSong | Song | null, force = true): void {
    this.lockScreen.update(song, force);
  }

  public refreshLockScreen(force = true): void {
    this.lockScreen.refresh(force);
  }

  public togglePlay(): void {
    const player = this.activePlayer;
    if (!player) {
      this.resume();
      return;
    }
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
    const seekId = this.seekGuard.begin(safeTime);

    this.bufferedSeconds = Math.max(this.bufferedSeconds, safeTime + 20);
    store.dispatch(setCurrentTime(safeTime));
    store.dispatch(setBufferedTime(this.bufferedSeconds));
    PlayerStore.savePlaybackPosition(safeTime);

    try {
      await player.seekTo(safeTime);
      this.seekGuard.markResolved(seekId);
    } catch (err) {
      console.warn(`[AudioPlayerService] seekTo(${safeTime}) error:`, err);
      this.seekGuard.fail(seekId);
    }
  }

  public setVolume(vol: number): void {
    const player = this.activePlayer;
    if (player) {
      player.volume = Math.max(0, Math.min(1, vol));
    }
  }

  public setPlaybackRate(rate: number): void {
    const player = this.activePlayer;
    if (player) {
      (player as any).playbackRate = rate;
    }
  }

  public setSleepTimer(minutes: number | null): void {
    this.sleepTimer.set(minutes, (m) => {
      console.log(`[AudioPlayerService] Sleep timer finished (${m}m). Pausing.`);
      this.pause();
      store.dispatch(setSleepTimer(null));
    });
  }

  public setAudioQuality(quality: AudioQuality): void {
    store.dispatch(setAudioQuality(quality));
    console.log(
      `[AudioPlayerService] Audio quality preference set to "${quality}". Applies to streaming tracks.`
    );
    this.currentQuality = quality;
    if (this.currentPlayingSong) {
      const curTime = this.activePlayer?.currentTime || 0;
      const wasPlaying = Boolean(this.activePlayer?.playing);
      this.play(this.currentPlayingSong, curTime, true, wasPlaying);
    }
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

  public stopAndReset(): void {
    try {
      if (this.remoteSyncInterval) {
        clearInterval(this.remoteSyncInterval);
        this.remoteSyncInterval = null;
      }
      this.lockScreen.clearResumeTimer();
      this.seekGuard.clear();
      this.sleepTimer.clear();
      this.progress.reportPartialListen(this.activePlayer);
      this.currentPlayingSong = null;
      this.progress.resetForNewTrack();
      this.queue.reset();
      this.lockScreen.resetSync(null);
      this.bufferedSeconds = 0;
      this.preloadedForSongId = null;
      this.pool.resetAll();
    } catch (e) {
      console.warn("[AudioPlayerService] Error during stopAndReset:", e);
    }
  }
}

export const audioPlayerService = new AudioPlayerService();
