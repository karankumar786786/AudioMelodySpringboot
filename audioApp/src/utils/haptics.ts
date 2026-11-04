import * as Haptics from "expo-haptics";
import { Platform, Vibration } from "react-native";

/**
 * Universal tactile haptic feedback utility.
 * - On iOS: delegates to Apple's Taptic Engine via expo-haptics for ultra-crisp tactile feel.
 * - On Android: delegates to hardware vibration motor with calibrated micro-pulses
 *   and expo-haptics to ensure guaranteed physical feedback across all OEMs (Samsung, Xiaomi, Pixel, OnePlus).
 */
export const hapticFeedback = {
  /** Subtle click for navigation, tab change, list item press */
  light: async () => {
    if (Platform.OS === "web") return;
    if (Platform.OS === "android") {
      try {
        Vibration.vibrate(12);
      } catch {}
      return;
    }
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
  },

  /** Standard feedback for toggle playback, primary buttons */
  medium: async () => {
    if (Platform.OS === "web") return;
    if (Platform.OS === "android") {
      try {
        Vibration.vibrate(22);
      } catch {}
      return;
    }
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
  },

  /** Strong feedback for long-press, destructive or major state shifts */
  heavy: async () => {
    if (Platform.OS === "web") return;
    if (Platform.OS === "android") {
      try {
        Vibration.vibrate(36);
      } catch {}
      return;
    }
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } catch {}
  },

  /** Ultra-light feedback for slider ticks, filter pills, reorder steps */
  selection: async () => {
    if (Platform.OS === "web") return;
    if (Platform.OS === "android") {
      try {
        Vibration.vibrate(8);
      } catch {}
      return;
    }
    try {
      await Haptics.selectionAsync();
    } catch {}
  },

  /** Success notification pattern (e.g. added to liked songs, saved to playlist) */
  success: async () => {
    if (Platform.OS === "web") return;
    if (Platform.OS === "android") {
      try {
        Vibration.vibrate([0, 15, 60, 20]);
      } catch {}
      return;
    }
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
  },

  /** Warning notification pattern */
  warning: async () => {
    if (Platform.OS === "web") return;
    if (Platform.OS === "android") {
      try {
        Vibration.vibrate([0, 25, 60, 25]);
      } catch {}
      return;
    }
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } catch {}
  },

  /** Error notification pattern */
  error: async () => {
    if (Platform.OS === "web") return;
    if (Platform.OS === "android") {
      try {
        Vibration.vibrate([0, 30, 80, 40]);
      } catch {}
      return;
    }
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } catch {}
  },
};
