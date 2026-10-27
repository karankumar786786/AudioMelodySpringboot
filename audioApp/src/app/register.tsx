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
import { RegisterResponse } from "@/types";
import { registerStyles as styles } from "@/styles";

type Field = "userName" | "email" | null;

export default function RegisterScreen() {
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const [userName, setUsername] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [focused, setFocused] = useState<Field>(null);

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
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Create account</Text>
            <Text style={styles.subtitle}>
              Pick a username and add your email to get started.
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Username</Text>
              <View
                style={[
                  styles.inputContainer,
                  focused === "userName" && styles.inputContainerFocused,
                ]}
              >
                <Ionicons
                  name="person-outline"
                  size={20}
                  color={focused === "userName" ? "#FFFFFF" : "#5A5A5A"}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="e.g. johndoe"
                  value={userName}
                  onChangeText={setUsername}
                  onFocus={() => setFocused("userName")}
                  onBlur={() => setFocused(null)}
                  autoCorrect={false}
                  placeholderTextColor="#5A5A5A"
                  autoCapitalize="none"
                  selectionColor="#FFFFFF"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email address</Text>
              <View
                style={[
                  styles.inputContainer,
                  focused === "email" && styles.inputContainerFocused,
                ]}
              >
                <Ionicons
                  name="mail-outline"
                  size={20}
                  color={focused === "email" ? "#FFFFFF" : "#5A5A5A"}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="name@example.com"
                  value={email}
                  onChangeText={setEmail}
                  onFocus={() => setFocused("email")}
                  onBlur={() => setFocused(null)}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholderTextColor="#5A5A5A"
                  keyboardType="email-address"
                  selectionColor="#FFFFFF"
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
              activeOpacity={0.85}
            >
              {registerMutation.isPending ? (
                <ActivityIndicator color="#000000" />
              ) : (
                <Text style={styles.primaryButtonText}>Create account</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => router.replace("/login")} hitSlop={10}>
              <Text style={styles.linkText}>Log in</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

