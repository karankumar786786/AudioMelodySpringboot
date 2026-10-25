import { setAudioModeAsync } from "expo-audio";

/**
 * Configures top exclusive audio priority for One Melody.
 * - `playsInSilentMode: true`: audio continues playing even if phone is on silent/vibrate.
 * - `interruptionMode: 'doNotMixPersistent'`: requests persistent exclusive audio focus (AudioManager.AUDIOFOCUS_GAIN),
 *   pausing for incoming calls / navigation / notifications, and automatically resuming in earphones/speakers when the interruption ends.
 * - `shouldPlayInBackground: true`: audio continues playing in background and lock screen.
 */
export async function configureAudioPriority(): Promise<void> {
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: "doNotMix",
      shouldPlayInBackground: true,
    });
    console.log("[AudioPriority] Persistent audio priority configured (doNotMixPersistent, silentMode, background)");
  } catch (error) {
    console.warn("[AudioPriority] Failed to configure audio priority:", error);
  }
}
