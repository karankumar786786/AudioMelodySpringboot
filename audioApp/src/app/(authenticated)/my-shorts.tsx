import React from "react";
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useQueryClient } from "@tanstack/react-query";
import { useShortsFeed } from "@/hooks/useShortsFeed";
import { Short, shortMediaUrl, shortsService } from "@/service/shortsService";

const STATUS_LABEL: Record<string, { text: string; color: string }> = {
  UPLOADING: { text: "Uploading", color: "#9e9e9e" },
  PROCESSING: { text: "Processing", color: "#64b5f6" },
  READY: { text: "Live", color: "#81c784" },
  FAILED: { text: "Failed", color: "#ff8a80" },
  HIDDEN: { text: "Hidden", color: "#ffb74d" },
};

/** The listener's own shorts in every state, so they can see processing and failures. */
export default function MyShortsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const mine = useShortsFeed({ kind: "mine" });
  const shorts = mine.data?.pages.flatMap((p) => p.items) ?? [];
  const processing = shorts.some((s) => s.status === "PROCESSING" || s.status === "UPLOADING");

  // Refresh while something is processing.
  React.useEffect(() => {
    if (!processing) return;
    const t = setInterval(() => mine.refetch(), 8000);
    return () => clearInterval(t);
  }, [processing, mine]);

  const onPress = (s: Short) => {
    const options = [
      {
        text: "Delete",
        style: "destructive" as const,
        onPress: async () => {
          try {
            await shortsService.remove(s.id);
            qc.invalidateQueries({ queryKey: ["shorts"] });
          } catch {
            Alert.alert("Couldn't delete", "Please try again.");
          }
        },
      },
      { text: "Cancel", style: "cancel" as const },
    ];
    const detail =
      s.status === "FAILED"
        ? s.failureReason || "Processing failed."
        : s.status === "HIDDEN"
          ? "This short was hidden after reports and is being reviewed."
          : s.status === "READY"
            ? `${s.likesCount} likes · ${s.viewsCount} views`
            : "Processing usually takes a minute or two.";
    Alert.alert(s.caption || "Your short", detail, options);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>My shorts</Text>
        <TouchableOpacity onPress={() => router.push("/(authenticated)/shorts-upload" as any)} accessibilityRole="button" accessibilityLabel="Post a short">
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      </View>
      {mine.isPending ? (
        <ActivityIndicator color="#fff" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={shorts}
          keyExtractor={(s) => s.id}
          numColumns={3}
          contentContainerStyle={{ padding: 2, paddingBottom: insets.bottom + 24 }}
          onEndReached={() => mine.hasNextPage && mine.fetchNextPage()}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>You haven't posted a short yet.</Text>
              <TouchableOpacity style={styles.primary} onPress={() => router.push("/(authenticated)/shorts-upload" as any)}>
                <Text style={styles.primaryText}>Post a short</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item }) => {
            const label = STATUS_LABEL[item.status];
            return (
              <TouchableOpacity style={styles.cell} onPress={() => onPress(item)} accessibilityRole="button">
                {item.thumbnailKey ? (
                  <Image source={{ uri: shortMediaUrl(item.thumbnailKey) }} style={StyleSheet.absoluteFill} contentFit="cover" />
                ) : (
                  <View style={[StyleSheet.absoluteFill, styles.placeholder]}>
                    <Ionicons name="film-outline" size={24} color="#555" />
                  </View>
                )}
                {label ? (
                  <View style={[styles.badge, { backgroundColor: label.color }]}>
                    <Text style={styles.badgeText}>{label.text}</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0b0b0d" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 10 },
  title: { color: "#fff", fontSize: 17, fontWeight: "700" },
  cell: { flex: 1 / 3, aspectRatio: 9 / 16, margin: 1, backgroundColor: "#151518", overflow: "hidden" },
  placeholder: { alignItems: "center", justifyContent: "center" },
  badge: { position: "absolute", left: 4, bottom: 4, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { color: "#000", fontSize: 10, fontWeight: "800" },
  empty: { alignItems: "center", marginTop: 60, gap: 12 },
  emptyText: { color: "#aaa" },
  primary: { backgroundColor: "#fff", borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10 },
  primaryText: { color: "#000", fontWeight: "700" },
});
