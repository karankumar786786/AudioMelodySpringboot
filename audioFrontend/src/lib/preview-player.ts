import { Store } from "@tanstack/react-store";
import { type Song } from "./api";

const S3_BASE_URL =
  process.env.NEXT_PUBLIC_S3_BASE_URL ||
  "https://audiomelodyspringboot.s3.ap-south-1.amazonaws.com";

export type PreviewStatus = "idle" | "countdown" | "loading" | "playing";

export interface PreviewState {
  status: PreviewStatus;
  songId: string | null;
  songTitle: string | null;
  startTime: number;
  endTime: number;
  currentTime: number;
  progress: number;
}

export const previewStore = new Store<PreviewState>({
  status: "idle",
  songId: null,
  songTitle: null,
  startTime: 0,
  endTime: 0,
  currentTime: 0,
  progress: 0,
});

class PreviewManager {
  private timer: NodeJS.Timeout | null = null;
  private audio: HTMLAudioElement | null = null;
  private hls: any = null;
  private fadeInterval: any = null;
  private timeUpdateListener: (() => void) | null = null;
  private currentTargetSongId: string | null = null;

  /**
   * Called when mouse enters the play button on a SongCard.
   * Starts a 1-second countdown before playing the preview segment.
   */
  public startHoverCountdown(song: Song) {
    if (!song || !song.id) return;
    if (this.currentTargetSongId === song.id && previewStore.state.status !== "idle") {
      return; // Already counting down or playing this song
    }

    this.stopPreview(true);
    this.currentTargetSongId = song.id;

    const startTime = song.previewStartTime != null && song.previewStartTime >= 0 ? song.previewStartTime : 0;
    const endTime = song.previewEndTime != null && song.previewEndTime > startTime
      ? song.previewEndTime
      : startTime + 30;

    previewStore.setState(() => ({
      status: "countdown",
      songId: song.id,
      songTitle: song.title,
      startTime,
      endTime,
      currentTime: startTime,
      progress: 0,
    }));

    this.timer = setTimeout(() => {
      if (this.currentTargetSongId === song.id) {
        this.playPreview(song, startTime, endTime);
      }
    }, 1000);
  }

  /**
   * Immediately plays or stops the preview of a song without any hover/countdown delay.
   * Used for direct-click preview buttons in search, tables, and queues.
   */
  public togglePreview(song: Song) {
    if (!song || !song.id) return;
    if (
      this.currentTargetSongId === song.id &&
      (previewStore.state.status === "playing" ||
        previewStore.state.status === "loading" ||
        previewStore.state.status === "countdown")
    ) {
      this.stopPreview(false);
      return;
    }

    this.stopPreview(true);
    this.currentTargetSongId = song.id;

    const startTime =
      song.previewStartTime != null && song.previewStartTime >= 0
        ? song.previewStartTime
        : 0;
    const endTime =
      song.previewEndTime != null && song.previewEndTime > startTime
        ? song.previewEndTime
        : startTime + 30;

    this.playPreview(song, startTime, endTime);
  }

