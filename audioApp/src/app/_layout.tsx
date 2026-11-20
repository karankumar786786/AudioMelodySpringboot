import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { Provider, useDispatch, useSelector } from "react-redux";
import { useIsRestoring } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import {
  AppDispatch,
  AppState,
  loadAuthToken,
  loadDevice,
  loadUserProfile,
  loadLastPlaybackState,
  loadFavourites,
  loadUserPlaylists,
  store,
} from "@/store";
import { AuthToken } from "@/types";
import { configureAudioPriority } from "@/utils";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { OfflineBanner } from "@/components/common/OfflineBanner";
import { queryClient, persistOptions } from "@/service/queryClient";
import { setupNetworkAwareness } from "@/service/network";


// Configure global exclusive audio priority as soon as the app starts
if (Platform.OS !== "web") {
  configureAudioPriority().catch(() => {});
}

// Prevent splash screen from auto-hiding until initial token/device loading is done
SplashScreen.preventAutoHideAsync().catch(() => {});

// Pause/resume React Query with the device connection and app foreground state
setupNetworkAwareness();

function RootNavigator() {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const segments = useSegments();
  const authToken: AuthToken = useSelector((state: AppState) => state.auth);
  const [isReady, setIsReady] = useState(false);
  // Keep the splash up until the on-disk query cache is restored, so home renders
  // cached rows on the first frame instead of a skeleton.
  const isRestoringCache = useIsRestoring();
  const isAppReady = isReady && !isRestoringCache;

  useEffect(() => {
    let isMounted = true;

    async function initializeApp() {
      try {
        await Promise.all([
          dispatch(loadAuthToken()).unwrap(),
          dispatch(loadDevice()).unwrap(),
          dispatch(loadLastPlaybackState()),
        ]);
      } catch (error) {
        console.error("Initialization error:", error);
      } finally {
        if (isMounted) {
          setIsReady(true);
        }
      }
    }

    initializeApp();

    return () => {
      isMounted = false;
    };
  }, [dispatch]);

  useEffect(() => {
    if (isAppReady) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [isAppReady]);

  useEffect(() => {
    if (authToken.accessToken) {
      dispatch(loadUserProfile());
      dispatch(loadFavourites());
      dispatch(loadUserPlaylists());
    }
  }, [authToken.accessToken, dispatch]);

  useEffect(() => {
    if (!isAppReady) return;

    const inAuthGroup = segments[0] === "(authenticated)";
    const isAuthenticated = Boolean(authToken.accessToken);

    if (!isAuthenticated) {
      // If unauthenticated and currently in protected group, redirect to signin
      if (inAuthGroup) {
        router.replace("/login");
      }
    } else {
      // If authenticated and trying to access auth screens, redirect to home
      if (!inAuthGroup && (segments[0] === "login" || segments[0] === "register")) {
        router.replace("/(authenticated)/(tabs)/home");
      }
    }
  }, [authToken.accessToken, segments, isAppReady, router]);

  if (!isAppReady) {
    return null;
  }

  return (
    <>
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#000000" } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="register" />
      <Stack.Screen name="login" />
      <Stack.Screen name="verifyotp" />
      <Stack.Screen name="(authenticated)" />
      <Stack.Screen name="+not-found" />
    </Stack>
    <OfflineBanner />
    </>
  );
}



export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#000000" }}>
      <ErrorBoundary>
        <Provider store={store}>
          <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
            <RootNavigator />
          </PersistQueryClientProvider>
        </Provider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}
