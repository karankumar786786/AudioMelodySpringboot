import {
  createAudioPlayer,
  setAudioModeAsync,
  AudioPlayer,
  AudioStatus,
} from "expo-audio";
import { PlayerSong, RepeatMode } from "@/types";
import { store } from "@/store/hook";
import { configureAudioPriority } from "@/utils/audioConfig";
export { configureAudioPriority };
import {
  setCurrentTime,
  setDuration,
  setIsLoading,
  setIsPlaying,
  setCurrentSong,
  setSleepTimer,
} from "@/store/playerSlice";

class AudioPlayerService {
  private player: AudioPlayer | null = null;
  private isInitialized = false;
  private currentPlayingSong: PlayerSong | null = null;
  private onTrackEndCallback: (() => void) | null = null;
  private isAdvancingTrack = false;

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

    // Sync current time and duration
    if (typeof status.currentTime === "number" && !isNaN(status.currentTime)) {
      dispatch(setCurrentTime(status.currentTime));
    }
    if (typeof status.duration === "number" && !isNaN(status.duration) && status.duration > 0) {
      dispatch(setDuration(status.duration));
    }

    dispatch(setIsPlaying(Boolean(status.playing)));
    dispatch(setIsLoading(Boolean(status.isBuffering)));

    // Track finished event (strictly validate track reached end and not already advancing)
    if (
      status.didJustFinish &&
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
      store.dispatch(setCurrentSong(song));
      store.dispatch(setIsLoading(true));

      const uri = song.audioStreamUrl || song.videoStreamUrl;
      if (!uri) {
        console.warn(`[AudioPlayerService] No stream URL found for song ${song.title} (${song.id})`);
        return;
      }

      console.log(`[AudioPlayerService] Loading stream for "${song.title}": ${uri}`);
      this.player.replace({ uri });

      // Update native lock screen & notification controls
      try {
        this.player.setActiveForLockScreen(true, {
          title: song.title,
          artist: song.artistName,
          albumTitle: song.album || "Melody",
          artworkUrl: song.coverUrl,
        });
      } catch (lockErr) {
        // Lock screen permissions or web fallback
        console.log("[AudioPlayerService] Lock screen metadata note:", lockErr);
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

      this.player.play();
      store.dispatch(setIsPlaying(true));
      store.dispatch(setIsLoading(false));
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
    store.dispatch(setCurrentTime(safeTime));
    await this.player.seekTo(safeTime);
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
