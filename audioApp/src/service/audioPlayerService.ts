import {
  createAudioPlayer,
  setAudioModeAsync,
  AudioPlayer,
  AudioStatus,
} from "expo-audio";
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

class AudioPlayerService {
  private player: AudioPlayer | null = null;
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

  public setOnTrackEnd(callback: (() => void) | null) {
    this.onTrackEndCallback = callback;
  }

  async init(): Promise<void> {
    if (this.isInitialized && this.player) return;

    try {
      // Configure top exclusive audio priority (doNotMix, silentMode, background)
      await configureAudioPriority();

      // Create singleton player instance with 250ms update interval for smooth progress UI
      this.player = createAudioPlayer(null, {
        keepAudioSessionActive: true,
        updateInterval: 250,
      });

      this.player.addListener(
        "playbackStatusUpdate",
        (status: AudioStatus) => {
          this.handlePlaybackStatusUpdate(status);
        },
      );

      this.isInitialized = true;
      console.log("[AudioPlayerService] Successfully initialized expo-audio engine");
    } catch (error) {
      console.error("[AudioPlayerService] Failed to initialize audio player:", error);
    }
  }

  private handlePlaybackStatusUpdate(status: AudioStatus): void {
    if (!status) return;

    const dispatch = store.dispatch;

    // Sync current time and duration with seek guard to prevent flicker / rubber-banding
    if (typeof status.currentTime === "number" && !isNaN(status.currentTime)) {
      if (this.isSeeking && this.seekTargetTime !== null) {
        const diff = Math.abs(status.currentTime - this.seekTargetTime);
        const elapsedSinceResolve = this.seekResolvedTimestamp > 0 ? Date.now() - this.seekResolvedTimestamp : 0;

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
        } else {
          // Stale playback update from pre-seek position — IGNORE to prevent flicker!
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

    // Sync buffered time to Redux
    const nativeBuffered = (status as any).bufferedPosition ?? (this.player as any)?.bufferedPosition;
    const dur = typeof status.duration === "number" && status.duration > 0 ? status.duration : (this.currentPlayingSong?.duration || 0);
    const curr = typeof status.currentTime === "number" && !isNaN(status.currentTime) ? status.currentTime : 0;

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

      if (repeatMode === "one" && this.player) {
        console.log("[AudioPlayerService] RepeatMode=one. Replaying current track...");
        this.player.seekTo(0).then(() => this.player?.play());
      } else {
        console.log("[AudioPlayerService] Advancing to next track in queue...");
        this.onTrackEndCallback?.();
      }
    }
  }

  async play(song: PlayerSong, startTime = 0, force = false): Promise<void> {
    await this.init();
    if (!this.player) return;

    // If this song is already playing and no seek/force is requested, do nothing
    if (!force && this.currentPlayingSong?.id === song.id && startTime === 0) {
      const isPlaying = store.getState().player.isPlaying;
      if (isPlaying) {
        return;
      }
      this.resume();
      return;
    }

    try {
      this.isAdvancingTrack = false;
      this.currentPlayingSong = song;
      this.bufferedSeconds = startTime;
      store.dispatch(setCurrentSong(song));
      store.dispatch(setBufferedTime(startTime));
      store.dispatch(setIsLoading(true));

      const state = store.getState();
      const currentQuality = state.player.audioQuality || "auto";
      let uri = song.audioStreamUrl || song.videoStreamUrl;
      if (!uri) {
        console.warn(`[AudioPlayerService] No stream URL found for song ${song.title} (${song.id})`);
        return;
      }

      if (currentQuality !== "auto" && uri.includes("master.m3u8")) {
        const cleanBase = uri.replace(/master\.m3u8.*$/, "");
        const qualityMap: Record<AudioQuality, string> = {
          standard: "audio/128kbps/playlist.m3u8",
          high: "audio/240kbps/playlist.m3u8",
          lossless: "audio/320kbps/playlist.m3u8",
          auto: "master.m3u8",
        };
        const subPath = qualityMap[currentQuality];
        if (subPath) {
          uri = `${cleanBase}${subPath}`;
        }
      }

      console.log(`[AudioPlayerService] Loading stream for "${song.title}" (${currentQuality}): ${uri}`);
      await configureAudioPriority(true);

      if (typeof (this.player as any)?.replaceAsync === "function") {
        await (this.player as any).replaceAsync({ uri });
      } else {
        this.player.replace({ uri });
      }

      if (startTime > 0) {
        await this.player.seekTo(startTime);
      }

      const savedRate = store.getState().player.playbackRate;
      if (typeof savedRate === "number" && savedRate > 0) {
        if (typeof (this.player as any).setPlaybackRate === "function") {
          (this.player as any).setPlaybackRate(savedRate);
        }
      }

      // Start native playback first so the session and rate are actively 1.0
      this.player.play();
      store.dispatch(setIsPlaying(true));
      store.dispatch(setIsLoading(false));

      // Update native lock screen & notification controls
      try {
        this.player.setActiveForLockScreen(
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
    } catch (err) {
      console.error(`[AudioPlayerService] Error playing song "${song.title}":`, err);
      store.dispatch(setIsLoading(false));
      store.dispatch(setIsPlaying(false));
    }
  }

  pause(): void {
    if (!this.player) return;
    this.player.pause();
    store.dispatch(setIsPlaying(false));
  }

  resume(): void {
    if (!this.player) return;
    configureAudioPriority(true).catch(() => {});
    const curTime = this.player.currentTime || 0;
    const dur = this.player.duration || 0;
    if (dur > 0 && curTime >= dur - 0.5) {
      // Track is already at EOF: restart from 0 instead of immediately triggering didJustFinish
      this.player.seekTo(0).then(() => {
        this.player?.play();
      });
    } else {
      this.player.play();
    }
    store.dispatch(setIsPlaying(true));
  }

  togglePlay(): void {
    if (!this.player) return;
    if (this.player.playing) {
      this.pause();
    } else {
      this.resume();
    }
  }

  async seek(seconds: number): Promise<void> {
    if (!this.player) return;
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

    try {
      await this.player.seekTo(safeTime);
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

  setVolume(vol: number): void {
    if (!this.player) return;
    const safeVol = Math.max(0, Math.min(1, vol));
    this.player.volume = safeVol;
  }

  private sleepTimerTimeout: any = null;

  setPlaybackRate(rate: number): void {
    if (!this.player) return;
    if (typeof (this.player as any).setPlaybackRate === "function") {
      (this.player as any).setPlaybackRate(rate);
    }
  }

  setSleepTimer(minutes: number | null): void {
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

  setAudioQuality(quality: AudioQuality): void {
    store.dispatch(setAudioQuality(quality));
    console.log(`[AudioPlayerService] Audio quality preference set to "${quality}". Applies to streaming tracks.`);
  }

  getCurrentTime(): number {
    return this.player?.currentTime ?? 0;
  }

  isPlaying(): boolean {
    return this.player?.playing ?? false;
  }

  getCurrentSong(): PlayerSong | null {
    return this.currentPlayingSong;
  }
}

export const audioPlayerService = new AudioPlayerService();
