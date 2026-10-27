import { StyleSheet, Dimensions } from "react-native";
const SIDE = 18;

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const HERO_HEIGHT = 480;

export const artistDetailStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000000" },
  floatingNav: {
    position: "absolute",
    left: SIDE,
    right: SIDE,
    zIndex: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  floatingButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.14)",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#000000",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: { color: "#8A8A8A", fontSize: 14, marginTop: 12 },
  listContent: { paddingTop: 0, paddingBottom: 40 },
  headerContainer: { marginBottom: 8 },
  heroImageWrapper: {
    width: SCREEN_WIDTH,
    height: HERO_HEIGHT,
    position: "relative",
    backgroundColor: "#151515",
  },
  heroImage: { width: "100%", height: "100%" },
  fallbackHero: {
    width: "100%",
    height: "100%",
    backgroundColor: "#151515",
    justifyContent: "center",
    alignItems: "center",
  },

  heroTextContainer: {
    position: "absolute",
    bottom: 18,
    left: SIDE,
    right: SIDE,
  },
  verifiedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  verifiedText: { color: "#FFFFFF", fontSize: 12, fontWeight: "600" },
  artistName: {
    color: "#FFFFFF",
    fontSize: 38,
    fontWeight: "800",
    letterSpacing: -1,
    lineHeight: 42,
  },
  followersText: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 13,
    fontWeight: "500",
    marginTop: 6,
  },
  heroActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 16,
  },
  followButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#FFFFFF",
    backgroundColor: "#FFFFFF",
  },
  followingButton: {
    borderColor: "#262626",
    backgroundColor: "#151515",
  },
  followButtonText: { color: "#000000", fontSize: 13, fontWeight: "700" },
  followingButtonText: { color: "#FFFFFF" },
  playButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: "auto",
  },

  sectionHeadingRow: {
    paddingHorizontal: SIDE,
    paddingTop: 16,
    paddingBottom: 6,
  },
  sectionHeading: {
    color: "#FFFFFF",
    fontSize: 21,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  footerContainer: { paddingVertical: 16, paddingHorizontal: SIDE },
  footerLoader: { paddingVertical: 16, alignItems: "center" },
  emptyContainer: { paddingVertical: 40, alignItems: "center" },
  emptyText: { color: "#5A5A5A", fontSize: 14, marginTop: 10 },
  songsLoadingContainer: { paddingVertical: 32, alignItems: "center" },
});