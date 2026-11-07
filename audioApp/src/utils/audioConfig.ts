import { Platform, AppState } from "react-native";
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
 * - `interruptionMode: 'doNotMix'`: requests exclusive audio focus.
 * - `shouldPlayInBackground: true`: audio continues playing in background and lock screen.
 *
 * `force = true` re-applies the session config even if it was already applied.
 * Use it whenever something else (e.g. an expo-video canvas player) may have
 * changed the shared iOS AVAudioSession category options behind our back.
 */
let isConfigured = false;
let permissionRequested = false;
let configuringPromise: Promise<void> | null = null;

export async function configureAudioPriority(force = false): Promise<void> {
  if (Platform.OS === "web") return;
  if (!force && isConfigured) return;
  // iOS rejects re-activating the non-mixable session while the app is not in the
  // foreground (OSStatus 560557684 '!int'). It can never succeed there, so skip
  // the forced re-apply instead of failing; the foreground re-assert handles it.
  if (force && isConfigured && AppState.currentState !== "active") return;
  if (configuringPromise) return configuringPromise;

  configuringPromise = (async () => {
    try {
      if (Platform.OS === "android" && !isExpoGo && !permissionRequested) {
        permissionRequested = true;
        try {
          await requestNotificationPermissionsAsync();
        } catch (err) {
          console.log("[AudioPriority] Notification permission request error:", err);
        }
      }

      await setAudioModeAsync({
        playsInSilentMode: true,
        interruptionMode: "doNotMixPersistent",
        interruptionModeAndroid: "doNotMix",
        shouldPlayInBackground: true,
        allowsRecording: false,
        shouldRouteThroughEarpiece: false,
      });
      await setIsAudioActiveAsync(true);
      if (!isConfigured) {
        console.log("[AudioPriority] Audio session initialized (exclusive audio focus, background active)");
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

type LockMeta = {
  title?: string;
  artist?: string;
  albumTitle?: string;
  artworkUrl?: string;
};

function cleanMeta(metadata?: LockMeta) {
  if (!metadata) return undefined;
  return {
    title: metadata.title || "One Melody",
    artist: metadata.artist || "Unknown Artist",
    albumTitle: metadata.albumTitle || "One Melody",
    artworkUrl:
      typeof metadata.artworkUrl === "string" &&
      metadata.artworkUrl.startsWith("http")
        ? metadata.artworkUrl
        : undefined,
  };
}

/**
 * Safely activates or deactivates lock screen controls on a player.
 *
 * - First activation: calls `setActiveForLockScreen(true, ...)`.
 * - Already active: only updates metadata in place (re-activating on Android
 *   rebuilds the MediaSession / foreground service).
 * - `force = true` (iOS only): re-calls `setActiveForLockScreen(true, ...)` even
 *   when already active. This re-registers Now Playing + remote commands after
 *   iOS dropped them (audio session category changed by another player, app
 *   returned from background, etc).
 *
 * The "active" flag is only set AFTER the native call succeeded, so a failed
 * native call can be retried instead of being silently skipped forever.
 */
export function safeSetActiveForLockScreen(
  player: AudioPlayer | AudioPlaylist | null | undefined,
  active: boolean,
  metadata?: any,
  options?: any,
  force = false,
  hardClear = false
): void {
  if (!player) {
    console.warn("[LockScreen] Cannot configure lock screen: player is null or undefined");
    return;
  }

  // Expo Go on Android lacks AudioControlsService in its manifest
  if (Platform.OS === "android" && isExpoGo) {
    return;
  }

  try {
    if (active) {
      const alreadyActive = Boolean((player as any)._isLockScreenActive);
      const reactivate = force && Platform.OS === "ios";

      if (alreadyActive && !reactivate) {
        safeUpdateLockScreenMetadata(player, metadata);
        return;
      }

      const meta = cleanMeta(metadata);
      const cleanOptions = {
        showSeekForward: false,
        showSeekBackward: false,
        showNextTrack: true,
        showPreviousTrack: true,
        seekForwardIntervalSeconds: 10,
        seekBackwardIntervalSeconds: 10,
        ...(options || {}),
      };

      player.setActiveForLockScreen(true, meta, cleanOptions);

      // Only mark active after the native call went through
      (player as any)._isLockScreenActive = true;
      (player as any)._lastAppliedMetadata = meta;
      (player as any)._lastLockScreenOptions = cleanOptions;
    } else {
      (player as any)._isLockScreenActive = false;
      (player as any)._lastAppliedMetadata = undefined;

      // iOS: MediaController is a singleton. Activating a new player already
      // deactivates the previous one, and a native "clear" from an old player can
      // race with that and wipe the NEW player's Now Playing / remote commands
      // (lock screen player disappearing on song change). So on iOS we only reset
      // our JS flags, unless a full stop explicitly asks for a hard clear.
      if (Platform.OS === "ios" && !hardClear) {
        return;
      }

      if (typeof (player as any).clearLockScreenControls === "function") {
        (player as any).clearLockScreenControls();
      } else {
        player.setActiveForLockScreen(false);
      }
    }
  } catch (err) {
    // Leave the flag false on activation failure so the next call retries
    if (active) (player as any)._isLockScreenActive = false;
    console.error("[LockScreen] Exception in setActiveForLockScreen:", err);
  }
}

/**
 * Safely updates lock screen metadata (title, artist, album, artwork) on an
 * active player without tearing down the MediaSession / Now Playing session.
 */
export function safeUpdateLockScreenMetadata(
  player: AudioPlayer | AudioPlaylist | null | undefined,
  metadata?: LockMeta
): void {
  if (!player) return;
  if (Platform.OS === "android" && isExpoGo) return;

  const meta = cleanMeta(metadata);
  if (!meta) return;

  // Not active yet -> activate (this also records the metadata)
  if (!(player as any)._isLockScreenActive) {
    safeSetActiveForLockScreen(player, true, meta, (player as any)._lastLockScreenOptions);
    return;
  }

  const last = (player as any)._lastAppliedMetadata;
  if (
    last &&
    last.title === meta.title &&
    last.artist === meta.artist &&
    last.albumTitle === meta.albumTitle &&
    last.artworkUrl === meta.artworkUrl
  ) {
    return;
  }

  try {
    if (typeof (player as any).updateLockScreenMetadata === "function") {
      (player as any).updateLockScreenMetadata(meta);
    } else {
      player.setActiveForLockScreen(true, meta);
    }
    (player as any)._lastAppliedMetadata = meta;
  } catch (err) {
    console.warn("[LockScreen] Failed to update lock screen metadata:", err);
  }
}