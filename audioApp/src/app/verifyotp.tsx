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

export default function VerifyOtpScreen() {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const [otp, setOtp] = useState<string>("");

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
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <Ionicons name="key-outline" size={36} color="#208AEF" />
            </View>
            <Text style={styles.title}>Enter OTP Code</Text>
            <Text style={styles.subtitle}>
              We've sent a 6-digit verification code to your email
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Verification Code</Text>
              <View style={styles.inputContainer}>
                <Ionicons
                  name="shield-checkmark-outline"
                  size={20}
                  color="#777777"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[styles.input, styles.otpInput]}
                  value={otp}
                  onChangeText={setOtp}
                  placeholder="••••••"
                  placeholderTextColor="#666666"
                  keyboardType="number-pad"
                  maxLength={6}
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
            >
              {verifyOtpMutation.isPending ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>Verify & Sign In</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.resendButton}
              onPress={handleResendOtp}
              disabled={resendOtpMutation.isPending}
            >
              {resendOtpMutation.isPending ? (
                <ActivityIndicator size="small" color="#208AEF" />
              ) : (
                <Text style={styles.resendText}>
                  Didn't receive code? Resend OTP
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity onPress={() => router.replace("/login")}>
              <Text style={styles.backLinkText}>← Back to Login</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#121212",
  },
  keyboardView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
  },
  header: {
    alignItems: "center",
    marginBottom: 32,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(32, 138, 239, 0.12)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#888888",
    textAlign: "center",
    paddingHorizontal: 20,
    lineHeight: 20,
  },
  form: {
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#B3B3B3",
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1E1E1E",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2A2A2A",
    paddingHorizontal: 14,
    height: 52,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 16,
  },
  otpInput: {
    fontSize: 22,
    fontWeight: "600",
    letterSpacing: 8,
  },
  primaryButton: {
    backgroundColor: "#208AEF",
    height: 52,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  resendButton: {
    alignItems: "center",
    marginTop: 18,
    paddingVertical: 8,
  },
  resendText: {
    color: "#208AEF",
    fontSize: 14,
    fontWeight: "500",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 12,
  },
  backLinkText: {
    color: "#888888",
    fontSize: 14,
    fontWeight: "500",
  },
});
