import React, { memo } from "react";
import { StyleProp, TouchableOpacity, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSelector } from "react-redux";
import { useGlobalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import type { AppState } from "@/store";
import type { Song } from "@/types";
import { shareSong } from "@/utils/shareSong";
import { hapticFeedback } from "@/utils/haptics";

type ShareableSong = Pick<Song, "id" | "title" | "artistName" | "imageKey">;

interface ShareSongButtonProps {
  /**
   * Song to share. When omitted (player top bar), it resolves the song the player
   * screen shows: the route's song id, matched against the current song, the queue,
   * then the cached ["song", id] query, falling back to the current song.
   */
  song?: ShareableSong | null;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}

export const ShareSongButton = memo(function ShareSongButton({
  song,
  size = 20,
  color = "#FFFFFF",
  style,
}: ShareSongButtonProps) {
  const queryClient = useQueryClient();
  const { id: routeId } = useGlobalSearchParams<{ id?: string }>();
  const currentSong = useSelector((state: AppState) => state.player.currentSong);
  const queue = useSelector((state: AppState) => state.queue.queue);

  const resolveSong = (): ShareableSong | null | undefined => {
    if (song) return song;
    const id = typeof routeId === "string" ? routeId : undefined;
    if (id) {
      if (currentSong && String(currentSong.id) === id) return currentSong;
      const queued = queue?.find((s: Song) => String(s.id) === id);
      if (queued) return queued;
      const cached = queryClient.getQueryData<Song>(["song", id]);
      if (cached?.id) return cached;
    }
    return currentSong;
  };

  if (!song?.id && !currentSong?.id && !routeId) return null;

  return (
    <TouchableOpacity
      style={style}
      hitSlop={12}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={song?.title ? `Share ${song.title}` : "Share song"}
      onPress={(e) => {
        e.stopPropagation?.();
        hapticFeedback.light();
        shareSong(resolveSong());
      }}
    >
      <Ionicons name="share-outline" size={size} color={color} />
    </TouchableOpacity>
  );
});
