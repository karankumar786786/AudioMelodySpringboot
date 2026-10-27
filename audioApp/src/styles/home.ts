import { StyleSheet } from "react-native";
const SIDE = 18;
const GRID_GAP = 8;
export const homeStyles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#000000" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SIDE,
    paddingTop: 10,
    paddingBottom: 14,
  },
  greeting: {
    flex: 1,
    marginRight: 12,
    fontSize: 26,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.6,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#000000", fontSize: 16, fontWeight: "700" },

  pillsRow: {
    paddingHorizontal: SIDE,
    paddingBottom: 18,
    gap: 8,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#151515",
    borderWidth: 1,
    borderColor: "#262626",
  },
  pillActive: { backgroundColor: "#FFFFFF", borderColor: "#FFFFFF" },
  pillText: { color: "#FFFFFF", fontSize: 13, fontWeight: "600" },
  pillTextActive: { color: "#000000", fontWeight: "700" },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: GRID_GAP,
    paddingHorizontal: SIDE,
    marginBottom: 8,
  },

  section: { marginTop: 22 },
  sectionTitle: {
    fontSize: 21,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.3,
    paddingHorizontal: SIDE,
    marginBottom: 12,
  },
  horizontalList: { paddingHorizontal: SIDE },

  footer: { alignItems: "center", paddingVertical: 24 },
  endText: { color: "#5A5A5A", fontSize: 13 },
});