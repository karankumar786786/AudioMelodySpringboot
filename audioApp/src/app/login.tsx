import  { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDispatch } from "react-redux";
import { useRouter } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { authService } from "@/service";
import { AppDispatch, setTempToken } from "@/store";
import { LoginResponse } from "@/types";
import { loginStyles as styles } from "@/styles";



export default function LoginScreen() {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const [email, setEmail] = useState<string>("");
  const [isFocused, setIsFocused] = useState(false);

  const loginMutation = useMutation({
    mutationKey: ["login"],
    mutationFn: authService.login,
    onSuccess: (response: LoginResponse) => {
      dispatch(setTempToken(response.tempToken));
      router.replace("/verifyotp");
    },
    onError: (error: any) => {
      const msg =
        error?.response?.data?.message ||
        "Login failed. Please check your credentials.";
      Alert.alert("Login Failed", msg);
      console.error("Login failed:", error);
    },
  });

  function handleLogin() {
    const trimmed = email.trim();
    if (!trimmed) {
      Alert.alert("Required", "Please enter your email address");
      return;
    }
    loginMutation.mutate({ email: trimmed });
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
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>
              Enter your email and we’ll send you a one-time passcode.
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email address</Text>
              <View
                style={[styles.inputContainer, isFocused && styles.inputContainerFocused]}
              >
                <Ionicons
                  name="mail-outline"
                  size={20}
                  color={isFocused ? "#FFFFFF" : "#5A5A5A"}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  autoCorrect={false}
                  placeholder="name@example.com"
                  placeholderTextColor="#5A5A5A"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  selectionColor="#FFFFFF"
                />
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.primaryButton,
                loginMutation.isPending && styles.buttonDisabled,
              ]}
              onPress={handleLogin}
              disabled={loginMutation.isPending}
              activeOpacity={0.85}
            >
              {loginMutation.isPending ? (
                <ActivityIndicator color="#000000" />
              ) : (
                <Text style={styles.primaryButtonText}>Continue with email</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Don’t have an account? </Text>
            <TouchableOpacity onPress={() => router.replace("/register")} hitSlop={10}>
              <Text style={styles.linkText}>Sign up</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

