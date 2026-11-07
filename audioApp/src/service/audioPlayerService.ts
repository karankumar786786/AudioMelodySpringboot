import { AppState, Platform } from "react-native";
import { AudioPlayer, AudioStatus } from "expo-audio";
import { Song, PlayerSong, RepeatMode, AudioQuality } from "@/types";
import { store } from "@/store/hook";
import {
  configureAudioPriority,
  safeSetActiveForLockScreen,
  getImageUrl,
} from "@/utils";
export { configureAudioPriority };
import { mapToPlayerSong } from "@/utils/playerUtils";
import { selectCurrentSongFromQueue } from "@/store/queueSlice";
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
import { audioPlayerPool, resolveStreamUrl } from "./audioPlayerPool";
import { interactionService } from "./interactionService";

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
  private lastPositionSaveTimestamp = 0;
  private unsubscribeQueue: (() => void) | null = null;
  private lastPlayedSongId: string | null = null;
  private lastPlayedIndex: number = -1;
  private isAutoPlaySuppressed = false;
  private remoteSyncInterval: ReturnType<typeof setInterval> | null = null;
  private currentQuality: AudioQuality = "auto";
  private hasSyncedActiveLockScreen = false;
  private lastReportedPlayingState: boolean | null = null;
  private appStateSubscription: { remove: () => void } | null = null;
  private playRequestId = 0;
  private bufferedSeconds = 0;
  private lastLoggedBuffering: boolean | null = null;
  private lastTrackChangeAt = 0;
  private resumeTimer: ReturnType<typeof setTimeout> | null = null;
  private lastProgressRatio = 0;
  private preloadedForSongId: string | null = null;
  private onRemoteNextTrack: (() => void) | null = null;
  private onRemotePreviousTrack: (() => void) | null = null;

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
      this.initAppStateSubscription();

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
      if (!player || this.isAdvancingTrack || this.isSeeking) return;
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

  private initAppStateSubscription(): void {
    if (this.appStateSubscription) return;
    this.appStateSubscription = AppState.addEventListener("change", (nextState) => {
      console.log(`[AudioPlayerService] AppState -> ${nextState}`);
      if (this.resumeTimer) {
        clearTimeout(this.resumeTimer);
        this.resumeTimer = null;
      }
      if (!this.activePlayer || !this.currentPlayingSong) return;
      if (nextState === "active") {
        // Back in foreground: iOS may have dropped Now Playing / remote commands.
        // Re-assert both after a short delay so iOS finishes unlock transitions.
        this.resumeTimer = setTimeout(() => {
          this.resumeTimer = null;
          configureAudioPriority(true)
            .catch(() => {})
            .finally(() => this.refreshLockScreen(true));
        }, 300);
      } else if (nextState === "inactive") {
        if (Platform.OS === "ios") {
          // iOS: "inactive" fires BEFORE "background" during lock.
          // Re-assert audio session BEFORE expo-video gets a chance to corrupt it.
          // Also reset _isLockScreenActive so the next refreshLockScreen(true)
          // forces a full native re-registration instead of a metadata-only update.
          if (this.activePlayer) {
            (this.activePlayer as any)._isLockScreenActive = false;
          }
          configureAudioPriority(true).catch(() => {});
          this.refreshLockScreen(true);
        }
      } else {
        // "background":
        if (Platform.OS === "ios") {
          // iOS only: reset lock screen flag and retry with escalating delays
          if (this.activePlayer) {
            (this.activePlayer as any)._isLockScreenActive = false;
          }
          this.refreshLockScreen(true);
          [300, 800, 1500, 3000].forEach((d) =>
            setTimeout(() => {
              this.refreshLockScreen(true);
            }, d)
          );
        } else {
          // Android: AudioControlsService remains running in the foreground.
          // Safe in-place metadata sync without tearing down the MediaSession / notification.
          this.refreshLockScreen(false);
        }
      }
    });
  }

  public suppressAutoPlayOnce(): void {
    this.isAutoPlaySuppressed = true;
  }

  public setLastPlayed(songId: string, index: number): void {
    this.lastPlayedSongId = songId;
    this.lastPlayedIndex = index;
  }

  public initQueueSubscription(): void {
    if (this.unsubscribeQueue) return;

    this.unsubscribeQueue = store.subscribe(() => {
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

      if (hasIndexChanged || hasSongChanged) {
        this.lastPlayedIndex = currentIndex;
        this.lastPlayedSongId = currentSong.id;

        if (this.isAutoPlaySuppressed) {
          this.isAutoPlaySuppressed = false;
          return;
        }

        this.play(currentSong).catch((err) => {
          console.warn("[AudioPlayerService] Auto-play from queue error:", err);
        });

        PlayerStore.saveLastQueue(queue, currentIndex);
      }
    });
  }

  private handlePlaybackStatusUpdate(status: AudioStatus, slotSong: PlayerSong | null): void {
    if (!status) return;

    // Handle remote lock screen scrub & skip commands
    if ((status as any).remoteCommand === "nextTrack") {
      console.log("[AudioPlayerService] Remote next track command from lock screen");
      if (this.onRemoteNextTrack) {
        this.onRemoteNextTrack();
      }
      return;
    }
    if ((status as any).remoteCommand === "previousTrack") {
      console.log("[AudioPlayerService] Remote previous track command from lock screen");
      if (this.onRemotePreviousTrack) {
        this.onRemotePreviousTrack();
      }
      return;
    }
    if ((status as any).remoteCommand === "skipForward") {
      const cur = typeof status.currentTime === "number" ? status.currentTime : 0;
      this.seek(cur + 10);
      return;
    }
    if ((status as any).remoteCommand === "skipBackward") {
      const cur = typeof status.currentTime === "number" ? status.currentTime : 0;
      this.seek(Math.max(0, cur - 10));
      return;
    }

    const dispatch = store.dispatch;

    // Sync current time with seek guard
    if (typeof status.currentTime === "number" && !isNaN(status.currentTime)) {
      if (this.isSeeking && this.seekTargetTime !== null) {
        const diff = Math.abs(status.currentTime - this.seekTargetTime);
        const elapsedSinceResolve =
          this.seekResolvedTimestamp > 0
            ? Date.now() - this.seekResolvedTimestamp
            : 0;

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

    if (isBuffering !== this.lastLoggedBuffering) {
      this.lastLoggedBuffering = isBuffering;
      console.log(
        `[Buffer] ${isBuffering ? "🔴 BUFFERING" : "🟢 buffered"} | "${this.currentPlayingSong?.title || slotSong?.title}" | pos=${(status.currentTime ?? 0).toFixed(1)}s | est=${this.bufferedSeconds.toFixed(1)}s | playing=${isPlaying}`
      );
    }
    dispatch(setIsPlaying(isPlaying));
    dispatch(setIsLoading(!isLoaded || (isBuffering && !isPlaying)));

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
    const dur =
      typeof status.duration === "number" && status.duration > 0
        ? status.duration
        : (this.currentPlayingSong?.duration || 0);

    if (isPlaying && dur > 0 && !this.hasSyncedActiveLockScreen) {
      this.hasSyncedActiveLockScreen = true;
      this.lastReportedPlayingState = true;
      this.refreshLockScreen();
    } else if (this.lastReportedPlayingState !== isPlaying) {
      this.lastReportedPlayingState = isPlaying;
      if (this.hasSyncedActiveLockScreen) {
        this.refreshLockScreen();
      }
    }

    // Save playback position periodically
    if (
      status.playing &&
      typeof status.currentTime === "number" &&
      status.currentTime > 0
    ) {
      if (Date.now() - this.lastPositionSaveTimestamp > 5000) {
        this.lastPositionSaveTimestamp = Date.now();
        PlayerStore.savePlaybackPosition(status.currentTime);
      }
    }

    // Sync buffered time to Redux
    const nativeBuffered =
      (status as any)?.bufferedPosition ??
      (this.activePlayer as any)?.bufferedPosition;

    const curr =
      typeof status.currentTime === "number" && !isNaN(status.currentTime)
        ? status.currentTime
        : 0;

    if (typeof nativeBuffered === "number" && nativeBuffered > 0) {
      this.bufferedSeconds = nativeBuffered;
      dispatch(setBufferedTime(nativeBuffered));
    } else if (dur > 0) {
      const lead = isBuffering ? 12 : 25;
      const step = isPlaying ? 1.5 : 0.2;
      this.bufferedSeconds = Math.min(
        dur,
        Math.max(curr + lead, this.bufferedSeconds + step)
      );
      dispatch(setBufferedTime(this.bufferedSeconds));
    }

    if (dur > 0 && typeof status.currentTime === "number" && !isNaN(status.currentTime)) {
      this.lastProgressRatio = Math.min(1, status.currentTime / dur);
    }

    // Handle track completion on natural track end
    const isNaturalTrackEnd =
      Boolean(status.didJustFinish) &&
      (typeof status.duration === "number" && status.duration > 0
        ? (status.currentTime ?? 0) >= Math.max(0, status.duration - 2)
        : true);

    if (
      isNaturalTrackEnd &&
      !this.isSeeking &&
      !this.isAdvancingTrack
    ) {
      this.isAdvancingTrack = true;
      setTimeout(() => {
        this.isAdvancingTrack = false;
      }, 1200);

      if (this.currentPlayingSong?.id) {
        interactionService.recordPlay(this.currentPlayingSong.id, 1.0);
      }

      console.log(
        "[AudioPlayerService] Reached end of track. Determining next action..."
      );
      const state = store.getState();
      const sleepTimer = state.player.sleepTimer;
      if (sleepTimer === -1) {
        console.log(
          "[AudioPlayerService] Sleep timer reached (End of track). Pausing playback."
        );
        this.pause();
        store.dispatch(setSleepTimer(null));
        return;
      }

      const repeatMode: RepeatMode = state.queue.repeatMode;
      if (repeatMode === "one" && this.activePlayer) {
        this.activePlayer.seekTo(0).then(() => this.activePlayer?.play());
      } else {
        this.onTrackEndCallback?.();
      }
    }
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
    this.lastPlayedSongId = song.id;

    await this.init();
    if (requestId !== this.playRequestId) return;

    this.reportPartialListen();

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
      if (requestId !== this.playRequestId) return;
    }

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

    this.isAdvancingTrack = false;
    this.currentPlayingSong = playerSong;
    this.lastPlayedIndex = targetIndex;
    this.lastPlayedSongId = playerSong.id;
    this.lastProgressRatio = 0;
    this.bufferedSeconds = startTime;
    this.hasSyncedActiveLockScreen = false;
    this.lastReportedPlayingState = null;

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

    // ─────────────────────────────────────────────────────────────
    // 1. CHECK IF SONG IS READY IN STANDBY 1 (0ms Instant Handover!)
    // ─────────────────────────────────────────────────────────────
    const standby1 = this.pool.getStandbySlot("standby1");
    if (startTime === 0 && !force && standby1.song?.id === playerSong.id) {
      console.log(
        `[AudioPlayerPool] ⚡ Zero-delay gapless handover! Playing "${playerSong.title}" from Standby 1.`
      );
      this.preloadedForSongId = playerSong.id;
      this.bufferedSeconds = 10;
      store.dispatch(setBufferedTime(10));
      store.dispatch(setIsPlaying(autoplay));
      store.dispatch(setIsLoading(false));

      await this.pool.promoteStandby("standby1", currentQuality);
      PlayerStore.saveLastSong(playerSong, 0);

      // Re-prime pool for newly upcoming songs
      this.syncUpcomingPreload();
      interactionService.recordPlay(playerSong.id, 0);
      return;
    }

    // ─────────────────────────────────────────────────────────────
    // 2. CHECK IF SONG IS READY IN STANDBY 2 (0ms Handover on rapid skip!)
    // ─────────────────────────────────────────────────────────────
    const standby2 = this.pool.getStandbySlot("standby2");
    if (startTime === 0 && !force && standby2.song?.id === playerSong.id) {
      console.log(
        `[AudioPlayerPool] ⚡ Zero-delay gapless handover! Playing "${playerSong.title}" from Standby 2.`
      );
      this.preloadedForSongId = playerSong.id;
      this.bufferedSeconds = 10;
      store.dispatch(setBufferedTime(10));
      store.dispatch(setIsPlaying(autoplay));
      store.dispatch(setIsLoading(false));

      await this.pool.promoteStandby("standby2", currentQuality);
      PlayerStore.saveLastSong(playerSong, 0);

      // Re-prime pool for newly upcoming songs
      this.syncUpcomingPreload();
      interactionService.recordPlay(playerSong.id, 0);
      return;
    }

    // ─────────────────────────────────────────────────────────────
    // 3. FALLBACK: Load directly into Active slot (cold start / random jump)
    // ─────────────────────────────────────────────────────────────
    await this.pool.loadActive(playerSong, currentQuality, startTime, autoplay);

    store.dispatch(setIsPlaying(autoplay));
    store.dispatch(setIsLoading(false));
    PlayerStore.saveLastSong(playerSong, startTime);
    interactionService.recordPlay(playerSong.id, 0);

    // Prime Standby 1 & 2 for upcoming tracks
    this.syncUpcomingPreload();
  }

  /**
   * Pre-primes the active slot with a restored song and position without starting playback.
   */
  public async primeRestoredPlayback(
    song: Song | PlayerSong,
    startTime = 0
  ): Promise<void> {
    await this.init();
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
    }

    this.currentPlayingSong = playerSong;
    this.lastPlayedSongId = playerSong.id;
    this.bufferedSeconds = startTime;

    const quality = store.getState().player.audioQuality || "auto";
    await this.pool.loadActive(playerSong, quality, startTime, false);
    this.refreshLockScreen();
  }

  public pause(): void {
    const player = this.activePlayer;
    if (!player) return;
    player.pause();
    this.lastReportedPlayingState = false;
    store.dispatch(setIsPlaying(false));
    if (typeof player.currentTime === "number" && player.currentTime >= 0) {
      PlayerStore.savePlaybackPosition(player.currentTime);
    }
    this.refreshLockScreen();
  }

  public resume(): void {
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
        this.lastReportedPlayingState = true;
        this.refreshLockScreen();
      });
    } else {
      player.play();
      this.lastReportedPlayingState = true;
      this.refreshLockScreen();
    }
    store.dispatch(setIsPlaying(true));
    store.dispatch(setIsLoading(false));
  }

  public updateLockScreen(song?: PlayerSong | Song | null, force = false): void {
    const targetSong = song || this.currentPlayingSong;
    const player = this.activePlayer;
    if (!player || !targetSong) return;

    const rawImage =
      (targetSong as any).coverUrl ||
      (targetSong as any).posterUrl ||
      (targetSong as any).imageKey ||
      (targetSong as any).image_key ||
      (targetSong as any).imageUrl;

    const artworkUrl =
      (typeof rawImage === "string" && rawImage.startsWith("http")
        ? rawImage
        : getImageUrl(rawImage, {
            width: 500,
            height: 500,
            focus: "auto",
            aspectRatio: "1-1",
            format: "jpg",
            quality: 85,
          })) || undefined;

    safeSetActiveForLockScreen(
      player,
      true,
      {
        title: targetSong.title || "One Melody",
        artist: targetSong.artistName || "Unknown Artist",
        albumTitle: targetSong.album || "Melody",
        artworkUrl,
      },
      {
        showSeekForward: false,
        showSeekBackward: false,
        showNextTrack: true,
        showPreviousTrack: true,
      },
      force
    );
  }

  public refreshLockScreen(force = false): void {
    if (!this.activePlayer || !this.currentPlayingSong) return;
    this.updateLockScreen(this.currentPlayingSong, force);
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
    const seekId = ++this.currentSeekId;

    this.isSeeking = true;
    this.seekTargetTime = safeTime;
    this.seekToResolved = false;
    this.seekResolvedTimestamp = 0;

    if (this.seekTimeout) {
      clearTimeout(this.seekTimeout);
    }
    this.seekTimeout = setTimeout(() => {
      if (this.currentSeekId === seekId) {
        this.isSeeking = false;
        this.seekTargetTime = null;
        this.seekToResolved = false;
        this.seekTimeout = null;
      }
    }, 1500);

    this.bufferedSeconds = Math.max(this.bufferedSeconds, safeTime + 20);
    store.dispatch(setCurrentTime(safeTime));
    store.dispatch(setBufferedTime(this.bufferedSeconds));
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
    if (player) {
      player.volume = Math.max(0, Math.min(1, vol));
    }
  }

  private sleepTimerTimeout: any = null;

  public setPlaybackRate(rate: number): void {
    const player = this.activePlayer;
    if (player) {
      (player as any).playbackRate = rate;
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

  private reportPartialListen(): void {
    const player = this.activePlayer;
    if (!this.currentPlayingSong?.id || !player) return;

    const currentTime = player.currentTime || 0;
    const duration = player.duration || this.currentPlayingSong.duration || 0;
    if (duration <= 0 || currentTime <= 0) return;

    const percentage = Math.min(1.0, currentTime / duration);
    if (percentage >= 0.05) {
      interactionService.recordPlay(this.currentPlayingSong.id, percentage);
    }
  }
}

export const audioPlayerService = new AudioPlayerService();
