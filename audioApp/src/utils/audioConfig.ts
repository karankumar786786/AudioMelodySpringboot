import { setAudioModeAsync, setIsAudioActiveAsync, AudioPlayer } from "expo-audio";
import Constants, { AppOwnership } from "expo-constants";

export const isExpoGo =
  Constants.appOwnership === AppOwnership.Expo ||
  Constants.appOwnership === "expo";

/**
 * Configures top exclusive audio priority for One Melody.
 * - `playsInSilentMode: true`: audio continues playing even if phone is on silent/vibrate.
 * - `interruptionMode: 'doNotMix'`: requests exclusive audio focus (AudioManager.AUDIOFOCUS_GAIN),
 *   pausing for incoming calls / navigation / notifications, and automatically resuming in earphones/speakers when the interruption ends.
 * - `shouldPlayInBackground: true`: audio continues playing in background and lock screen.
 */
let isConfigured = false;

export async function configureAudioPriority(force = false): Promise<void> {
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

  if (isExpoGo) {
    return;
  }

  try {
    if (active) {
      player.setActiveForLockScreen(active, metadata, options);
    } else {
      if (typeof (player as any).clearLockScreenControls === "function") {
        (player as any).clearLockScreenControls();
      } else {
        player.setActiveForLockScreen(false);
      }
    }
  } catch (err) {
    console.log("[LockScreen] Safe lock screen update note:", err);
  }
}


