import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { Stack, useRouter, useSegments, type Href } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { Provider, useDispatch, useSelector } from "react-redux";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppDispatch, AppState, loadAuthToken, loadDevice, loadUserProfile, store } from "@/store";
import { AuthToken } from "@/types";
import { configureAudioPriority } from "@/utils/audioConfig";

// Configure global exclusive audio priority as soon as the app starts
configureAudioPriority().catch(() => {});

// Prevent splash screen from auto-hiding until initial token/device loading is done
SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient();

function RootNavigator() {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const segments = useSegments();
  const authToken: AuthToken = useSelector((state: AppState) => state.auth);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function initializeApp() {
      try {
        await Promise.all([
          dispatch(loadAuthToken()).unwrap(),
          dispatch(loadDevice()).unwrap(),
          configureAudioPriority(),
        ]);
      } catch (error) {
        console.error("Initialization error:", error);
      } finally {
        if (isMounted) {
          setIsReady(true);
          await SplashScreen.hideAsync().catch(() => {});
        }
      }
    }

    initializeApp();

    return () => {
      isMounted = false;
    };
  }, [dispatch]);

  useEffect(() => {
    if (authToken.accessToken) {
      dispatch(loadUserProfile());
    }
  }, [authToken.accessToken, dispatch]);

  useEffect(() => {
    if (!isReady) return;

    const inAuthGroup = segments[0]  === "(authenticated)";
    const isAuthenticated = Boolean(authToken.accessToken);

    if (!isAuthenticated) {
      // If unauthenticated and currently in protected group or at root, redirect to signin
      if (inAuthGroup || !segments[0]) {
        router.replace("/login");
      }
    } else {
      // If authenticated and trying to access auth screens or root, redirect to home
      if (!inAuthGroup) {
        router.replace("/home");
      }
    }
  }, [authToken.accessToken, segments, isReady, router]);

  if (!isReady) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#121212" }}>
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="register" />
      <Stack.Screen name="login" />
      <Stack.Screen name="verifyotp" />
      <Stack.Screen name="(authenticated)" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <RootNavigator />
      </QueryClientProvider>
    </Provider>
  );
}