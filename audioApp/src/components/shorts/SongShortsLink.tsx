import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useQuery } from "@tanstack/react-query";
import { shortMediaUrl, shortsService } from "@/service/shortsService";
import { hapticFeedback } from "@/utils/haptics";

/** "Shorts with this song" row on the song screen; hidden when no short uses the song. */
export function SongShortsLink({ songId }: { songId?: string }) {
  const router = useRouter();
  const { data } = useQuery({
    queryKey: ["shorts", { kind: "song-preview", songId }],
    queryFn: () => shortsService.bySong(songId!, null),
    enabled: !!songId,
    staleTime: 5 * 60_000,
  });
  const shorts = data?.items ?? [];
  if (!songId || shorts.length === 0) return null;
  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.8}
      onPress={() => {
        hapticFeedback.light();
        router.push({ pathname: "/(authenticated)/shorts", params: { songId } });
      }}
      accessibilityRole="button"
      accessibilityLabel="Watch shorts with this song"
    >
      <View style={styles.thumbs}>
        {shorts.slice(0, 3).map((s) => (
          <Image key={s.id} source={{ uri: shortMediaUrl(s.thumbnailKey) }} style={styles.thumb} contentFit="cover" />
        ))}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>Shorts with this song</Text>
        <Text style={styles.sub}>
          {shorts.length}
          {data?.nextCursor ? "+" : ""} {shorts.length === 1 ? "short" : "shorts"}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#fff" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 12,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  thumbs: { flexDirection: "row" },
  thumb: { width: 30, height: 52, borderRadius: 6, marginRight: -8, borderWidth: 1, borderColor: "#000", backgroundColor: "#222" },
  title: { color: "#fff", fontWeight: "700", fontSize: 15, marginLeft: 8 },
  sub: { color: "rgba(255,255,255,0.7)", fontSize: 12, marginLeft: 8 },
});
