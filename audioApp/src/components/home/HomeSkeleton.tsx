import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated } from "react-native";
import { colors, radius, spacing } from "@/theme";

export function HomeSkeleton() {
  const opacityAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacityAnim, {
          toValue: 0.8,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0.4,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacityAnim]);

  return (
    <Animated.View style={[styles.container, { opacity: opacityAnim }]}>
      {/* Quick-Pick 2x3 Grid */}
      <View style={styles.grid}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <View key={i} style={styles.tile} />
        ))}
      </View>

      {/* Trending shelf */}
      <View style={styles.sectionHeader}>
        <View style={styles.titleBar} />
        <View style={styles.subtitleBar} />
      </View>
      <View style={styles.horizontalRow}>
        <View style={styles.squareCard} />
        <View style={styles.squareCard} />
        <View style={styles.squareCard} />
      </View>

      {/* Albums shelf */}
      <View style={styles.sectionHeader}>
        <View style={styles.titleBar} />
      </View>
      <View style={styles.horizontalRow}>
        <View style={styles.squareCard} />
        <View style={styles.squareCard} />
        <View style={styles.squareCard} />
      </View>

      {/* Artists */}
      <View style={styles.sectionHeader}>
        <View style={styles.titleBar} />
      </View>
      <View style={styles.horizontalRow}>
        <View style={styles.circle} />
        <View style={styles.circle} />
        <View style={styles.circle} />
        <View style={styles.circle} />
      </View>
    </Animated.View>
  );
}

const SKELETON_BG = "#1A1A1A";

const styles = StyleSheet.create({
  container: {
    paddingTop: spacing.xs,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 8,
    paddingHorizontal: spacing.side,
    marginBottom: spacing.lg,
  },
  tile: {
    width: "48.5%",
    height: 60,
    borderRadius: radius.md,
    backgroundColor: SKELETON_BG,
  },
  sectionHeader: {
    paddingHorizontal: spacing.side,
    marginBottom: spacing.sm + 4,
    marginTop: spacing.md,
  },
  titleBar: {
    height: 18,
    width: 140,
    borderRadius: radius.sm,
    backgroundColor: SKELETON_BG,
    marginBottom: 6,
  },
  subtitleBar: {
    height: 12,
    width: 100,
    borderRadius: radius.sm,
    backgroundColor: SKELETON_BG,
  },
  horizontalRow: {
    flexDirection: "row",
    paddingHorizontal: spacing.side,
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  squareCard: {
    width: 148,
    height: 148,
    borderRadius: radius.md,
    backgroundColor: SKELETON_BG,
  },
  circle: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: SKELETON_BG,
  },
});
