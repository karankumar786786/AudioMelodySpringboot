import { Platform } from "react-native";
import {
  setAudioModeAsync,
  setIsAudioActiveAsync,
  AudioPlayer,
  AudioPlaylist,
  requestNotificationPermissionsAsync,
} from "expo-audio";
import Constants, { ExecutionEnvironment } from "expo-constants";

export const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

/**
 * Configures top exclusive audio priority for One Melody.
 * - `playsInSilentMode: true`: audio continues playing even if phone is on silent/vibrate.
 * - `interruptionMode: 'doNotMix'`: requests exclusive audio focus, automatically
 *   pausing playback when other media apps (Instagram, YouTube, TikTok, phone calls) play audio,
 *   and supporting background playback on lock screen.
 * - `shouldPlayInBackground: true`: audio continues playing in background and lock screen.
 */
let isConfigured = false;
let configuringPromise: Promise<void> | null = null;

export async function configureAudioPriority(force = false): Promise<void> {
  if (Platform.OS === "web") return;
  if (!force && isConfigured) return;
  if (!force && configuringPromise) return configuringPromise;

  configuringPromise = (async () => {
    try {
      if (Platform.OS === "android" && !isExpoGo) {
        try {
          await requestNotificationPermissionsAsync();
        } catch (err) {
          console.log("[AudioPriority] Notification permission request error:", err);
        }
      }

      await setAudioModeAsync({
        playsInSilentMode: true,
        interruptionMode: "doNotMix",
        interruptionModeAndroid: "doNotMix",
        shouldPlayInBackground: true,
        allowsRecording: false,
        shouldRouteThroughEarpiece: false,
      });
      await setIsAudioActiveAsync(true);
      if (!isConfigured) {
        console.log("[AudioPriority] Audio session initialized (high-fidelity stereo, exclusive audio focus, background active)");
      }
      isConfigured = true;
    } catch (error) {
      console.warn("[AudioPriority] Failed to configure audio priority:", error);
    } finally {
      configuringPromise = null;
    }
  })();

  return configuringPromise;
}

/**
 * Safely activates or deactivates lock screen controls on a player.
 * In Expo Go, native config plugins cannot run and AudioControlsService
 * is not declared in Expo Go's AndroidManifest.xml, which causes service binding
 * errors. We guard this call in Expo Go to avoid crashing/error logs while allowing
 * full background playback in development builds and production releases.
 */
export function safeSetActiveForLockScreen(
  player: AudioPlayer | AudioPlaylist | null | undefined,
  active: boolean,
  metadata?: any,
  options?: any
): void {
  if (!player) {
    console.warn("[LockScreen:DIAGNOSTIC] ⚠️ Cannot configure lock screen: AudioPlayer instance is null or undefined");
    return;
  }

  const playerId = (player as any)?.id || "unknown";
  const isPlaying = (player as any)?.playing ?? "unknown";
  const duration = (player as any)?.duration ?? 0;
  const currentTime = (player as any)?.currentTime ?? 0;
  const stateSummary = `player[${playerId}] | isPlaying=${isPlaying} | duration=${duration}s | pos=${currentTime}s`;

  // On Android only: Expo Go lacks AudioControlsService in its manifest
  if (Platform.OS === "android" && isExpoGo) {
    console.warn(`[LockScreen:DIAGNOSTIC] ⚠️ Lock screen controls skipped on Android Expo Go (Expo Go manifest lacks AudioControlsService). Build a dev client to test Android lock screen. ${stateSummary}`);
    return;
  }

  try {
    if (active) {
      // If this player is already registered and active for lock screen, DO NOT
      // call player.setActiveForLockScreen(true, ...) again. In expo-audio on Android,
      // calling setActiveForLockScreen on an already active player releases the MediaSession
      // and attempts to rebuild the foreground service, which gets suppressed/fails when the phone
      // is locked. Instead, update the existing session's metadata and artwork in-place!
      if ((player as any)._isLockScreenActive) {
        safeUpdateLockScreenMetadata(player, metadata);
        return;
      }

      const cleanMetadata = metadata
        ? {
            title: metadata.title || "One Melody",
            artist: metadata.artist || "Unknown Artist",
            albumTitle: metadata.albumTitle || "One Melody",
            artworkUrl:
              typeof metadata.artworkUrl === "string" &&
              metadata.artworkUrl.startsWith("http")
                ? metadata.artworkUrl
                : undefined,
          }
        : undefined;

      const cleanOptions = {
        showSeekForward: false,
        showSeekBackward: false,
        showNextTrack: true,
        showPreviousTrack: true,
        seekForwardIntervalSeconds: 10,
        seekBackwardIntervalSeconds: 10,
        ...(options || {}),
      };

      console.log(
        `[LockScreen:DIAGNOSTIC] 📱 Activating Lock Screen & Control Center -> Title: "${cleanMetadata?.title}" | Artist: "${cleanMetadata?.artist}" | Artwork: ${cleanMetadata?.artworkUrl ? "YES" : "NO"} | ${stateSummary}`
      );

      (player as any)._isLockScreenActive = true;
      player.setActiveForLockScreen(active, cleanMetadata, cleanOptions);
    } else {
      (player as any)._isLockScreenActive = false;
      console.log(`[LockScreen:DIAGNOSTIC] ⏹️ Deactivating lock screen controls | ${stateSummary}`);
      if (typeof (player as any).clearLockScreenControls === "function") {
        (player as any).clearLockScreenControls();
      } else {
        player.setActiveForLockScreen(false);
      }
    }
  } catch (err) {
    console.error("[LockScreen:DIAGNOSTIC] ❌ Exception in player.setActiveForLockScreen:", err);
  }
}

