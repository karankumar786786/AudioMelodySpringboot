import { StyleSheet } from "react-native";

const SIDE = 18;

export const lyricsStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000000" },
  ambientImage: {
    ...StyleSheet.absoluteFill,
    opacity: 0.6,
    transform: [{ scale: 1.15 }],
  },
  container: { flex: 1, justifyContent: "space-between" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SIDE,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.14)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitleGroup: { flex: 1, alignItems: "center", paddingHorizontal: 12 },
  headerTrackTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  headerArtist: { color: "rgba(255, 255, 255, 0.6)", fontSize: 12, marginTop: 2 },

  lyricsBody: { flex: 1, position: "relative" },
  scrollList: { paddingHorizontal: SIDE + 4 },
  lyricLineContainer: { paddingVertical: 12 },
  // Inactive lines recede; the active line is solid white. No glow.
  lyricLineText: {
    color: "rgba(255, 255, 255, 0.38)",
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.6,
    lineHeight: 33,
  },
  lyricLineTextPast: { color: "rgba(255, 255, 255, 0.5)" },
  lyricLineTextActive: { color: "#FFFFFF" },
  plainLyricsText: {
    color: "rgba(255, 255, 255, 0.82)",
    fontSize: 20,
    lineHeight: 32,
    fontWeight: "600",
    letterSpacing: -0.2,
    textAlign: "left",
  },

  centerState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  loadingText: { color: "#8A8A8A", fontSize: 15, marginTop: 16, fontWeight: "500" },
  emptyTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.4,
    marginTop: 16,
  },
  emptySubtitle: {
    color: "#8A8A8A",
    fontSize: 14,
    marginTop: 6,
    textAlign: "center",
  },

  // White pill, same as the active filter pill on Home
  floatingSyncBtn: {
    position: "absolute",
    bottom: 16,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
  },
  floatingSyncText: { color: "#000000", fontSize: 13, fontWeight: "700" },

  playbackDock: {
    backgroundColor: "#000000",
    borderTopWidth: 1,
    borderTopColor: "#262626",
    paddingTop: 12,
    paddingBottom: 16,
    paddingHorizontal: SIDE,
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 8,
  },
  dockTimeText: {
    color: "#8A8A8A",
    fontSize: 11,
    fontVariant: ["tabular-nums"],
    width: 38,
    textAlign: "center",
  },
  dockTrack: {
    flex: 1,
    height: 4,
    backgroundColor: "#262626",
    borderRadius: 2,
    overflow: "hidden",
  },
  dockFill: { height: "100%", backgroundColor: "#FFFFFF" },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 36,
  },
  dockIconBtn: { padding: 8 },
  dockPlayBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },
});