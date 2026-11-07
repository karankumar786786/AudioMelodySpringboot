import { AppState } from "react-native";
import {
  createAudioPlaylist,
  AudioPlaylist,
  AudioPlaylistStatus,
} from "expo-audio";
import { Song, PlayerSong, RepeatMode, AudioQuality } from "@/types";
import { store } from "@/store/hook";
import {
  configureAudioPriority,
  safeSetActiveForLockScreen,
  safeUpdateLockScreenMetadata,
  getImageUrl,
} from "@/utils";
export { configureAudioPriority };
import { mapToPlayerSong } from "@/utils/playerUtils";
import { selectCurrentSongFromQueue, setQueueIndex } from "@/store/queueSlice";
import { refillQueue, nextTrack, prevTrack } from "@/store/queueActions";
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
import { resolveStreamUrl } from "./audioPlayerPool";
import { interactionService } from "./interactionService";

export class AudioPlayerService {
  private playlist: AudioPlaylist | null = null;
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
  private loadedQueueSongIds: string[] = [];
  private currentQuality: AudioQuality = "auto";
  private statusSubscription: { remove: () => void } | null = null;
  private trackChangedSubscription: { remove: () => void } | null = null;
  private hasSyncedActiveLockScreen = false;
  private lastReportedPlayingState: boolean | null = null;
  private appStateSubscription: { remove: () => void } | null = null;
  private currentLoopMode: "none" | "all" | "single" = "none";
  private currentPlaylistIndex: number = -1;
  private playRequestId = 0;
  private resumeTimer: ReturnType<typeof setTimeout> | null = null;
  private lastSyncedQueue: (Song | PlayerSong)[] | null = null;
  private lastSyncedIndex = -2;
  private lastSyncedQuality: AudioQuality | null = null;
  private lastProgressRatio = 0;

  private get activePlayer(): AudioPlaylist | null {
    return this.playlist;
  }

  public setOnTrackEnd(callback: (() => void) | null) {
    this.onTrackEndCallback = callback;
  }

