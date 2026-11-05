import {
  createAudioPlaylist,
  AudioPlaylist,
  AudioPlaylistStatus,
} from "expo-audio";
import { Song, PlayerSong, RepeatMode, AudioQuality } from "@/types";
import { store } from "@/store/hook";
import { configureAudioPriority, safeSetActiveForLockScreen } from "@/utils";
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
  private bufferedSeconds = 0;
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

      // Synchronize repeat mode changes with AudioPlaylist loop mode
      if (this.playlist) {
        const expectedLoop =
          repeatMode === "all" ? "all" : repeatMode === "one" ? "single" : "none";
        if ((this.playlist as any).loop !== expectedLoop) {
          (this.playlist as any).loop = expectedLoop;
        }
      }

      // Append new upcoming songs added to queue (e.g. similarity recommendations)
      if (this.playlist && queue.length > this.loadedQueueSongIds.length) {
        const currentQuality = state.player.audioQuality || "auto";
        for (let i = this.loadedQueueSongIds.length; i < queue.length; i++) {
          const song = queue[i];
          const uri = resolveStreamUrl(song, currentQuality);
          if (uri) {
            try {
              this.playlist.add({ uri });
              this.loadedQueueSongIds.push(song.id);
            } catch (err) {
              console.warn("[AudioPlayerService] Failed to append song to playlist:", err);
            }
          }
        }
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

  private handleTrackChanged(previousIndex: number, currentIndex: number): void {
    console.log(
      `[AudioPlayerService] ⏭️ Track Changed: ${previousIndex} -> ${currentIndex}`
    );
    const state = store.getState();
    const queue = state.queue.queue;
    if (!queue || currentIndex < 0 || currentIndex >= queue.length) return;

    const nextSong = queue[currentIndex];
    if (!nextSong) return;

    if (
      this.lastPlayedIndex === currentIndex &&
      this.lastPlayedSongId === nextSong.id
    ) {
      return;
    }

    this.lastPlayedIndex = currentIndex;
    this.lastPlayedSongId = nextSong.id;
    const playerNextSong = mapToPlayerSong(nextSong);
    this.currentPlayingSong = playerNextSong;

    store.dispatch(setQueueIndex(currentIndex));
    store.dispatch(setCurrentSong(playerNextSong));
    store.dispatch(setCurrentTime(0));
    store.dispatch(setIsPlaying(true));

    configureAudioPriority().then(() => {
      this.refreshLockScreen();
    });

    interactionService.recordPlay(nextSong.id, 0);

    if (queue.length - (currentIndex + 1) <= 2) {
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
    const isNaturalTrackEnd =
      Boolean(status.didJustFinish) &&
      (typeof status.duration === "number" && status.duration > 0
        ? (status.currentTime ?? 0) >= Math.max(0, status.duration - 3)
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
        "[AudioPlayerService] Track finished playback. Determining next action..."
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
      if (repeatMode === "one" && this.playlist) {
        this.playlist.seekTo(0).then(() => this.playlist?.play());
      } else {
        this.onTrackEndCallback?.();
      }
    }
  }

  public syncUpcomingPreload(): void {
    const state = store.getState();
    const { queue } = state.queue;
    if (!this.playlist || !queue) return;

    if (queue.length > this.loadedQueueSongIds.length) {
      const currentQuality = state.player.audioQuality || "auto";
      for (let i = this.loadedQueueSongIds.length; i < queue.length; i++) {
        const song = queue[i];
        const uri = resolveStreamUrl(song, currentQuality);
        if (uri) {
          try {
            this.playlist.add({ uri });
            this.loadedQueueSongIds.push(song.id);
          } catch {}
        }
      }
    }
  }

  public async play(
    song: Song | PlayerSong,
    startTime = 0,
    force = false
  ): Promise<void> {
    await this.init();

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
    }

    console.log(
      `▶ [AudioPlayerService:PLAY] "${playerSong.title}" - ${playerSong.artistName} [ID: ${playerSong.id}] | Duration: ${playerSong.duration}s | AudioKey: ${playerSong.songKey}`
    );

    const state = store.getState();
    const currentQuality = state.player.audioQuality || "auto";
    this.currentQuality = currentQuality;
    const queue = state.queue.queue;
    const currentIndex = state.queue.currentIndex;
    const repeatMode = state.queue.repeatMode;
    const loopMode =
      repeatMode === "all" ? "all" : repeatMode === "one" ? "single" : "none";

    const queueSongs = queue && queue.length > 0 ? queue : [playerSong];
    const currentSongIds = queueSongs.map((s) => s.id);
    const targetIndex =
      currentIndex >= 0 && currentIndex < queueSongs.length
        ? currentIndex
        : Math.max(0, queueSongs.findIndex((s) => s.id === playerSong.id));

    this.isAdvancingTrack = false;
    this.currentPlayingSong = playerSong;
    this.lastPlayedIndex = targetIndex;
    this.lastPlayedSongId = playerSong.id;
    this.bufferedSeconds = startTime;

    store.dispatch(setCurrentSong(playerSong));
    store.dispatch(setCurrentTime(startTime));
    store.dispatch(setBufferedTime(startTime));
    if (playerSong.duration) {
      store.dispatch(setDuration(playerSong.duration));
    }
    store.dispatch(setIsLoading(true));

    // Check if the target song is already present in active this.playlist
    const existingIndexInPlaylist = this.playlist
      ? this.loadedQueueSongIds.indexOf(playerSong.id)
      : -1;

    const canReusePlaylist =
      !force &&
      this.playlist !== null &&
      existingIndexInPlaylist !== -1;

    if (canReusePlaylist && this.playlist) {
      console.log(
        `[AudioPlayerService] Reusing active playlist for track index ${existingIndexInPlaylist}: "${playerSong.title}"`
      );

      // Append any new upcoming songs added to queue (e.g. from refill recommendations)
      if (queueSongs.length > this.loadedQueueSongIds.length) {
        for (let i = this.loadedQueueSongIds.length; i < queueSongs.length; i++) {
          const s = queueSongs[i];
          const uri = resolveStreamUrl(s, currentQuality);
          if (uri) {
            try {
              this.playlist.add({ uri });
              this.loadedQueueSongIds.push(s.id);
            } catch {}
          }
        }
      }

      if (this.playlist.currentIndex !== existingIndexInPlaylist) {
        this.playlist.skipTo(existingIndexInPlaylist);
      }
      if (startTime > 0) {
        this.playlist.seekTo(startTime).catch(() => {});
      }
      (this.playlist as any).loop = loopMode;
      this.playlist.play();
    } else {
      console.log(
        `[AudioPlayerService] Creating new AudioPlaylist with ${queueSongs.length} track(s) starting at index ${targetIndex} for "${playerSong.title}"`
      );

      const oldPlaylist = this.playlist;
      const oldStatusSub = this.statusSubscription;
      const oldTrackSub = this.trackChangedSubscription;

      const sources = queueSongs.map((s) => ({
        uri: resolveStreamUrl(s, currentQuality),
      }));
      this.loadedQueueSongIds = [...currentSongIds];

      const newPlaylist = createAudioPlaylist({
        sources,
        updateInterval: 250,
        loop: loopMode,
      });

      this.playlist = newPlaylist;

      this.statusSubscription = newPlaylist.addListener(
        "playlistStatusUpdate",
        (status: AudioPlaylistStatus) => {
          this.handlePlaylistStatusUpdate(status);
        }
      );

      this.trackChangedSubscription = newPlaylist.addListener(
        "trackChanged",
        (data: { previousIndex: number; currentIndex: number }) => {
          this.handleTrackChanged(data.previousIndex, data.currentIndex);
        }
      );

      if (targetIndex > 0 && targetIndex < sources.length) {
        newPlaylist.skipTo(targetIndex);
      }

      if (startTime > 0) {
        newPlaylist.seekTo(startTime).catch(() => {});
      }

      const savedRate = store.getState().player.playbackRate;
      if (typeof savedRate === "number" && savedRate > 0) {
        (newPlaylist as any).playbackRate = savedRate;
      }

      newPlaylist.play();

      if (oldPlaylist) {
        try {
          oldPlaylist.pause();
          oldStatusSub?.remove();
          oldTrackSub?.remove();
        } catch {}
      }
    }

    safeSetActiveForLockScreen(
      this.playlist,
      true,
      {
        title: playerSong.title,
        artist: playerSong.artistName,
        albumTitle: playerSong.album || "Melody",
        artworkUrl: playerSong.coverUrl || playerSong.posterUrl,
      },
      {
        showSeekForward: false,
        showSeekBackward: false,
        showNextTrack: true,
        showPreviousTrack: true,
      }
    );

    store.dispatch(setIsPlaying(true));
    store.dispatch(setIsLoading(false));
    PlayerStore.saveLastSong(playerSong, startTime);
  }

  public pause(): void {
    if (!this.playlist) return;
    this.playlist.pause();
    store.dispatch(setIsPlaying(false));
    if (typeof this.playlist.currentTime === "number" && this.playlist.currentTime >= 0) {
      PlayerStore.savePlaybackPosition(this.playlist.currentTime);
    }
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

    if (this.currentPlayingSong) {
      safeSetActiveForLockScreen(
        this.playlist,
        true,
        {
          title: this.currentPlayingSong.title,
          artist: this.currentPlayingSong.artistName,
          albumTitle: this.currentPlayingSong.album || "Melody",
          artworkUrl: this.currentPlayingSong.coverUrl || this.currentPlayingSong.posterUrl,
        },
        {
          showSeekForward: false,
          showSeekBackward: false,
          showNextTrack: true,
          showPreviousTrack: true,
        }
      );
    }

    const curTime = this.playlist.currentTime || 0;
    const dur = this.playlist.duration || 0;
    if (dur > 0 && curTime >= dur - 0.5) {
      this.playlist.seekTo(0).then(() => {
        this.playlist?.play();
      });
    } else {
      this.playlist.play();
    }
    store.dispatch(setIsPlaying(true));
    store.dispatch(setIsLoading(false));
  }

  public async refreshLockScreen(): Promise<void> {
    await configureAudioPriority(true);
    if (!this.playlist || !this.currentPlayingSong) return;
    safeSetActiveForLockScreen(
      this.playlist,
      true,
      {
        title: this.currentPlayingSong.title,
        artist: this.currentPlayingSong.artistName,
        albumTitle: this.currentPlayingSong.album || "Melody",
        artworkUrl: this.currentPlayingSong.coverUrl || this.currentPlayingSong.posterUrl,
      },
      {
        showSeekForward: false,
        showSeekBackward: false,
        showNextTrack: true,
        showPreviousTrack: true,
      }
    );
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

    this.bufferedSeconds = safeTime;
    store.dispatch(setCurrentTime(safeTime));
    store.dispatch(setBufferedTime(safeTime));
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
      this.play(this.currentPlayingSong, curTime, true);
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
