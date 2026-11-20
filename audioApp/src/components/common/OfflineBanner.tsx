import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { onlineManager } from "@tanstack/react-query";
import {
  subscribeToRequestFailures,
  subscribeToRequestSuccess,
  RequestFailureKind,
} from "@/service/network";

// A failure message stays until a request succeeds, or at most this long.
const FAILURE_MESSAGE_MAX_MS = 8000;

function useIsOnline(): boolean {
  const [online, setOnline] = useState(() => onlineManager.isOnline());
  useEffect(() => onlineManager.subscribe(setOnline), []);
  return online;
}

/**
 * Small, non-blocking banner pinned to the top of the screen.
 * - Offline: stays up until the connection returns.
 * - Online but a request failed after retries: shows until a request succeeds (max 8s).
 * It never intercepts touches.
 */
export function OfflineBanner() {
  const insets = useSafeAreaInsets();
  const online = useIsOnline();
  const [failure, setFailure] = useState<RequestFailureKind | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToRequestFailures((kind) => {
      setFailure(kind);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setFailure(null), FAILURE_MESSAGE_MAX_MS);
    });
    const unsubscribeSuccess = subscribeToRequestSuccess(() => {
      if (timer.current) clearTimeout(timer.current);
      setFailure(null);
    });
    return () => {
      unsubscribe();
      unsubscribeSuccess();
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  let message: string | null = null;
  let icon: keyof typeof Ionicons.glyphMap = "cloud-offline-outline";
  if (!online) {
    message = "You're offline. Showing saved content.";
  } else if (failure === "network") {
    message = "Can't reach One Melody. Check your connection.";
  } else if (failure === "server") {
    message = "Something went wrong on our side. Try again soon.";
    icon = "alert-circle-outline";
  }

  if (!message) return null;

  return (
    <View
      pointerEvents="none"
      style={[styles.wrapper, { top: insets.top + 6 }]}
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
    >
      <View style={styles.pill}>
        <Ionicons name={icon} size={15} color="#FFFFFF" />
        <Text style={styles.text} numberOfLines={1}>
          {message}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 1000,
    elevation: 1000,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: "90%",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(40, 40, 40, 0.96)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255, 255, 255, 0.18)",
  },
  text: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
});
