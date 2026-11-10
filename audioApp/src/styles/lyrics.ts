import { StyleSheet, Dimensions } from "react-native";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SIDE = 18;

export const lyricsStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000000" },
  ambientImage: {
    ...StyleSheet.absoluteFill,
    opacity: 0.65,
    transform: [{ scale: 1.2 }],
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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitleGroup: { flex: 1, alignItems: "center", paddingHorizontal: 12 },
  headerSubtitleLabel: {
    color: "rgba(255, 255, 255, 0.45)",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  headerTrackTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  headerArtist: { color: "rgba(255, 255, 255, 0.65)", fontSize: 13, marginTop: 2 },

  lyricsBody: { flex: 1, position: "relative" },
  scrollList: { paddingHorizontal: SIDE + 6 },
  lyricLineContainer: {
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderRadius: 12,
  },
  // Inactive lines recede; the active line is prominent pure white with bold presence
  lyricLineText: {
    color: "rgba(255, 255, 255, 0.32)",
    fontSize: 27,
    fontWeight: "800",
    letterSpacing: -0.5,
    lineHeight: 38,
  },
  lyricLineTextPast: {
    color: "rgba(255, 255, 255, 0.52)",
  },
  lyricLineTextActive: {
    color: "#FFFFFF",
    fontSize: 29,
    lineHeight: 40,
  },
  activeIndicatorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  activePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#FFFFFF",
  },
  plainLyricsText: {
    color: "rgba(255, 255, 255, 0.88)",
    fontSize: 21,
    lineHeight: 34,
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

  // Floating Sync Pill Button
  floatingSyncBtn: {
    position: "absolute",
    bottom: 20,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    elevation: 8,
  },
  floatingSyncText: { color: "#000000", fontSize: 13, fontWeight: "800" },

  // Full-width Bottom Playback Dock
  playbackDock: {
    width: "100%",
    paddingTop: 14,
    paddingHorizontal: 20,
    borderWidth: 0,
    borderColor: "transparent",
    backgroundColor: "transparent",
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 10,
  },
  dockTimeText: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 11,
    fontVariant: ["tabular-nums"],
    width: 38,
    textAlign: "center",
  },
  dockTrackTouchArea: {
    flex: 1,
    paddingVertical: 8,
    justifyContent: "center",
  },
  dockTrack: {
    height: 4,
    backgroundColor: "rgba(255, 255, 255, 0.16)",
    borderRadius: 2,
    overflow: "hidden",
  },
  dockTrackActive: {
    height: 6,
    borderRadius: 3,
  },
  dockFill: {
    height: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 2,
  },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 38,
  },
  dockIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    justifyContent: "center",
    alignItems: "center",
  },
  dockPlayBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
  },
});
