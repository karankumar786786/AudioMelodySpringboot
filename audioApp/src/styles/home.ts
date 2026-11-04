import { StyleSheet } from "react-native";
import { colors, radius, spacing, typography } from "@/theme";

export const homeStyles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.side,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
  },
  headerGreetingCol: {
    flex: 1,
    marginRight: spacing.md,
  },
  greetingSubtitle: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  greeting: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  headerIconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "700",
  },

  pillsScrollView: {
    maxHeight: 50,
  },
  pillsRow: {
    paddingHorizontal: spacing.side,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  pillActive: {
    backgroundColor: "#FFFFFF",
    borderColor: "#FFFFFF",
  },
  pillText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "600",
  },
  pillTextActive: {
    color: "#000000",
    fontWeight: "700",
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: spacing.side,
    marginBottom: spacing.sm,
  },

  section: {
    marginTop: spacing.md,
  },
  horizontalList: {
    paddingHorizontal: spacing.side,
  },

  exploreList: {
    paddingHorizontal: 0,
    gap: 2,
  },

  footer: {
    alignItems: "center",
    paddingVertical: spacing.xl,
  },
  endText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "500",
  },
});
