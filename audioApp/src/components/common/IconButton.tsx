import React from "react";
import {
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  GestureResponderEvent,
} from "react-native";
import { hapticFeedback } from "@/utils/haptics";
import { colors, radii } from "@/theme";

interface IconButtonProps {
  onPress: (e: GestureResponderEvent) => void;
  icon: React.ReactNode;
  size?: number;
  haptic?: "light" | "medium" | "heavy" | "selection" | "none";
  style?: ViewStyle;
  activeOpacity?: number;
  hitSlop?: number;
  accessibilityLabel?: string;
}

export function IconButton({
  onPress,
  icon,
  size = 40,
  haptic = "light",
  style,
  activeOpacity = 0.7,
  hitSlop = 8,
  accessibilityLabel,
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
      accessibilityLabel={accessibilityLabel}
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