/**
 * Safely updates lock screen metadata (title, artist, album, artwork) on an active player.
 * Calls player.updateLockScreenMetadata(metadata) directly without tearing down
 * or rebuilding the underlying Android MediaSession / iOS MPNowPlayingInfoCenter.
 */
export function safeUpdateLockScreenMetadata(
  player: AudioPlayer | AudioPlaylist | null | undefined,
  metadata?: {
    title?: string;
    artist?: string;
    albumTitle?: string;
    artworkUrl?: string;
  }
): void {
  if (!player) return;

  if (Platform.OS === "android" && isExpoGo) {
    return;
  }

  const cleanMetadata = metadata
    ? {
        title: metadata.title || "One Melody",
        artist: metadata.artist || "Unknown Artist",
        albumTitle: metadata.albumTitle || "One Melody",
        artworkUrl:
          typeof metadata.artworkUrl === "string" &&
          metadata.artworkUrl.startsWith("http")
            ? metadata.artworkUrl
            : undefined,
      }
    : undefined;

  if (!cleanMetadata) return;

  // De-duplicate: Skip redundant updates if metadata hasn't changed
  const lastMeta = (player as any)._lastAppliedMetadata;
  if (
    lastMeta &&
    lastMeta.title === cleanMetadata.title &&
    lastMeta.artist === cleanMetadata.artist &&
    lastMeta.albumTitle === cleanMetadata.albumTitle &&
    lastMeta.artworkUrl === cleanMetadata.artworkUrl
  ) {
    return;
  }

  // If lock screen controls have not been activated on this player yet, activate them first
  if (!(player as any)._isLockScreenActive) {
    safeSetActiveForLockScreen(player, true, cleanMetadata);
    (player as any)._lastAppliedMetadata = cleanMetadata;
    return;
  }

  try {
    (player as any)._lastAppliedMetadata = cleanMetadata;
    console.log(
      `[LockScreen:METADATA] 🔄 Updating metadata -> "${cleanMetadata.title}" by "${cleanMetadata.artist}" | Artwork: ${cleanMetadata.artworkUrl ? "YES" : "NO"}`
    );

    if (typeof (player as any).updateLockScreenMetadata === "function") {
      (player as any).updateLockScreenMetadata(cleanMetadata);
    } else {
      // Fallback if updateLockScreenMetadata is somehow not available
      player.setActiveForLockScreen(true, cleanMetadata);
    }
  } catch (err) {
    console.warn("[LockScreen:METADATA] ⚠️ Failed to update lock screen metadata:", err);
  }
}


