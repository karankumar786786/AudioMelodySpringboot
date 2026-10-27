import { StyleSheet } from "react-native";

export const userPlaylistDetailStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000000" },
  centerContainer: {
    flex: 1,
    backgroundColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
  },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingBottom: 6,
    backgroundColor: "#000000",
  },
  topBarActions: { flexDirection: "row", alignItems: "center" },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },

  header: { paddingTop: 8, paddingBottom: 18 },
  coverWrap: { alignItems: "center", marginBottom: 24 },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    gap: 16,
  },
  titleText: { flex: 1 },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.7,
    marginBottom: 5,
  },
  metaRow: { flexDirection: "row", alignItems: "center" },
  meta: { fontSize: 13, color: "#8A8A8A", flexShrink: 1 },
  playButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  empty: { alignItems: "center", paddingTop: 40, paddingHorizontal: 32 },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
    marginTop: 14,
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 14,
    color: "#8A8A8A",
    textAlign: "center",
    lineHeight: 20,
  },
  songsLoading: { paddingVertical: 32, alignItems: "center" },
  footerLoader: { paddingVertical: 20, alignItems: "center" },
});