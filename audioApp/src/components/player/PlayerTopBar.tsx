import React, { memo } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import { songStyles as styles } from "@/styles";

interface PlayerTopBarProps {
  album?: string | null;
  genre?: string | null;
  upcomingCount: number;
  gesture?: any;
  onDismiss: () => void;
  onOpenAlbum: () => void;
  onOpenSettings: () => void;
  onOpenQueue: () => void;
}

export const PlayerTopBar = memo(function PlayerTopBar({
  album,
  genre,
  upcomingCount,
  gesture,
  onDismiss,
  onOpenAlbum,
  onOpenSettings,
  onOpenQueue,
}: PlayerTopBarProps) {
  const content = (
    <View style={styles.topBar}>
      {/* Down Chevron / Dismiss */}
      <TouchableOpacity
        style={styles.topBarCircleBtn}
        onPress={onDismiss}
        hitSlop={14}
        activeOpacity={0.75}
        accessibilityLabel="Dismiss player"
      >
        <Ionicons name="chevron-down" size={24} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Album / Playlist Context Title */}
      <TouchableOpacity
        style={styles.topBarTitleContainer}
        activeOpacity={album ? 0.7 : 1}
        onPress={onOpenAlbum}
      >
        <Text style={styles.topBarSubtitle}>
          {album ? "PLAYING FROM ALBUM" : "PLAYING FROM ONE MELODY"}
        </Text>
        <Text style={styles.topBarTitle} numberOfLines={1}>
          {album || genre || "Featured Collection"}
        </Text>
      </TouchableOpacity>

      {/* Right Actions: Settings & Queue */}
      <View style={styles.topBarRightActions}>
        <TouchableOpacity
          style={styles.topBarCircleBtn}
          hitSlop={14}
          onPress={onOpenSettings}
          activeOpacity={0.75}
          accessibilityLabel="Audio settings"
        >
          <Ionicons name="settings-outline" size={20} color="#FFFFFF" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.topBarCircleBtn}
          hitSlop={14}
          onPress={onOpenQueue}
          activeOpacity={0.75}
          accessibilityLabel="Playback queue"
        >
          <Ionicons name="list" size={22} color="#FFFFFF" />
          {upcomingCount > 0 ? (
            <View style={styles.queueCounterBadge}>
              <Text style={styles.queueCounterText}>{upcomingCount}</Text>
            </View>
          ) : null}
        </TouchableOpacity>
      </View>
    </View>
  );

  if (gesture) {
    return <GestureDetector gesture={gesture}>{content}</GestureDetector>;
  }

  return content;
});
