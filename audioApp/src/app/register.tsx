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
import { useDispatch } from "react-redux";
import { useRouter } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { authService } from "@/service";
import { AppDispatch, setTempToken } from "@/store";
import { RegisterResponse } from "@/types";

export default function RegisterScreen() {
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const [userName, setUsername] = useState<string>("");
  const [email, setEmail] = useState<string>("");

  const registerMutation = useMutation({
    mutationKey: ["register"],
    mutationFn: authService.register,
    onSuccess: (response: RegisterResponse) => {
      dispatch(setTempToken(response.tempToken));
      router.replace("/verifyotp");
    },
    onError: (error: any) => {
      const msg =
        error?.response?.data?.message ||
        "Registration failed. Please try again.";
      Alert.alert("Registration Failed", msg);
      console.error("Register failed:", error);
    },
  });

  function handleRegister() {
    const trimmedUser = userName.trim();
    const trimmedEmail = email.trim();
    if (!trimmedUser || !trimmedEmail) {
      Alert.alert("Required", "Please enter both username and email");
      return;
    }
    registerMutation.mutate({ userName: trimmedUser, email: trimmedEmail });
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
              <Ionicons name="person-add-outline" size={36} color="#208AEF" />
            </View>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>
              Sign up with username and email to get started
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Username</Text>
              <View style={styles.inputContainer}>
                <Ionicons
                  name="person-outline"
                  size={20}
                  color="#777777"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="e.g. johndoe"
                  value={userName}
                  onChangeText={setUsername}
                  autoCorrect={false}
                  placeholderTextColor="#666666"
                  autoCapitalize="none"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email Address</Text>
              <View style={styles.inputContainer}>
                <Ionicons
                  name="mail-outline"
                  size={20}
                  color="#777777"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="name@example.com"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholderTextColor="#666666"
                  keyboardType="email-address"
                />
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.primaryButton,
                registerMutation.isPending && styles.buttonDisabled,
              ]}
              onPress={handleRegister}
              disabled={registerMutation.isPending}
            >
              {registerMutation.isPending ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>Create Account</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => router.replace("/login")}>
              <Text style={styles.linkText}>Log In</Text>
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
    marginBottom: 18,
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
    fontSize: 15,
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
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 12,
  },
  footerText: {
    color: "#888888",
    fontSize: 14,
  },
  linkText: {
    color: "#208AEF",
    fontSize: 14,
    fontWeight: "600",
  },
});
