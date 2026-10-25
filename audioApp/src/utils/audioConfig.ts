import { setAudioModeAsync } from "expo-audio";

/**
 * Configures top exclusive audio priority for One Melody.
 * - `playsInSilentMode: true`: audio continues playing even if phone is on silent/vibrate.
 * - `interruptionMode: 'doNotMix'`: requests exclusive audio focus, pausing/suppressing other apps or connected device audio.
 * - `shouldPlayInBackground: true`: audio continues playing in background and lock screen.
 */
export async function configureAudioPriority(): Promise<void> {
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: "doNotMix",
      shouldPlayInBackground: true,
    });
    console.log("[AudioPriority] Exclusive audio priority configured (doNotMix, silentMode, background)");
  } catch (error) {
    console.warn("[AudioPriority] Failed to configure audio priority:", error);
  }
}
