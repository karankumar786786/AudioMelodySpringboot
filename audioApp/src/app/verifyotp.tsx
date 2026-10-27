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
import { verifyOtpStyles as styles } from "@/styles";



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

