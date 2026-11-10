import React, { memo } from "react";
import { View, Text, TouchableOpacity, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { MarqueeText } from "../common/MarqueeText";
import { songStyles as styles } from "@/styles";

interface PlayerMetaRowProps {
  title: string;
  artistName: string;
  isLiked: boolean;
  isSongInAnyPlaylist: boolean;
  heartScaleAnim: Animated.Value;
  onOpenArtist: () => void;
  onOpenAddToPlaylist: () => void;
  onToggleLike: () => void;
}

export const PlayerMetaRow = memo(function PlayerMetaRow({
  title,
  artistName,
  isLiked,
  isSongInAnyPlaylist,
  heartScaleAnim,
  onOpenArtist,
  onOpenAddToPlaylist,
  onToggleLike,
}: PlayerMetaRowProps) {
  return (
    <View style={styles.metaSection}>
      <View style={styles.titleContainer}>
        <MarqueeText style={styles.songTitle}>
          {title}
        </MarqueeText>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onOpenArtist}
          hitSlop={{ top: 8, bottom: 8, left: 0, right: 14 }}
        >
          <Text style={styles.artistName} numberOfLines={1}>
            {artistName}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        {/* Add to Playlist Button */}
        <TouchableOpacity
          hitSlop={14}
          onPress={onOpenAddToPlaylist}
          style={styles.likeButton}
          activeOpacity={0.75}
          accessibilityLabel="Add to playlist"
        >
          <Ionicons
            name={isSongInAnyPlaylist ? "checkmark-circle" : "add-circle-outline"}
            size={27}
            color={isSongInAnyPlaylist ? "#FFFFFF" : "rgba(255, 255, 255, 0.75)"}
          />
        </TouchableOpacity>

        {/* Like / Heart Button */}
        <TouchableOpacity
          hitSlop={14}
          onPress={onToggleLike}
          style={styles.likeButton}
          activeOpacity={0.75}
          accessibilityLabel={isLiked ? "Unlike song" : "Like song"}
        >
          <Animated.View style={{ transform: [{ scale: heartScaleAnim }] }}>
            <Ionicons
              name={isLiked ? "heart" : "heart-outline"}
              size={28}
              color={isLiked ? "#FF3B30" : "rgba(255, 255, 255, 0.75)"}
            />
          </Animated.View>
        </TouchableOpacity>
      </View>
    </View>
  );
});

