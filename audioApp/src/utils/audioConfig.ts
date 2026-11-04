import { Platform } from "react-native";
import { setAudioModeAsync, setIsAudioActiveAsync, AudioPlayer } from "expo-audio";
import Constants, { ExecutionEnvironment } from "expo-constants";

export const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

/**
 * Configures top exclusive audio priority for One Melody.
 * - `playsInSilentMode: true`: audio continues playing even if phone is on silent/vibrate.
 * - `interruptionMode: 'doNotMix'`: requests exclusive audio focus (AudioManager.AUDIOFOCUS_GAIN),
 *   pausing for incoming calls / navigation / notifications, and automatically resuming in earphones/speakers when the interruption ends.
 * - `shouldPlayInBackground: true`: audio continues playing in background and lock screen.
 */
let isConfigured = false;

export async function configureAudioPriority(force = false): Promise<void> {
  if (Platform.OS === "web") return;
  if (isConfigured && !force) return;
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: "doNotMix",
      shouldPlayInBackground: true,
      allowsRecording: false,
      shouldRouteThroughEarpiece: false,
    });
    await setIsAudioActiveAsync(true);
    isConfigured = true;
    console.log("[AudioPriority] Persistent audio priority configured (doNotMix, silentMode, background)");
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
  if (!player) return;

  // On Android only: Expo Go lacks AudioControlsService in its manifest
  if (Platform.OS === "android" && isExpoGo) {
    console.log("[LockScreen] Skipped on Android Expo Go to avoid missing manifest service");
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
        showSeekForward: false,
        showSeekBackward: false,
        showNextTrack: true,
        showPreviousTrack: true,
        seekForwardIntervalSeconds: 10,
        seekBackwardIntervalSeconds: 10,
        ...(options || {}),
      };

      player.setActiveForLockScreen(active, cleanMetadata, cleanOptions);
      console.log(`[LockScreen] Active on lock screen / Control Center for: "${cleanMetadata?.title}"`);
    } else {
      if (typeof (player as any).clearLockScreenControls === "function") {
        (player as any).clearLockScreenControls();
      } else {
        player.setActiveForLockScreen(false);
      }
      console.log("[LockScreen] Deactivated lock screen controls");
    }
  } catch (err) {
    console.warn("[LockScreen] Safe lock screen update error:", err);
  }
}


