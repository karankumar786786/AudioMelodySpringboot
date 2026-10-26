import {
  createAudioPlayer,
  AudioPlayer,
  AudioStatus,
} from "expo-audio";
import { PlayerSong, AudioQuality } from "@/types";
import { configureAudioPriority } from "@/utils/audioConfig";

export type SlotRole = "active" | "standby1" | "standby2";

export interface PlayerSlot {
  slotId: string;
  role: SlotRole;
  player: AudioPlayer;
  song: PlayerSong | null;
  resolvedUri: string | null;
  isReady: boolean;
  statusSubscription: { remove: () => void } | null;
}

/**
 * Resolves optimal stream URI according to user bitrate quality settings.
 */
export function resolveStreamUrl(song: PlayerSong, quality: AudioQuality = "auto"): string {
  let uri = song.audioStreamUrl || song.videoStreamUrl || "";
  if (!uri) return "";

  if (quality !== "auto" && uri.includes("master.m3u8")) {
    const cleanBase = uri.replace(/master\.m3u8.*$/, "");
    const qualityMap: Record<AudioQuality, string> = {
      standard: "audio/128kbps/playlist.m3u8",
      high: "audio/240kbps/playlist.m3u8",
      lossless: "audio/320kbps/playlist.m3u8",
      auto: "master.m3u8",
    };
    const subPath = qualityMap[quality];
    if (subPath) {
      return `${cleanBase}${subPath}`;
    }
  }
  return uri;
}

/**
 * Manages a persistent rotation pool of 3 native AudioPlayers:
 * - Active: Currently rendering audio and controlling lock screen
 * - Standby 1: Next track (N+1) preloaded, buffered, paused at t=0
 * - Standby 2: Next track (N+2) preloaded, buffered, paused at t=0
 */
export class AudioPlayerPool {
  private slots: PlayerSlot[] = [];
  private isInitialized = false;
  private onActiveStatusUpdate: ((status: AudioStatus, song: PlayerSong | null) => void) | null = null;

  public setStatusListener(listener: (status: AudioStatus, song: PlayerSong | null) => void) {
    this.onActiveStatusUpdate = listener;
  }

  async init(): Promise<void> {
    if (this.isInitialized && this.slots.length === 3) return;

    await configureAudioPriority();

    const roles: SlotRole[] = ["active", "standby1", "standby2"];
    this.slots = roles.map((role, idx) => {
      const player = createAudioPlayer(null, {
        keepAudioSessionActive: true,
        updateInterval: 250,
        preferredForwardBufferDuration: 10,
      });

      const slot: PlayerSlot = {
        slotId: `slot_${idx}_${role}`,
        role,
        player,
        song: null,
        resolvedUri: null,
        isReady: false,
        statusSubscription: null,
      };

      // Attach listener that only dispatches to service if this slot is active
      const sub = player.addListener("playbackStatusUpdate", (status: AudioStatus) => {
        if (slot.role === "active") {
          this.onActiveStatusUpdate?.(status, slot.song);
        } else {
          // Monitor standby readiness (first 10 seconds buffered)
          if (status.isLoaded && !slot.isReady) {
            slot.isReady = true;
            console.log(
              `[AudioPlayerPool] Standby slot (${slot.role}) pre-buffered 10s & ready: "${slot.song?.title}"`
            );
          }
        }
      });

      slot.statusSubscription = sub;
      return slot;
    });

    this.isInitialized = true;
    console.log("[AudioPlayerPool] Successfully initialized 3-player rotation pool");
  }

  getActiveSlot(): PlayerSlot {
    const slot = this.slots.find((s) => s.role === "active");
    return slot || this.slots[0];
  }

  getStandbySlot(role: "standby1" | "standby2"): PlayerSlot {
    const slot = this.slots.find((s) => s.role === role);
    return slot || (role === "standby1" ? this.slots[1] : this.slots[2]);
  }

  findSlotBySongId(songId: string): PlayerSlot | null {
    if (!songId) return null;
    return this.slots.find((s) => s.song?.id === songId) || null;
  }

