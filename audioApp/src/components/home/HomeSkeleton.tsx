import React from "react";
import { View, StyleSheet } from "react-native";

export function HomeSkeleton() {
  return (
    <View style={styles.container}>
      {/* Quick-pick grid */}
      <View style={styles.grid}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <View key={i} style={styles.tile} />
        ))}
      </View>

      {/* Song cards */}
      <View style={styles.title} />
      <View style={styles.row}>
        <View style={styles.card} />
        <View style={styles.card} />
        <View style={styles.card} />
      </View>

      {/* Artists */}
      <View style={styles.title} />
      <View style={styles.row}>
        <View style={styles.circle} />
        <View style={styles.circle} />
        <View style={styles.circle} />
        <View style={styles.circle} />
      </View>
    </View>
  );
}

const SKELETON = "#141414";

const styles = StyleSheet.create({
  container: { paddingTop: 4 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 8,
    paddingHorizontal: 18,
    marginBottom: 28,
  },
  tile: { width: "48.5%", height: 60, borderRadius: 10, backgroundColor: SKELETON },
  title: {
    marginHorizontal: 18,
    height: 20,
    width: 130,
    borderRadius: 6,
    backgroundColor: SKELETON,
    marginBottom: 14,
  },
  row: { flexDirection: "row", paddingHorizontal: 18, gap: 14, marginBottom: 28 },
  card: { width: 146, height: 146, borderRadius: 14, backgroundColor: SKELETON },
  circle: { width: 108, height: 108, borderRadius: 54, backgroundColor: SKELETON },
});