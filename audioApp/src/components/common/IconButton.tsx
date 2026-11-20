import React from "react";
import {
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  GestureResponderEvent,
  AccessibilityRole,
  AccessibilityState,
} from "react-native";
import { hapticFeedback } from "@/utils/haptics";
import { colors, radii } from "@/theme";

interface IconButtonProps {
  onPress: (e: GestureResponderEvent) => void;
  icon: React.ReactNode;
  /**
   * Required: an icon has no text for screen readers to announce, so say what
   * the button does ("Close", "Play", "Add to favourites").
   */
  accessibilityLabel: string;
  accessibilityHint?: string;
  /** Defaults to "button". Use "togglebutton" with accessibilityState.checked for toggles. */
  accessibilityRole?: AccessibilityRole;
  accessibilityState?: AccessibilityState;
  size?: number;
  haptic?: "light" | "medium" | "heavy" | "selection" | "none";
  style?: ViewStyle;
  activeOpacity?: number;
  hitSlop?: number;
  disabled?: boolean;
}

export function IconButton({
  onPress,
  icon,
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole = "button",
  accessibilityState,
  size = 40,
  haptic = "light",
  style,
  activeOpacity = 0.7,
  hitSlop = 8,
  disabled,
}: IconButtonProps) {
  const handlePress = (e: GestureResponderEvent) => {
    if (haptic !== "none") {
      hapticFeedback[haptic]();
    }
    onPress(e);
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={activeOpacity}
      hitSlop={{ top: hitSlop, bottom: hitSlop, left: hitSlop, right: hitSlop }}
      disabled={disabled}
      accessible
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityRole={accessibilityRole}
      accessibilityState={{ disabled: !!disabled, ...accessibilityState }}
      style={[
        styles.button,
        { width: size, height: size, borderRadius: size / 2 },
        style,
      ]}
    >
      {icon}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    justifyContent: "center",
  },
});
