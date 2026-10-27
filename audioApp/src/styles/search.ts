import { StyleSheet } from "react-native";

export const searchStyles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#000000" },
  scroll: { flex: 1 },

  header: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 10,
  },
  screenTitle: {
    fontSize: 32,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.8,
    marginBottom: 14,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#141414",
    borderRadius: 26,
    paddingHorizontal: 16,
    height: 50,
  },
  searchIcon: { marginRight: 10 },
  searchInput: {
    flex: 1,
    height: "100%",
    color: "#FFFFFF",
    fontSize: 16,
  },
  searchSpinner: { marginRight: 6 },
  clearButton: { padding: 4, marginLeft: 2 },

  section: { marginBottom: 26 },
  padded: { paddingHorizontal: 18 },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 18,
  },
  sectionTitle: {
    fontSize: 21,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.3,
    marginBottom: 12,
  },
  linkText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
    textDecorationLine: "underline",
    marginBottom: 12,
  },

  genresGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    paddingHorizontal: 18,
  },
  horizontalRow: { paddingHorizontal: 18 },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 36,
  },
  noResultsTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
    marginTop: 16,
    textAlign: "center",
  },
  noResultsText: {
    fontSize: 14,
    color: "#8A8A8A",
    marginTop: 8,
    textAlign: "center",
    lineHeight: 20,
  },

  userPlaylistRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  userPlaylistInfo: { flex: 1 },
  userPlaylistName: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 3,
  },
  userPlaylistMeta: { color: "#8A8A8A", fontSize: 12.5 },
});