  async init(): Promise<void> {
    if (this.isInitialized) return;

    try {
      await configureAudioPriority();
      this.initQueueSubscription();
      this.startRemoteSyncHeartbeat();
      this.initAppStateSubscription();

      this.isInitialized = true;
      console.log(
        "[AudioPlayerService] Successfully initialized AudioPlaylist engine and queue subscription"
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
      const player = this.playlist;
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
      if (!this.playlist || !this.currentPlayingSong) return;
      if (nextState === "active") {
        // Back in foreground: iOS may have dropped Now Playing / remote commands
        // (audio session changed by another player). Re-assert both, after a short
        // delay so iOS has finished the unlock state flips.
        this.resumeTimer = setTimeout(() => {
          this.resumeTimer = null;
          configureAudioPriority(true)
            .catch(() => {})
            .finally(() => this.refreshLockScreen(true));
        }, 300);
      } else {
        // Locking: re-register Now Playing a few times (iOS may reject the first
        // attempt while the app is transitioning).
        this.refreshLockScreen(true);
        [500, 1500].forEach((d) =>
          setTimeout(() => {
            if (AppState.currentState !== "active") this.refreshLockScreen(true);
          }, d)
        );
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
      const { queue, currentIndex, repeatMode } = state.queue;

      if (
        !queue ||
        queue.length === 0 ||
        currentIndex < 0 ||
        currentIndex >= queue.length
      ) {
        return;
      }

      // Synchronize repeat mode changes with AudioPlaylist loop mode without reading native .loop getter
      // (Reading .loop calls ExoPlayer.getRepeatMode() on Android which throws on the JS thread)
      if (this.playlist) {
        const expectedLoop: "none" | "all" | "single" =
          repeatMode === "all" ? "all" : repeatMode === "one" ? "single" : "none";
        if (this.currentLoopMode !== expectedLoop) {
          this.currentLoopMode = expectedLoop;
          try {
            (this.playlist as any).loop = expectedLoop;
          } catch (err) {
            console.warn("[AudioPlayerService] Failed to set loop mode:", err);
          }
        }
      }

      // Keep the native playlist in sync with the Redux queue (append / reorder /
      // remove / shuffle)
      this.syncPlaylistWithQueue(queue, currentIndex, state.player.audioQuality || "auto");

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

  private handleTrackChanged(previousIndex: number, currentIndex: number): void {
    this.currentPlaylistIndex = currentIndex;
    const state = store.getState();
    const queue = state.queue.queue;
    if (!queue || currentIndex < 0) return;

    // Resolve the song by the id the native playlist loaded at that slot, then map
    // it back to its queue index (robust against a queue edit mid-transition).
    const loadedId = this.loadedQueueSongIds[currentIndex];
    if (!loadedId) return;
    let queueIdx = queue[currentIndex]?.id === loadedId ? currentIndex : -1;
    if (queueIdx === -1) queueIdx = queue.findIndex((s) => s.id === loadedId);
    if (queueIdx === -1) return;
    const nextSong = queue[queueIdx];

    // Transition we started ourselves (play/skipTo): already handled
    if (this.lastPlayedIndex === queueIdx && this.lastPlayedSongId === nextSong.id) {
      return;
    }

    // Natural / lock-screen driven transition: record what happened to the old track
    const prevId = this.currentPlayingSong?.id;
    if (prevId) {
      interactionService.recordPlay(
        prevId,
        this.lastProgressRatio >= 0.9 ? 1.0 : this.lastProgressRatio
      );
    }
    this.lastProgressRatio = 0;

    this.lastPlayedIndex = queueIdx;
    this.lastPlayedSongId = nextSong.id;
    const playerNextSong = mapToPlayerSong(nextSong);
    this.currentPlayingSong = playerNextSong;
    this.hasSyncedActiveLockScreen = true;
    this.lastReportedPlayingState = true;

    store.dispatch(setQueueIndex(queueIdx));
    store.dispatch(setCurrentSong(playerNextSong));
    store.dispatch(setCurrentTime(0));
    store.dispatch(setBufferedTime(0));
    store.dispatch(setIsPlaying(true));

    this.updateLockScreen(playerNextSong);
    interactionService.recordPlay(nextSong.id, 0);
    PlayerStore.saveLastQueue(queue, queueIdx);

    // "End of track" sleep timer must also work between tracks of the playlist
    if (state.player.sleepTimer === -1) {
      this.pause();
      store.dispatch(setSleepTimer(null));
      return;
    }

    if (
      state.queue.repeatMode !== "all" &&
      queue.length - (queueIdx + 1) <= 2
    ) {
      (store.dispatch as any)(refillQueue(false));
    }
  }

  private handlePlaylistStatusUpdate(status: AudioPlaylistStatus): void {
    if (!status) return;

    const dispatch = store.dispatch;

    // Sync current time
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
    const isLoaded = Boolean(status.isLoaded ?? true);

    dispatch(setIsPlaying(isPlaying));
    dispatch(setIsLoading(!isLoaded || (isBuffering && !isPlaying)));

    // Sync buffered time to Redux (native value only, no fabricated estimate)
    const nativeBuffered =
      (status as any)?.bufferedPosition ??
      (this.playlist as any)?.bufferedPosition ??
      (this.playlist as any)?.currentStatus?.bufferedPosition;
    const dur =
      typeof status.duration === "number" && status.duration > 0
        ? status.duration
        : (this.currentPlayingSong?.duration || 0);

    if (typeof nativeBuffered === "number" && nativeBuffered > 0) {
      dispatch(setBufferedTime(nativeBuffered));
    }

    if (dur > 0 && typeof status.currentTime === "number" && !isNaN(status.currentTime)) {
      this.lastProgressRatio = Math.min(1, status.currentTime / dur);
    }

    // Confirm lock screen active status once playback actually starts emitting audio & duration is known
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

    // Handle track completion on last track / repeatMode none
    const state = store.getState();
    const queue = state.queue.queue;
    const currentIndex = state.queue.currentIndex;
    const isLastTrackInQueue = !queue || currentIndex >= queue.length - 1;

    // For AudioPlaylist, native ExoPlayer automatically transitions between sequential tracks (0 -> 1 -> 2...)
    // and emits "trackChanged". JS only intervenes when reaching the very end of the playlist queue!
    const isNaturalTrackEnd =
      Boolean(status.didJustFinish) &&
      (typeof status.duration === "number" && status.duration > 0
        ? (status.currentTime ?? 0) >= Math.max(0, status.duration - 3)
        : true);

    if (
      isNaturalTrackEnd &&
      isLastTrackInQueue &&
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
        "[AudioPlayerService] Reached end of playlist. Determining next action..."
      );
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
      if (repeatMode === "one" && this.playlist) {
        this.playlist.seekTo(0).then(() => this.playlist?.play());
      } else if (repeatMode === "all" && this.playlist) {
        this.currentPlaylistIndex = 0;
        this.playlist.skipTo(0);
        this.playlist.play();
      } else {
        this.onTrackEndCallback?.();
      }
    }
  }

  public syncUpcomingPreload(): void {
    const state = store.getState();
    this.syncPlaylistWithQueue(
      state.queue.queue,
      state.queue.currentIndex,
      state.player.audioQuality || "auto"
    );
  }

  /**
   * Makes the native playlist match the Redux queue.
   * - queue only grew at the end  -> append the new tracks
   * - order/contents changed      -> rebuild around the song that is playing
   *   (if the current song itself changed, play() handles the rebuild)
   */
  private syncPlaylistWithQueue(
    queue: (Song | PlayerSong)[],
    currentIndex: number,
    quality: AudioQuality
  ): void {
    if (!this.playlist || !queue) return;

    // Cheap guard: store updates fire every 250ms for time ticks
    if (
      queue === this.lastSyncedQueue &&
      currentIndex === this.lastSyncedIndex &&
      quality === this.lastSyncedQuality
    ) {
      return;
    }
    this.lastSyncedQueue = queue;
    this.lastSyncedIndex = currentIndex;
    this.lastSyncedQuality = quality;

    const loaded = this.loadedQueueSongIds;
    const isPrefix =
      loaded.length <= queue.length && loaded.every((id, i) => id === queue[i].id);

    if (isPrefix) {
      for (let i = loaded.length; i < queue.length; i++) {
        const uri = resolveStreamUrl(queue[i], quality);
        if (!uri) break; // keep indexes aligned; retry on next sync
        try {
          this.playlist.add({ uri });
          this.loadedQueueSongIds.push(queue[i].id);
        } catch (err) {
          console.warn("[AudioPlayerService] Failed to append song to playlist:", err);
          break;
        }
      }
      return;
    }

    const current = queue[currentIndex];
    if (current && this.currentPlayingSong?.id === current.id) {
      const wasPlaying = Boolean(this.playlist.playing);
      this.buildPlaylist(
        queue,
        currentIndex,
        this.playlist.currentTime || 0,
        wasPlaying,
        quality
      );
      if (this.currentPlayingSong) this.updateLockScreen(this.currentPlayingSong);
    }
  }

  /**
   * Creates a fresh native playlist from `queue`, starts it at `index`, and
   * tears down + releases the previous one.
   */
  private buildPlaylist(
    queue: (Song | PlayerSong)[],
    index: number,
    startTime: number,
    autoplay: boolean,
    quality: AudioQuality
  ): AudioPlaylist {
    const state = store.getState();
    const repeatMode = state.queue.repeatMode;
    const loopMode: "none" | "all" | "single" =
      repeatMode === "all" ? "all" : repeatMode === "one" ? "single" : "none";

    const oldPlaylist = this.playlist;
    const oldStatusSub = this.statusSubscription;
    const oldTrackSub = this.trackChangedSubscription;

    // Drop subscriptions first so the old player can't emit into the new state
    try {
      oldStatusSub?.remove();
      oldTrackSub?.remove();
    } catch {}

    const sources = queue.map((s) => ({ uri: resolveStreamUrl(s, quality) }));
    this.loadedQueueSongIds = queue.map((s) => s.id);

    const newPlaylist = createAudioPlaylist({
      sources,
      updateInterval: 250,
      loop: loopMode,
    });

    this.currentLoopMode = loopMode;
    this.playlist = newPlaylist;
    this.currentPlaylistIndex = Math.max(0, index);
    this.lastSyncedQueue = null;

    this.statusSubscription = newPlaylist.addListener(
      "playlistStatusUpdate",
      (status: AudioPlaylistStatus) => this.handlePlaylistStatusUpdate(status)
    );
    this.trackChangedSubscription = newPlaylist.addListener(
      "trackChanged",
      (data: { previousIndex: number; currentIndex: number }) =>
        this.handleTrackChanged(data.previousIndex, data.currentIndex)
    );

    if (index > 0 && index < sources.length) {
      newPlaylist.skipTo(index);
    }
    if (startTime > 0) {
      newPlaylist.seekTo(startTime).catch(() => {});
    }

    const savedRate = state.player.playbackRate;
    if (typeof savedRate === "number" && savedRate > 0) {
      (newPlaylist as any).playbackRate = savedRate;
    }

    if (autoplay) {
      newPlaylist.play();
    }

    if (oldPlaylist) {
      try {
        safeSetActiveForLockScreen(oldPlaylist, false);
        oldPlaylist.pause();
      } catch {}
      try {
        (oldPlaylist as any).destroy?.();
      } catch {}
    }

    return newPlaylist;
  }

  /**
   * Plays `song` at the current queue index.
   * @param autoplay false keeps the player paused (used when only the engine is
   *   being rebuilt, e.g. quality change while paused).
   */
  public async play(
    song: Song | PlayerSong,
    startTime = 0,
    force = false,
    autoplay = true
  ): Promise<void> {
    const requestId = ++this.playRequestId;
    // Claim "current song" synchronously so the queue subscription does not
    // start a duplicate play() for the same change.
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
      if (requestId !== this.playRequestId) return; // a newer play() superseded us
    }

    console.log(
      `▶ [AudioPlayerService:PLAY] "${playerSong.title}" - ${playerSong.artistName} [ID: ${playerSong.id}]`
    );

    const state = store.getState();
    const currentQuality = state.player.audioQuality || "auto";
    this.currentQuality = currentQuality;
    const queue = state.queue.queue;
    const currentIndex = state.queue.currentIndex;
    const repeatMode = state.queue.repeatMode;
    const loopMode: "none" | "all" | "single" =
      repeatMode === "all" ? "all" : repeatMode === "one" ? "single" : "none";

    const queueSongs = queue && queue.length > 0 ? queue : [playerSong];
    const targetIndex =
      currentIndex >= 0 &&
      currentIndex < queueSongs.length &&
      queueSongs[currentIndex].id === playerSong.id
        ? currentIndex
        : Math.max(0, queueSongs.findIndex((s) => s.id === playerSong.id));

    this.isAdvancingTrack = false;
    this.currentPlayingSong = playerSong;
    this.lastPlayedIndex = targetIndex;
    this.lastPlayedSongId = playerSong.id;
    this.lastProgressRatio = 0;
    this.hasSyncedActiveLockScreen = false;
    this.lastReportedPlayingState = null;

    store.dispatch(setCurrentSong(playerSong));
    store.dispatch(setCurrentTime(startTime));
    store.dispatch(setBufferedTime(startTime));
    if (playerSong.duration) {
      store.dispatch(setDuration(playerSong.duration));
    }
    store.dispatch(setIsLoading(true));

    // Reuse the active playlist only when it mirrors the queue (same prefix and
    // the target slot holds this very song)
    const loaded = this.loadedQueueSongIds;
    const mirrorsQueue =
      loaded.length <= queueSongs.length &&
      loaded.every((id, i) => id === queueSongs[i].id);
    const canReuse =
      !force &&
      this.playlist !== null &&
      mirrorsQueue &&
      loaded[targetIndex] === playerSong.id;

    if (canReuse && this.playlist) {
      this.syncPlaylistWithQueue(queueSongs, targetIndex, currentQuality);

      if (this.currentPlaylistIndex !== targetIndex) {
        this.currentPlaylistIndex = targetIndex;
        this.playlist.skipTo(targetIndex);
      }
      if (startTime > 0) {
        this.playlist.seekTo(startTime).catch(() => {});
      }
      if (this.currentLoopMode !== loopMode) {
        this.currentLoopMode = loopMode;
        try {
          (this.playlist as any).loop = loopMode;
        } catch {}
      }
      if (autoplay) this.playlist.play();
    } else {
      this.buildPlaylist(queueSongs, targetIndex, startTime, autoplay, currentQuality);
    }

    this.updateLockScreen(playerSong);

    store.dispatch(setIsPlaying(autoplay));
    store.dispatch(setIsLoading(false));
    PlayerStore.saveLastSong(playerSong, startTime);
  }

  public pause(): void {
    if (!this.playlist) return;
    this.playlist.pause();
    this.lastReportedPlayingState = false;
    store.dispatch(setIsPlaying(false));
    if (typeof this.playlist.currentTime === "number" && this.playlist.currentTime >= 0) {
      PlayerStore.savePlaybackPosition(this.playlist.currentTime);
    }
    this.refreshLockScreen();
  }

  public resume(): void {
    if (!this.playlist) {
      const state = store.getState();
      const restoredSong = state.player.currentSong;
      if (restoredSong) {
        const savedTime = state.player.currentTime || 0;
        this.play(restoredSong, savedTime);
        return;
      }
    }

    if (!this.playlist) return;

    const curTime = this.playlist.currentTime || 0;
    const dur = this.playlist.duration || 0;
    if (dur > 0 && curTime >= dur - 0.5) {
      this.playlist.seekTo(0).then(() => {
        this.playlist?.play();
        this.lastReportedPlayingState = true;
        this.refreshLockScreen();
      });
    } else {
      this.playlist.play();
      this.lastReportedPlayingState = true;
      this.refreshLockScreen();
    }
    store.dispatch(setIsPlaying(true));
    store.dispatch(setIsLoading(false));
  }

  public updateLockScreen(song?: PlayerSong | Song | null, force = false): void {
    const targetSong = song || this.currentPlayingSong;
    if (!this.playlist || !targetSong) return;

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
      this.playlist,
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

  /**
   * Re-applies lock screen metadata. `force = true` fully re-registers Now Playing
   * + remote commands (iOS), used after returning to the foreground or after
   * another audio/video player touched the shared audio session.
   */
  public refreshLockScreen(force = false): void {
    if (!this.playlist || !this.currentPlayingSong) return;
    this.updateLockScreen(this.currentPlayingSong, force);
  }

  public togglePlay(): void {
    if (!this.playlist) {
      this.resume();
      return;
    }
    if (this.playlist.playing) {
      this.pause();
    } else {
      this.resume();
    }
  }

  public async seek(seconds: number): Promise<void> {
    if (!this.playlist) return;
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

    store.dispatch(setCurrentTime(safeTime));
    PlayerStore.savePlaybackPosition(safeTime);

    try {
      await this.playlist.seekTo(safeTime);
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
    if (this.playlist) {
      this.playlist.volume = Math.max(0, Math.min(1, vol));
    }
  }

  private sleepTimerTimeout: any = null;

  public setPlaybackRate(rate: number): void {
    if (this.playlist) {
      (this.playlist as any).playbackRate = rate;
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
      const curTime = this.playlist?.currentTime || 0;
      const wasPlaying = Boolean(this.playlist?.playing);
      this.play(this.currentPlayingSong, curTime, true, wasPlaying);
    }
  }

  public getCurrentTime(): number {
    return this.playlist?.currentTime ?? 0;
  }

  public isPlaying(): boolean {
    return this.playlist?.playing ?? false;
  }

  public getCurrentSong(): PlayerSong | null {
    return this.currentPlayingSong;
  }

  private reportPartialListen(): void {
    if (!this.currentPlayingSong?.id || !this.playlist) return;

    const currentTime = this.playlist.currentTime || 0;
    const duration = this.playlist.duration || this.currentPlayingSong.duration || 0;
    if (duration <= 0 || currentTime <= 0) return;

    const percentage = Math.min(1.0, currentTime / duration);
    if (percentage >= 0.05) {
      interactionService.recordPlay(this.currentPlayingSong.id, percentage);
    }
  }
}

export const audioPlayerService = new AudioPlayerService();