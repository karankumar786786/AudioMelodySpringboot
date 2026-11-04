/**
 * AudioMelody Design System Tokens
 * Standardized palette, typography, spacing, and radius scales.
 */

export const colors = {
  // Backdrops & Surfaces
  background: "#000000",
  surface: "#121212",
  surfaceElevated: "#181818",
  card: "#181818",
  cardHover: "#222222",
  cardHighlight: "#282828",

  // Glass & Overlays
  glass: "rgba(24, 24, 24, 0.75)",
  glassBorder: "rgba(255, 255, 255, 0.08)",
  glassBorderHover: "rgba(255, 255, 255, 0.16)",
  overlay: "rgba(0, 0, 0, 0.6)",
  modalBackdrop: "rgba(0, 0, 0, 0.8)",

  // Brand & Accents
  primary: "#1DB954",
  primaryGlow: "rgba(29, 185, 84, 0.25)",
  primaryHover: "#1ED760",
  like: "#FF3B30",
  likeGlow: "rgba(255, 59, 48, 0.25)",

  // Typography
  textPrimary: "#FFFFFF",
  textSecondary: "#A1A1AA",
  textMuted: "#71717A",
  textDisabled: "#3F3F46",

  // Borders & Dividers
  borderSubtle: "rgba(255, 255, 255, 0.08)",
  borderMedium: "rgba(255, 255, 255, 0.14)",
  divider: "rgba(255, 255, 255, 0.06)",

  // Status
  error: "#EF4444",
  warning: "#F59E0B",
  success: "#10B981",
  info: "#3B82F6",
} as const;

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  section: 32,
  side: 18,
} as const;

export const radii = {
  xs: 4,
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  xxl: 24,
  full: 9999,
} as const;

export const typography = {
  hero: {
    fontSize: 32,
    fontWeight: "800" as const,
    letterSpacing: -0.6,
  },
  headline: {
    fontSize: 24,
    fontWeight: "700" as const,
    letterSpacing: -0.4,
  },
  title1: {
    fontSize: 18,
    fontWeight: "700" as const,
    letterSpacing: -0.2,
  },
  title2: {
    fontSize: 16,
    fontWeight: "600" as const,
    letterSpacing: -0.1,
  },
  body1: {
    fontSize: 14,
    fontWeight: "600" as const,
  },
  body2: {
    fontSize: 13,
    fontWeight: "400" as const,
  },
  caption: {
    fontSize: 11,
    fontWeight: "500" as const,
    letterSpacing: 0.2,
  },
  micro: {
    fontSize: 10,
    fontWeight: "600" as const,
    letterSpacing: 0.4,
  },
} as const;

export const shadows = {
  sm: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 2,
  },
  md: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  lg: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  primaryGlow: {
    shadowColor: "#1DB954",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
} as const;
