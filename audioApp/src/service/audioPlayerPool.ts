import { Platform } from "react-native";
import { createAudioPlayer, AudioPlayer, AudioStatus } from "expo-audio";
import { Song, PlayerSong, AudioQuality } from "@/types";
import { configureAudioPriority, safeSetActiveForLockScreen } from "@/utils/audioConfig";
import { getImageUrl } from "@/utils";
import { mapToPlayerSong, S3_BASE_URL } from "@/utils/playerUtils";
import { store } from "@/store/hook";

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

/** Forward buffer (seconds) for standby players. Active player uses system default (0). */
const STANDBY_FORWARD_BUFFER = 10;

/**
 * Safely sets preferredForwardBufferDuration (0 = system default / no cap).
 * Silently ignored if the installed expo-audio version doesn't support it.
 */
function setForwardBuffer(player: AudioPlayer, seconds: number) {
  try {
    (player as any).preferredForwardBufferDuration = seconds;
  } catch {}
}

/**
 * Applies the correct buffer policy for a slot based on its current role.
 */
function applyBufferPolicy(slot: PlayerSlot) {
  setForwardBuffer(
    slot.player,
    slot.role === "active" ? 0 : STANDBY_FORWARD_BUFFER,
  );
}

/**
 * Resolves optimal stream URI according to user bitrate quality settings.
 */
