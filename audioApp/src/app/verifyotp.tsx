import { authService } from "@/service/auth";
import { AppDispatch, AppState, saveAuthToken, setTempToken } from "@/store";
import { ResendOtpResponse, VerifyOtpResponse } from "@/types";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";

export default function VerifyOtpScreen() {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const [otp,setotp] = useState<string>("");
  const deviceId = useSelector(
    (state:AppState)=>{
      return state.device.deviceId;
    }
  )
  const tempToken = useSelector(
    (state:AppState)=>{
      return state.tempToken.tempToken;
    }
  );
  const resendOtpMutation = useMutation({
    mutationKey:["resend-otp"],
    mutationFn:authService.resendOtp,
    onSuccess:(response:ResendOtpResponse)=>{
      dispatch(setTempToken(response.tempToken));
      Alert.alert("Otp resend successfully");
    },
    onError:(error)=>{
      Alert.alert("Sorry resend otp failed");
      console.error("resend otp failed", error);
    }
  })
  const verifyOtpMutation = useMutation({
    mutationKey: ["verifyOtp"],
    mutationFn: authService.verifyOtp,
    onSuccess: (response: VerifyOtpResponse) => {
      dispatch(saveAuthToken(response));
      router.replace("/(authenticated)/(tabs)/profile");
    },
    onError: (error) => {
      Alert.alert("Sorry Login failed");
      console.error("login failed", error);
    },
  });
  function handleResendOtp(){
    resendOtpMutation.mutate({tempToken});
  }
  function handleVerifyOtp(){
    if (otp.length !== 6 || !otp ) {
      Alert.alert("Invalid OTP");
      return;
    }
    verifyOtpMutation.mutate({otp,tempToken,deviceId});
  }
  return (
    <SafeAreaView>
      <View>
        <Text>Verify OTP</Text>
        <TextInput
        value={otp}
        onChangeText={setotp}
        placeholder="OTP"
        placeholderTextColor="black"
        autoCorrect={false}
        autoCapitalize="none"
        />
        <Pressable
        onPress={handleResendOtp}
        >
          <Text>resend</Text>
        </Pressable>
        <Pressable
        onPress={handleVerifyOtp}
        >
          <Text>Verify</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}


