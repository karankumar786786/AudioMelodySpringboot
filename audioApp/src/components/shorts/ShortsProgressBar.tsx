import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated } from "react-native";

interface ShortsProgressBarProps {
  /** Current playback time in seconds */
  currentTime: number;
  /** Preview start time in seconds (0 if full track) */
  startTime: number;
  /** Preview end time in seconds (0 if full track / no end) */
  endTime: number;
  /** Total track duration in seconds */
  duration: number;
  /** Whether playback is paused */
  isPaused: boolean;
  /** Whether the bar should be visible */
  isVisible: boolean;
}

/**
 * Slim animated progress bar shown at the bottom of each Shorts slide.
 * Shows progress within the preview window (previewStart → previewEnd),
 * or the full track progress if no preview window is set.
 */
export function ShortsProgressBar({
  currentTime,
  startTime,
  endTime,
  duration,
  isPaused,
  isVisible,
}: ShortsProgressBarProps) {
  const progressAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  // Show/hide with fade
  useEffect(() => {
    Animated.timing(opacityAnim, {
      toValue: isVisible ? 1 : 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [isVisible, opacityAnim]);

  // Animate progress
  useEffect(() => {
    const effectiveStart = startTime > 0 ? startTime : 0;
    const effectiveEnd =
      endTime > effectiveStart ? endTime : duration > 0 ? duration : 30;
    const windowSize = effectiveEnd - effectiveStart;

    if (windowSize <= 0) {
      progressAnim.setValue(0);
      return;
    }

    const elapsed = Math.max(0, currentTime - effectiveStart);
    const progress = Math.min(1, elapsed / windowSize);
    progressAnim.setValue(progress);
  }, [currentTime, startTime, endTime, duration, progressAnim]);

  if (!isVisible) return null;

  return (
    <Animated.View style={[styles.container, { opacity: opacityAnim }]}>
      <View style={styles.track}>
        <Animated.View
          style={[
            styles.fill,
            {
              width: progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ["0%", "100%"],
                extrapolate: "clamp",
              }),
              opacity: isPaused ? 0.5 : 1,
            },
          ]}
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    paddingHorizontal: 0,
  },
  track: {
    height: 2.5,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    backgroundColor: "#FF2D55",
    borderRadius: 2,
  },
});
