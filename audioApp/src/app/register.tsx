import { authService } from "@/service/auth";
import { AppDispatch, setTempToken } from "@/store";
import { RegisterResponse } from "@/types";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Text, TextInput, Pressable, Alert, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDispatch } from "react-redux";

export default function RegisterScreen() {
  const router = useRouter();
  const dispactch = useDispatch<AppDispatch>();
  const [userName, setUsername] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const registerMutation = useMutation({
    mutationKey: ["register"],
    mutationFn: authService.register,
    onSuccess: (response: RegisterResponse) => {
      dispactch(setTempToken(response.tempToken));
      router.push("/verifyotp");
    },
    onError: (error) => {
      Alert.alert("Sorry Register failed");
      console.error("register failed", error);
    },
  });
  function handleRegister() {
    if (!userName || !email) {
      Alert.alert("Please enter username and email");
      return;
    }
    registerMutation.mutate({ userName, email });
  }
  return (
    <SafeAreaView>
      <View>
        <Text>Sign Up</Text>
        <TextInput
          placeholder="name"
          value={userName}
          onChangeText={() => setUsername}
          autoCorrect={false}
          editable={true}
          placeholderTextColor="black"
          autoCapitalize="none"
        />
        <TextInput
          placeholder="Email"
          value={email}
          onChangeText={() => setEmail}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Text>Already have Account?</Text>
        <Pressable onPress={() => router.replace("/login")}>
          <Text>Login</Text>
        </Pressable>
        <Pressable onPress={handleRegister}>
          <Text>Register</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
