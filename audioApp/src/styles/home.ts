import { StyleSheet } from "react-native";
import { colors, radius, spacing } from "@/theme";

export const homeStyles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0A0A0A",
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: spacing.xs,
    paddingBottom: 14,
  },
  headerGreetingCol: {
    flex: 1,
    marginRight: spacing.md,
  },
  greetingSubtitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#8E8E93",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  greeting: {
    fontSize: 24,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.4,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  shortsHeaderBtn: {
    borderRadius: radius.full,
    overflow: "hidden",
  },
  shortsHeaderGradient: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  shortsHeaderText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#1E1E1E",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },

  pillsScrollView: {
    maxHeight: 46,
    marginBottom: 16,
  },
  pillsRow: {
    paddingHorizontal: 18,
    gap: 8,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: radius.full,
    backgroundColor: "#1A1A1A",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  pillActive: {
    backgroundColor: "#FFFFFF",
    borderColor: "#FFFFFF",
  },
  pillText: {
    color: "#A0A0A0",
    fontSize: 13,
    fontWeight: "600",
  },
  pillTextActive: {
    color: "#000000",
    fontWeight: "700",
  },

  section: {
    marginBottom: 8,
  },
  horizontalList: {
    paddingHorizontal: 18,
  },
  verticalList: {
    paddingHorizontal: 0,
    gap: 2,
  },
  exploreList: {
    paddingHorizontal: 0,
    gap: 2,
  },

  footer: {
    alignItems: "center",
    paddingVertical: 24,
  },
  endText: {
    color: "#666666",
    fontSize: 13,
    fontWeight: "500",
  },
});
