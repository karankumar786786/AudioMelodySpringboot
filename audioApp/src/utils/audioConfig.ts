import { Platform } from "react-native";
import {
  setAudioModeAsync,
  setIsAudioActiveAsync,
  AudioPlayer,
  requestNotificationPermissionsAsync,
} from "expo-audio";
import Constants, { ExecutionEnvironment } from "expo-constants";

export const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

/**
 * Configures top exclusive audio priority for One Melody.
 * - `playsInSilentMode: true`: audio continues playing even if phone is on silent/vibrate.
 * - `interruptionMode: 'doNotMixPersistent'`: requests continuous media audio focus (AudioManager.AUDIOFOCUS_GAIN),
 *   yielding focus and pausing when other media apps (YouTube, Spotify, Instagram) or phone calls take focus,
 *   and supporting background playback on lock screen.
 * - `shouldPlayInBackground: true`: audio continues playing in background and lock screen.
 */
let isConfigured = false;

export async function configureAudioPriority(force = false): Promise<void> {
  if (Platform.OS === "web") return;
  if (isConfigured && !force) return;
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
      shouldPlayInBackground: true,
      allowsRecording: true,
      shouldRouteThroughEarpiece: false,
    });
    await setIsAudioActiveAsync(true);
    if (!isConfigured) {
      console.log("[AudioPriority] Audio session initialized (exclusive playback, background active)");
    }
    isConfigured = true;
  } catch (error) {
    console.warn("[AudioPriority] Failed to configure audio priority:", error);
  }
}

/**
 * Safely activates or deactivates lock screen controls on a player.
 * In Expo Go, native config plugins cannot run and AudioControlsService
 * is not declared in Expo Go's AndroidManifest.xml, which causes service binding
 * errors. We guard this call in Expo Go to avoid crashing/error logs while allowing
 * full background playback in development builds and production releases.
 */
export function safeSetActiveForLockScreen(
  player: AudioPlayer | null | undefined,
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
        showSeekForward: true,
        showSeekBackward: true,
        showNextTrack: true,
        showPreviousTrack: true,
        seekForwardIntervalSeconds: 10,
        seekBackwardIntervalSeconds: 10,
        ...(options || {}),
      };

      console.log(
        `[LockScreen:DIAGNOSTIC] 📱 Activating Lock Screen & Control Center -> Title: "${cleanMetadata?.title}" | Artist: "${cleanMetadata?.artist}" | Artwork: ${cleanMetadata?.artworkUrl ? "YES" : "NO"} | ${stateSummary}`
      );

      player.setActiveForLockScreen(active, cleanMetadata, cleanOptions);
    } else {
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


