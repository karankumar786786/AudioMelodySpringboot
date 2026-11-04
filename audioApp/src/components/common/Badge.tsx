import React from "react";
import { View, Text, StyleSheet, ViewStyle, TextStyle } from "react-native";
import { colors, radii, spacing, typography } from "@/theme";

interface BadgeProps {
  label: string;
  icon?: React.ReactNode;
  variant?: "primary" | "surface" | "glass" | "outline";
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function Badge({
  label,
  icon,
  variant = "surface",
  style,
  textStyle,
}: BadgeProps) {
  const getContainerStyle = () => {
    switch (variant) {
      case "primary":
        return styles.primaryContainer;
      case "glass":
        return styles.glassContainer;
      case "outline":
        return styles.outlineContainer;
      case "surface":
      default:
        return styles.surfaceContainer;
    }
  };

  const getTextStyle = () => {
    switch (variant) {
      case "primary":
        return styles.primaryText;
      case "outline":
        return styles.outlineText;
      default:
        return styles.defaultText;
    }
  };

  return (
    <View style={[styles.baseContainer, getContainerStyle(), style]}>
      {icon && <View style={styles.iconWrapper}>{icon}</View>}
      <Text style={[styles.baseText, getTextStyle(), textStyle]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  baseContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
  },
  iconWrapper: {
    marginRight: 4,
  },
  baseText: {
    ...typography.caption,
  },
  surfaceContainer: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  glassContainer: {
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  primaryContainer: {
    backgroundColor: "rgba(29, 185, 84, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(29, 185, 84, 0.35)",
  },
  outlineContainer: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.borderMedium,
  },
  defaultText: {
    color: colors.textSecondary,
  },
  primaryText: {
    color: colors.primary,
    fontWeight: "700",
  },
  outlineText: {
    color: colors.textPrimary,
  },
});