  /**
   * Starts actual audio playback of the preview segment.
   */
  private async playPreview(song: Song, startTime: number, endTime: number) {
    this.cleanupAudio();

    previewStore.setState((s) => ({
      ...s,
      status: "loading",
    }));

    try {
      const audio = new Audio();
      this.audio = audio;
      audio.volume = 0;
      audio.preload = "auto";

      const streamUrl = `${S3_BASE_URL}/${song.songKey}/master.m3u8`;

      const startPlayback = () => {
        if (this.audio !== audio || this.currentTargetSongId !== song.id) return;
        
        try {
          if (startTime > 0) {
            audio.currentTime = startTime;
          }
        } catch {}

        audio
          .play()
          .then(() => {
            if (this.audio !== audio || this.currentTargetSongId !== song.id) {
              audio.pause();
              return;
            }

            previewStore.setState((s) => ({
              ...s,
              status: "playing",
              currentTime: startTime,
              progress: 0,
            }));

            // Fade in volume smoothly to 0.75
            this.fadeIn(audio, 0.75, 400);

            // Time update listener to calculate progress and stop at endTime
            const checkTime = () => {
              if (!this.audio || this.audio !== audio) return;
              const cur = audio.currentTime;
              const duration = Math.max(0.1, endTime - startTime);
              const progress = Math.min(1, Math.max(0, (cur - startTime) / duration));

              previewStore.setState((s) => ({
                ...s,
                currentTime: cur,
                progress,
              }));

              if (audio.currentTime >= endTime || (endTime > 0 && audio.currentTime >= endTime - 0.2)) {
                this.stopPreview(false);
              }
            };
            this.timeUpdateListener = checkTime;
            audio.addEventListener("timeupdate", checkTime);
          })
          .catch((err) => {
            console.warn("[PreviewPlayer] Auto-play was blocked or failed:", err);
            this.stopPreview(true);
          });
      };

      // Native HLS (e.g. Safari)
      if (audio.canPlayType("application/vnd.apple.mpegurl")) {
        audio.src = streamUrl;
        audio.addEventListener("loadedmetadata", () => {
          startPlayback();
        }, { once: true });
        audio.load();
      } else {
        // HLS.js for Chromium / Firefox
        const HlsModule = await import("hls.js");
        const Hls = HlsModule.default;

        if (Hls.isSupported()) {
          const hls = new Hls({
            startPosition: startTime > 0 ? startTime : -1,
            enableWorker: true,
            lowLatencyMode: true,
          });
          this.hls = hls;
          hls.attachMedia(audio);

          hls.on(Hls.Events.MEDIA_ATTACHED, () => {
            hls.loadSource(streamUrl);
          });

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            startPlayback();
          });

          hls.on(Hls.Events.ERROR, (_event: any, data: any) => {
            if (data.fatal) {
              console.warn("[PreviewPlayer] Fatal HLS error during preview:", data.details);
              this.stopPreview(true);
            }
          });
        } else {
          audio.src = streamUrl;
          startPlayback();
        }
      }
    } catch (err) {
      console.warn("[PreviewPlayer] Failed to initialize preview:", err);
      this.stopPreview(true);
    }
  }

  /**
   * Stops any pending countdown or active preview playback.
   */
  public stopPreview(immediate = false) {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.currentTargetSongId = null;

    if (this.fadeInterval) {
      clearInterval(this.fadeInterval);
      this.fadeInterval = null;
    }

    if (!this.audio) {
      previewStore.setState(() => ({
        status: "idle",
        songId: null,
        songTitle: null,
        startTime: 0,
        endTime: 0,
        currentTime: 0,
        progress: 0,
      }));
      return;
    }

    const currentAudio = this.audio;

    if (immediate) {
      this.cleanupAudio();
      previewStore.setState(() => ({
        status: "idle",
        songId: null,
        songTitle: null,
        startTime: 0,
        endTime: 0,
        currentTime: 0,
        progress: 0,
      }));
    } else {
      // Smooth fade out over 250ms
      this.fadeOut(currentAudio, 250, () => {
        if (this.audio === currentAudio) {
          this.cleanupAudio();
        }
        previewStore.setState(() => ({
          status: "idle",
          songId: null,
          songTitle: null,
          startTime: 0,
          endTime: 0,
          currentTime: 0,
          progress: 0,
        }));
      });
    }
  }

  private fadeIn(audio: HTMLAudioElement, targetVol: number, durationMs: number) {
    if (this.fadeInterval) clearInterval(this.fadeInterval);
    const stepMs = 25;
    const steps = durationMs / stepMs;
    const stepIncrement = targetVol / steps;
    let currentVol = 0;
    audio.volume = 0;

    this.fadeInterval = setInterval(() => {
      currentVol = Math.min(targetVol, currentVol + stepIncrement);
      if (audio) audio.volume = currentVol;
      if (currentVol >= targetVol) {
        clearInterval(this.fadeInterval);
        this.fadeInterval = null;
      }
    }, stepMs);
  }

  private fadeOut(audio: HTMLAudioElement, durationMs: number, onComplete?: () => void) {
    if (this.fadeInterval) clearInterval(this.fadeInterval);
    const stepMs = 25;
    const steps = durationMs / stepMs;
    const stepDecrement = (audio.volume || 0.75) / steps;
    let currentVol = audio.volume;

    this.fadeInterval = setInterval(() => {
      currentVol = Math.max(0, currentVol - stepDecrement);
      if (audio) audio.volume = currentVol;
      if (currentVol <= 0.05) {
        clearInterval(this.fadeInterval);
        this.fadeInterval = null;
        try {
          audio.pause();
        } catch {}
        onComplete?.();
      }
    }, stepMs);
  }

  private cleanupAudio() {
    if (this.fadeInterval) {
      clearInterval(this.fadeInterval);
      this.fadeInterval = null;
    }
    if (this.audio) {
      if (this.timeUpdateListener) {
        this.audio.removeEventListener("timeupdate", this.timeUpdateListener);
        this.timeUpdateListener = null;
      }
      try {
        this.audio.pause();
        this.audio.src = "";
        this.audio.load();
      } catch {}
      this.audio = null;
    }
    if (this.hls) {
      try {
        this.hls.destroy();
      } catch {}
      this.hls = null;
    }
  }
}

export const previewPlayer = new PreviewManager();