export function resolveStreamUrl(
  song: Song | PlayerSong,
  quality: AudioQuality = "auto",
): string {
  let uri =
    (song as PlayerSong).audioStreamUrl ||
    (song as PlayerSong).videoStreamUrl ||
    "";

  if (!uri) {
    const key =
      song.songKey ||
      (song as any).fullVideoKey ||
      (song as any).audioKey ||
      (song as any).videoKey;
    if (key) {
      uri = `${S3_BASE_URL}/${key}/master.m3u8`;
    }
  }

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
 * - Active: Currently rendering audio and controlling lock screen (no buffer cap)
 * - Standby 1: Next track (N+1) preloaded, buffered, paused at t=0
 * - Standby 2: Next track (N+2) preloaded, buffered, paused at t=0
 */
export class AudioPlayerPool {
  private slots: PlayerSlot[] = [];
  private isInitialized = false;
  private onActiveStatusUpdate:
    | ((status: AudioStatus, song: PlayerSong | null) => void)
    | null = null;

  public setStatusListener(
    listener: (status: AudioStatus, song: PlayerSong | null) => void,
  ) {
    this.onActiveStatusUpdate = listener;
  }

  async init(): Promise<void> {
    if (this.isInitialized && this.slots.length === 3) return;

    await configureAudioPriority();

    const roles: SlotRole[] = ["active", "standby1", "standby2"];
    this.slots = roles.map((role, idx) => {
      // NOTE: no preferredForwardBufferDuration here. It is applied per-role below
      // so the active player is never capped.
      // keepAudioSessionActive: true ensures the iOS audio session remains active across
      // track transitions so the Lock Screen and Control Center widgets do not disappear
      // when the old player is paused during standby promotion.
      const player = createAudioPlayer(null, {
        keepAudioSessionActive: true,
        updateInterval: 250,
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

      applyBufferPolicy(slot);

      // Listener only forwards updates to the service if this slot is active.
      // Standby readiness is tracked in preloadSlot() and when status becomes loaded.
      const sub = player.addListener(
        "playbackStatusUpdate",
        (status: AudioStatus) => {
          if (slot.role === "active") {
            this.onActiveStatusUpdate?.(status, slot.song);
          } else {
            if ((status as any)?.isLoaded) {
              slot.isReady = true;
            }
            if (status.playing) {
              slot.player.pause();
              slot.player.volume = 0;
            }
          }
        },
      );

      slot.statusSubscription = sub;
      return slot;
    });

    this.isInitialized = true;
    console.log(
      "[AudioPlayerPool] Successfully initialized 3-player rotation pool",
    );
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
    song: Song | PlayerSong | null,
    quality: AudioQuality = "auto",
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

    const playerSong: PlayerSong = (song as PlayerSong).audioStreamUrl
      ? (song as PlayerSong)
      : mapToPlayerSong(song);

    const targetUri = resolveStreamUrl(playerSong, quality);
    if (!targetUri) return;

    // If slot already has this exact song and URI buffered, preserve it
    if (
      slot.song?.id === playerSong.id &&
      slot.resolvedUri === targetUri &&
      slot.isReady
    ) {
      return;
    }

    slot.song = playerSong;
    slot.resolvedUri = targetUri;
    slot.isReady = false;

    try {
      // Ensure standby player is muted, paused and buffer-limited
      applyBufferPolicy(slot);
      slot.player.volume = 0;
      slot.player.pause();

      if (typeof (slot.player as any)?.replaceAsync === "function") {
        await (slot.player as any).replaceAsync({ uri: targetUri });
      } else {
        slot.player.replace({ uri: targetUri });
      }

      // Guard: slot may have been re-targeted/promoted while we were awaiting
      if (slot.song?.id === song.id && slot.role === role) {
        slot.isReady = true;
        console.log(
          `[AudioPlayerPool] Preloaded ${role} for "${song.title}" (${quality}): ${targetUri}`,
        );
      }
    } catch (err) {
      console.warn(
        `[AudioPlayerPool] Failed to preload ${role} for "${song.title}":`,
        err,
      );
      slot.isReady = false;
    }
  }

  /**
   * Instantly promotes a standby slot to active playback with 0ms transition delay.
   */
  async promoteStandby(
    targetRole: "standby1" | "standby2",
    quality: AudioQuality = "auto",
  ): Promise<PlayerSong | null> {
    await this.init();

    const currentActive = this.getActiveSlot();
    const targetSlot = this.getStandbySlot(targetRole);

    if (!targetSlot.song) {
      return null;
    }

    const promotedSong = targetSlot.song;
    console.log(
      `[AudioPlayerPool] Instant handover! Promoting ${targetRole} ("${promotedSong.title}") to active.`,
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

    // 1b. Re-apply buffer policy for every slot after rotation
    //     (new active = uncapped, demoted/standby = capped)
    for (const slot of this.slots) {
      applyBufferPolicy(slot);
    }

    // 2. Immediately activate target player with audio unmuted FIRST
    //    Starting audio output prevents iOS AVAudioSession from seeing a dead silence gap
    const savedRate = store.getState().player.playbackRate;
    if (typeof savedRate === "number" && savedRate > 0 && savedRate !== 1.0) {
      try {
        (targetSlot.player as any).playbackRate = savedRate;
      } catch {}
    }
    targetSlot.player.volume = 1.0;
    targetSlot.player.play();

    // 3. Activate lock screen controls on target player FIRST
    //    On Android: directly swaps the active player inside AudioControlsService without
    //    calling stopForeground(STOP_FOREGROUND_REMOVE), preventing the lock screen widget from disappearing.
    //    On iOS: registers Now Playing while audio is actively playing at rate=1.0.
    const rawImage =
      (promotedSong as any).coverUrl ||
      (promotedSong as any).posterUrl ||
      (promotedSong as any).imageKey ||
      (promotedSong as any).image_key ||
      (promotedSong as any).imageUrl;

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
      targetSlot.player,
      true,
      {
        title: promotedSong.title || "One Melody",
        artist: promotedSong.artistName || "Unknown Artist",
        albumTitle: promotedSong.album || "Melody",
        artworkUrl,
      },
      {
        showSeekForward: false,
        showSeekBackward: false,
        showNextTrack: true,
        showPreviousTrack: true,
      },
    );

    // 4. Pause and mute old active player
    currentActive.player.pause();
    currentActive.player.volume = 0;

    // On iOS only: explicitly detach the old player from AVAudioSession lock screen
    // On Android: DO NOT call safeSetActiveForLockScreen(currentActive, false)!
    // Doing so triggers AudioControlsService.clearSessionInternal() -> stopForeground(STOP_FOREGROUND_REMOVE),
    // which removes the lock screen notification and causes ForegroundServiceStartNotAllowedException on Android 12+.
    if (Platform.OS === "ios") {
      safeSetActiveForLockScreen(currentActive.player, false);
    }

    return promotedSong;
  }

  /**
   * Loads a song directly into the active slot (used for cold starts or non-standby jumps).
   */
  async loadActive(
    song: Song | PlayerSong,
    quality: AudioQuality = "auto",
    startTime = 0,
    autoplay = true
  ): Promise<PlayerSong | null> {
    await this.init();
    const activeSlot = this.getActiveSlot();
    if (!activeSlot) return null;

    const playerSong: PlayerSong = (song as PlayerSong).audioStreamUrl
      ? (song as PlayerSong)
      : mapToPlayerSong(song);

    const targetUri = resolveStreamUrl(playerSong, quality);
    if (!targetUri) return null;

    activeSlot.song = playerSong;
    activeSlot.resolvedUri = targetUri;
    activeSlot.isReady = false;

    applyBufferPolicy(activeSlot);
    activeSlot.player.volume = autoplay ? 1.0 : 0;

    try {
      if (typeof (activeSlot.player as any)?.replaceAsync === "function") {
        await (activeSlot.player as any).replaceAsync({ uri: targetUri });
      } else {
        activeSlot.player.replace({ uri: targetUri });
      }

      if (startTime > 0) {
        try {
          await activeSlot.player.seekTo(startTime);
        } catch {}
      }

      const savedRate = store.getState().player.playbackRate;
      if (typeof savedRate === "number" && savedRate > 0 && savedRate !== 1.0) {
        try {
          (activeSlot.player as any).playbackRate = savedRate;
        } catch {}
      }

      if (autoplay) {
        activeSlot.player.play();
      } else {
        activeSlot.player.pause();
      }

      activeSlot.isReady = true;

      const rawImage =
        (playerSong as any).coverUrl ||
        (playerSong as any).posterUrl ||
        (playerSong as any).imageKey ||
        (playerSong as any).image_key ||
        (playerSong as any).imageUrl;

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
        activeSlot.player,
        true,
        {
          title: playerSong.title || "One Melody",
          artist: playerSong.artistName || "Unknown Artist",
          albumTitle: playerSong.album || "Melody",
          artworkUrl,
        },
        {
          showSeekForward: false,
          showSeekBackward: false,
          showNextTrack: true,
          showPreviousTrack: true,
        }
      );

      return playerSong;
    } catch (err) {
      console.warn(
        `[AudioPlayerPool] Failed to load active song "${playerSong.title}":`,
        err
      );
      return null;
    }
  }

  /**
   * Synchronizes the upcoming 2 tracks from the playback queue into Standby 1 & 2.
   */
  async syncPreloadQueue(
    queue: (Song | PlayerSong)[],
    currentIndex: number,
    quality: AudioQuality = "auto",
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
        safeSetActiveForLockScreen(slot.player, false);
        slot.song = null;
        slot.resolvedUri = null;
        slot.isReady = false;
      } catch {}
    }
  }
}

export const audioPlayerPool = new AudioPlayerPool();