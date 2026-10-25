import React from "react";
import { View, StyleSheet } from "react-native";

export function HomeSkeleton() {
  return (
    <View style={styles.container}>
      {/* Hero Banner Skeleton */}
      <View style={styles.heroSkeleton} />

      {/* Section 1 Header & Cards */}
      <View style={styles.headerSkeleton} />
      <View style={styles.cardsRow}>
        <View style={styles.cardSkeleton} />
        <View style={styles.cardSkeleton} />
        <View style={styles.cardSkeleton} />
      </View>

      {/* Section 2 Header & Artists */}
      <View style={styles.headerSkeleton} />
      <View style={styles.cardsRow}>
        <View style={styles.circleSkeleton} />
        <View style={styles.circleSkeleton} />
        <View style={styles.circleSkeleton} />
        <View style={styles.circleSkeleton} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 14,
  },
  heroSkeleton: {
    marginHorizontal: 18,
    height: 180,
    borderRadius: 16,
    backgroundColor: "#1C1C1E",
    marginBottom: 26,
  },
  headerSkeleton: {
    marginHorizontal: 18,
    height: 22,
    width: 140,
    borderRadius: 6,
    backgroundColor: "#1C1C1E",
    marginBottom: 16,
  },
  cardsRow: {
    flexDirection: "row",
    paddingHorizontal: 18,
    gap: 14,
    marginBottom: 28,
  },
  cardSkeleton: {
    width: 146,
    height: 170,
    borderRadius: 12,
    backgroundColor: "#1C1C1E",
  },
  circleSkeleton: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "#1C1C1E",
  },
});
