import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

export const hapticFeedback = {
  light: async () => {
    if (Platform.OS === "web") return;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
  },
  medium: async () => {
    if (Platform.OS === "web") return;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
  },
  heavy: async () => {
    if (Platform.OS === "web") return;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } catch {}
  },
  selection: async () => {
    if (Platform.OS === "web") return;
    try {
      await Haptics.selectionAsync();
    } catch {}
  },
  success: async () => {
    if (Platform.OS === "web") return;
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
  },
  warning: async () => {
    if (Platform.OS === "web") return;
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } catch {}
  },
  error: async () => {
    if (Platform.OS === "web") return;
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } catch {}
  },
};
