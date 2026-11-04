import React from "react";
import { Text, TextProps, StyleSheet } from "react-native";
import { colors, typography } from "@/theme";

export interface ThemedTextProps extends TextProps {
  variant?: keyof typeof typography;
  color?: string;
}

export function ThemedText({
  variant = "body1",
  color = colors.textPrimary,
  style,
  children,
  ...props
}: ThemedTextProps) {
  return (
    <Text
      style={[
        typography[variant],
        { color },
        style,
      ]}
      {...props}
    >
      {children}
    </Text>
  );
}

