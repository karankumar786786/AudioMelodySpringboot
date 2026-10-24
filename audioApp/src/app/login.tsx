import { authService } from "@/service/auth";
import { AppDispatch, setTempToken } from "@/store";
import { LoginResponse } from "@/types";
import { useMutation } from "@tanstack/react-query";
import {  useRouter } from "expo-router";
import { useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDispatch } from "react-redux";

export default function LoginScreen() {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const [email,setEmail] = useState<string>("");
  const loginMutation = useMutation({
    mutationKey: ["login"],
    mutationFn: authService.login,
    onSuccess: (response: LoginResponse) => {
      dispatch(setTempToken(response.tempToken));
      router.replace("/verifyotp");
    },
    onError: (error) => {
      Alert.alert("Sorry Login failed");
      console.error("login failed", error);
    },
  })
  
  function handleLogin(){
    if(!email){
      Alert.alert("please enter email");
      return;
    }
    loginMutation.mutate({email});
  }
  return (
    <SafeAreaView>
      <View>
        <Text>Login</Text>
        <TextInput
        value={email}
        onChangeText={setEmail}
        autoCorrect={false}
        placeholder="email"
        placeholderTextColor="black"
        autoCapitalize="none"
        />
        <Text>don't have account ?</Text>
        <Pressable onPress={() => router.replace("/register")}>
          <Text>Register</Text>
        </Pressable>
        <Pressable onPress={handleLogin}>
          <Text>Login</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

