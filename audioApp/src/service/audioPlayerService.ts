import {
  createAudioPlayer,
  setAudioModeAsync,
  AudioPlayer,
  AudioStatus,
} from "expo-audio";
import { PlayerSong, RepeatMode } from "@/types";
import { store } from "@/store/hook";
import {
  setCurrentTime,
  setDuration,
  setIsLoading,
  setIsPlaying,
  setCurrentSong,
} from "@/store/playerSlice";

class AudioPlayerService {
  private player: AudioPlayer | null = null;
  private isInitialized = false;
  private currentPlayingSong: PlayerSong | null = null;
  private onTrackEndCallback: (() => void) | null = null;

  public setOnTrackEnd(callback: (() => void) | null) {
    this.onTrackEndCallback = callback;
  }

  async init(): Promise<void> {
    if (this.isInitialized && this.player) return;

    try {
      // Configure global audio mode for background playback and lockscreen controls
      await setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: true,
        interruptionMode: "doNotMix",
      });

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

    // Track finished event
    if (status.didJustFinish) {
      console.log("[AudioPlayerService] Track finished playback. Determining next action...");
      const state = store.getState();
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

  async play(song: PlayerSong, startTime = 0): Promise<void> {
    await this.init();
    if (!this.player) return;

    try {
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
    this.player.play();
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

  setPlaybackRate(rate: number): void {
    if (!this.player) return;
    this.player.playbackRate = rate;
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
