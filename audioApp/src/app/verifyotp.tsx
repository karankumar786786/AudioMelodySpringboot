import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";
import { useRouter } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { authService } from "@/service";
import { AppDispatch, AppState, saveAuthToken, setTempToken } from "@/store";
import { ResendOtpResponse, VerifyOtpResponse } from "@/types";

// Shared with the home screen
const SIDE = 18;

export default function VerifyOtpScreen() {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const [otp, setOtp] = useState<string>("");
  const [isFocused, setIsFocused] = useState(true); // the input autofocuses

  const deviceId = useSelector((state: AppState) => state.device.deviceId);
  const tempToken = useSelector((state: AppState) => state.tempToken.tempToken);

  const resendOtpMutation = useMutation({
    mutationKey: ["resend-otp"],
    mutationFn: authService.resendOtp,
    onSuccess: (response: ResendOtpResponse) => {
      dispatch(setTempToken(response.tempToken));
      Alert.alert("Success", "A new OTP has been sent to your email.");
    },
    onError: (error: any) => {
      const msg =
        error?.response?.data?.message ||
        "Failed to resend OTP. Please try again.";
      Alert.alert("Resend Failed", msg);
      console.error("Resend OTP error:", error);
    },
  });

  const verifyOtpMutation = useMutation({
    mutationKey: ["verifyOtp"],
    mutationFn: authService.verifyOtp,
    onSuccess: (response: VerifyOtpResponse) => {
      dispatch(saveAuthToken(response));
      router.replace("/(authenticated)/(tabs)/home");
    },
    onError: (error: any) => {
      const msg =
        error?.response?.data?.message ||
        "Verification failed. Please check the code and try again.";
      Alert.alert("Verification Failed", msg);
      console.error("Verify OTP error:", error);
    },
  });

  function handleResendOtp() {
    if (!tempToken) {
      Alert.alert("Session Expired", "Please log in again.");
      router.replace("/login");
      return;
    }
    resendOtpMutation.mutate({ tempToken });
  }

  function handleVerifyOtp() {
    const trimmedOtp = otp.trim();
    if (trimmedOtp.length !== 6) {
      Alert.alert("Invalid Code", "Please enter the 6-digit OTP code");
      return;
    }
    if (!tempToken) {
      Alert.alert("Session Expired", "Please log in again.");
      router.replace("/login");
      return;
    }
    verifyOtpMutation.mutate({ otp: trimmedOtp, tempToken, deviceId });
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            {/* Inverted mark: white circle, black glyph */}
            <View style={styles.iconCircle}>
              <Ionicons name="key" size={30} color="#000000" />
            </View>
            <Text style={styles.title}>Enter your code</Text>
            <Text style={styles.subtitle}>
              We’ve sent a 6-digit verification code to your email.
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Verification code</Text>
              <View
                style={[styles.inputContainer, isFocused && styles.inputContainerFocused]}
              >
                <Ionicons
                  name="shield-checkmark-outline"
                  size={20}
                  color={isFocused ? "#FFFFFF" : "#5A5A5A"}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[styles.input, styles.otpInput]}
                  value={otp}
                  onChangeText={setOtp}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  placeholder="••••••"
                  placeholderTextColor="#5A5A5A"
                  keyboardType="number-pad"
                  maxLength={6}
                  selectionColor="#FFFFFF"
                  autoFocus
                />
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.primaryButton,
                verifyOtpMutation.isPending && styles.buttonDisabled,
              ]}
              onPress={handleVerifyOtp}
              disabled={verifyOtpMutation.isPending}
              activeOpacity={0.85}
            >
              {verifyOtpMutation.isPending ? (
                <ActivityIndicator color="#000000" />
              ) : (
                <Text style={styles.primaryButtonText}>Verify & sign in</Text>
              )}
            </TouchableOpacity>

            {/* Secondary pill: same anatomy as an unselected filter pill */}
            <TouchableOpacity
              style={styles.resendButton}
              onPress={handleResendOtp}
              disabled={resendOtpMutation.isPending}
              activeOpacity={0.75}
            >
              {resendOtpMutation.isPending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.resendText}>Didn’t get a code? Resend</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.backLink}
              onPress={() => router.replace("/login")}
              hitSlop={10}
            >
              <Ionicons name="chevron-back" size={16} color="#8A8A8A" />
              <Text style={styles.backLinkText}>Back to login</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
    height: 60,
  },
  inputContainerFocused: { borderColor: "#FFFFFF" },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, color: "#FFFFFF", fontSize: 16 },
  otpInput: {
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: 8,
    fontVariant: ["tabular-nums"],
  },
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
  resendButton: {
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 190,
    height: 40,
    marginTop: 18,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: "#151515",
    borderWidth: 1,
    borderColor: "#262626",
  },
  resendText: { color: "#FFFFFF", fontSize: 13, fontWeight: "600" },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 12,
  },
  backLink: { flexDirection: "row", alignItems: "center", gap: 2 },
  backLinkText: { color: "#8A8A8A", fontSize: 14, fontWeight: "500" },
});