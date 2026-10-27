import { StyleSheet } from "react-native";

const SIDE = 18;

export const loginStyles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#000000" },
  keyboardView: { flex: 1 },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: SIDE + 6,
    paddingVertical: 24,
  },
  header: { alignItems: "center", marginBottom: 36 },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -0.8,
    color: "#FFFFFF",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#8A8A8A",
    textAlign: "center",
    paddingHorizontal: 20,
    lineHeight: 20,
  },
  form: { marginBottom: 24 },
  inputGroup: { marginBottom: 18 },
  inputLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#151515",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#262626",
    paddingHorizontal: 14,
    height: 54,
  },
  inputContainerFocused: { borderColor: "#FFFFFF" },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, color: "#FFFFFF", fontSize: 15 },
  // Solid white pill, no glow
  primaryButton: {
    backgroundColor: "#FFFFFF",
    height: 54,
    borderRadius: 999,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 6,
  },
  buttonDisabled: { opacity: 0.6 },
  primaryButtonText: {
    color: "#000000",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 12,
  },
  footerText: { color: "#8A8A8A", fontSize: 14 },
  linkText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
});