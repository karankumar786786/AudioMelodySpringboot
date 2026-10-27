import { StyleSheet } from "react-native";


const HERO_HEIGHT = 440;

export const playlistDetailStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000000" },
  centerContainer: {
    flex: 1,
    backgroundColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
  },

  /* Hero */
  hero: {
    width: "100%",
    height: HERO_HEIGHT,
    backgroundColor: "#000000",
    overflow: "hidden",
    marginBottom: 6,
  },
  heroContent: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 18,
    paddingBottom: 18,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 6,
  },
  title: {
    flex: 1,
    fontSize: 30,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.8,
    textShadowColor: "rgba(0, 0, 0, 0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  description: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.78)",
    lineHeight: 20,
    marginBottom: 8,
  },
  meta: {
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.7)",
  },
  playButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  /* Floating nav */
  floatingNav: {
    position: "absolute",
    left: 12,
    right: 12,
    zIndex: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  floatingButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    alignItems: "center",
    justifyContent: "center",
  },

  /* States */
  empty: { alignItems: "center", paddingTop: 40, paddingHorizontal: 32 },
  emptyText: { color: "#8A8A8A", fontSize: 14, marginTop: 12 },
  songsLoading: { paddingVertical: 32, alignItems: "center" },
  footerLoader: { paddingVertical: 20, alignItems: "center" },
});