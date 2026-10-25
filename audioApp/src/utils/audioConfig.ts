import { setAudioModeAsync } from "expo-audio";

/**
 * Configures top exclusive audio priority for One Melody.
 * - `playsInSilentMode: true`: audio continues playing even if phone is on silent/vibrate.
 * - `interruptionMode: 'doNotMix'`: requests  exclusive audio focus (AudioManager.AUDIOFOCUS_GAIN),
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
    });
    isConfigured = true;
    console.log("[AudioPriority] Persistent audio priority configured (doNotMix, silentMode, background)");
  } catch (error) {
    console.warn("[AudioPriority] Failed to configure audio priority:", error);
  }
}

