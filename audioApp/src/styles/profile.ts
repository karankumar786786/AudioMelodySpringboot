import { StyleSheet } from "react-native";
const C = {
  black: "#000000",
  white: "#FFFFFF",
  line: "#1F1F1F",
  muted: "#8A8A8A",
  dim: "#5A5A5A",
  field: "#141414",
};

export const profileStyles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: C.black },
  container: { paddingHorizontal: 20, backgroundColor: C.black },
  center: {
    flex: 1,
    backgroundColor: C.black,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },

  /* Header */
  header: { alignItems: "center", paddingTop: 28, paddingBottom: 24 },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: C.white,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  avatarText: { fontSize: 40, fontWeight: "700", color: C.black },
  name: { fontSize: 24, fontWeight: "700", color: C.white, marginBottom: 4 },
  email: { fontSize: 14, color: C.muted, marginBottom: 18 },

  /* Buttons */
  outlineButton: {
    paddingHorizontal: 22,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.white,
  },
  outlineButtonText: { color: C.white, fontSize: 14, fontWeight: "600" },
  solidButton: {
    height: 52,
    borderRadius: 26,
    backgroundColor: C.white,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  solidButtonText: { color: C.black, fontSize: 16, fontWeight: "700" },
  disabled: { opacity: 0.4 },

  /* Stats */
  stats: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 18,
    marginBottom: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: C.line,
  },
  stat: { flex: 1, alignItems: "center" },
  statNumber: { fontSize: 22, fontWeight: "700", color: C.white, marginBottom: 2 },
  statLabel: { fontSize: 13, color: C.muted },
  statDivider: { width: 1, height: 32, backgroundColor: C.line },

  /* Sections */
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: C.white,
    marginTop: 24,
    marginBottom: 6,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  link: { color: C.white, fontSize: 13, fontWeight: "600", marginBottom: 6 },

  /* Rows */
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
    gap: 16,
  },
  noBorder: { borderBottomWidth: 0 },
  rowLabel: { fontSize: 15, color: C.muted },
  rowValue: { flex: 1, textAlign: "right", fontSize: 15, color: C.white, fontWeight: "500" },

  /* Devices */
  deviceRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
    gap: 14,
  },
  deviceInfo: { flex: 1 },
  deviceName: { fontSize: 15, color: C.white, fontWeight: "600", marginBottom: 2 },
  deviceMeta: { fontSize: 12, color: C.muted },
  empty: { color: C.dim, fontSize: 14, paddingVertical: 16 },

  logout: { marginTop: 36 },

  /* Error */
  errorTitle: { fontSize: 18, fontWeight: "700", color: C.white, marginTop: 14, marginBottom: 6 },
  errorText: { fontSize: 14, color: C.muted, textAlign: "center", marginBottom: 24 },

  /* Bottom sheet */
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.7)" },
  backdropTouch: { flex: 1 },
  sheet: {
    backgroundColor: "#0D0D0D",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: "#262626",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 32,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#333333",
    marginBottom: 18,
  },
  sheetTitle: { fontSize: 20, fontWeight: "700", color: C.white, marginBottom: 16 },
  input: {
    height: 52,
    borderRadius: 14,
    backgroundColor: C.field,
    paddingHorizontal: 16,
    color: C.white,
    fontSize: 16,
    marginBottom: 16,
  },
});