  /**
   * Preloads a song into a designated standby slot.
   */
  async preloadSlot(
    role: "standby1" | "standby2",
    song: PlayerSong | null,
    quality: AudioQuality = "auto"
  ): Promise<void> {
    await this.init();
    const slot = this.getStandbySlot(role);
    if (!slot) return;

    if (!song) {
      slot.song = null;
      slot.resolvedUri = null;
      slot.isReady = false;
      return;
    }

    const targetUri = resolveStreamUrl(song, quality);
    if (!targetUri) return;

    // If slot already has this exact song and URI buffered, preserve it
    if (slot.song?.id === song.id && slot.resolvedUri === targetUri && slot.isReady) {
      return;
    }

    slot.song = song;
    slot.resolvedUri = targetUri;
    slot.isReady = false;

    try {
      // Ensure standby player is muted and paused
      slot.player.volume = 0;
      slot.player.pause();

      if (typeof (slot.player as any)?.replaceAsync === "function") {
        await (slot.player as any).replaceAsync({ uri: targetUri });
      } else {
        slot.player.replace({ uri: targetUri });
      }

      slot.isReady = true;
      console.log(`[AudioPlayerPool] Preloaded ${role} for "${song.title}" (${quality}): ${targetUri}`);
    } catch (err) {
      console.warn(`[AudioPlayerPool] Failed to preload ${role} for "${song.title}":`, err);
      slot.isReady = false;
    }
  }

  /**
   * Instantly promotes a standby slot to active playback with 0ms transition delay.
   */
  async promoteStandby(
    targetRole: "standby1" | "standby2",
    quality: AudioQuality = "auto"
  ): Promise<PlayerSong | null> {
    await this.init();

    const currentActive = this.getActiveSlot();
    const targetSlot = this.getStandbySlot(targetRole);

    if (!targetSlot.song) {
      return null;
    }

    const promotedSong = targetSlot.song;
    console.log(
      `[AudioPlayerPool] Instant handover! Promoting ${targetRole} ("${promotedSong.title}") to active.`
    );

    // 1. Rotate slot roles FIRST so targetSlot is immediately identified as "active"
    if (targetRole === "standby1") {
      const standby2 = this.getStandbySlot("standby2");
      targetSlot.role = "active";
      standby2.role = "standby1";
      currentActive.role = "standby2";
      currentActive.song = null;
      currentActive.resolvedUri = null;
      currentActive.isReady = false;
    } else {
      targetSlot.role = "active";
      currentActive.role = "standby2";
      currentActive.song = null;
      currentActive.resolvedUri = null;
      currentActive.isReady = false;
    }

    // 2. Deactivate old active player
    try {
      if (typeof currentActive.player.clearLockScreenControls === "function") {
        currentActive.player.clearLockScreenControls();
      } else {
        currentActive.player.setActiveForLockScreen(false);
      }
    } catch {}
    currentActive.player.pause();
    currentActive.player.volume = 0;

    // 3. Immediately activate target player with audio unmuted
    targetSlot.player.volume = 1.0;
    targetSlot.player.play();

    // 4. Update lock screen controls on the newly promoted player
    try {
      targetSlot.player.setActiveForLockScreen(
        true,
        {
          title: promotedSong.title,
          artist: promotedSong.artistName,
          albumTitle: promotedSong.album || "Melody",
          artworkUrl: promotedSong.coverUrl,
        },
        {
          showSeekForward: true,
          showSeekBackward: true,
          seekForwardIntervalSeconds: 10,
          seekBackwardIntervalSeconds: 10,
        }
      );
    } catch (err) {
      console.log("[AudioPlayerPool] Note on lock screen promotion:", err);
    }

    return promotedSong;
  }

  /**
   * Synchronizes the upcoming 2 tracks from the playback queue into Standby 1 & 2.
   */
  async syncPreloadQueue(
    queue: PlayerSong[],
    currentIndex: number,
    quality: AudioQuality = "auto"
  ): Promise<void> {
    if (!queue || queue.length === 0) return;

    const next1 = queue[currentIndex + 1] || null;
    const next2 = queue[currentIndex + 2] || null;

    await Promise.all([
      this.preloadSlot("standby1", next1, quality),
      this.preloadSlot("standby2", next2, quality),
    ]);
  }

  /**
   * Resets all slots on full shutdown / stop.
   */
  resetAll(): void {
    for (const slot of this.slots) {
      try {
        slot.player.pause();
        slot.player.volume = 0;
        slot.song = null;
        slot.resolvedUri = null;
        slot.isReady = false;
      } catch {}
    }
  }
}

export const audioPlayerPool = new AudioPlayerPool();
