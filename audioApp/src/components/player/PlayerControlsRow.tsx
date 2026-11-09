import React, { memo } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { RepeatMode } from "@/types";
import { songStyles as styles } from "@/styles";

interface PlayerControlsRowProps {
  isPlaying: boolean;
  isLoading: boolean;
  repeatMode: RepeatMode;
  isShuffle: boolean;
  onTogglePlay: () => void;
  onNextTrack: () => void;
  onPrevTrack: () => void;
  onToggleShuffle: () => void;
  onToggleRepeat: () => void;
}

export const PlayerControlsRow = memo(function PlayerControlsRow({
  isPlaying,
  isLoading,
  repeatMode,
  isShuffle,
  onTogglePlay,
  onNextTrack,
  onPrevTrack,
  onToggleShuffle,
  onToggleRepeat,
}: PlayerControlsRowProps) {
  return (
    <View style={styles.controlsRow}>
      {/* Shuffle Button */}
      <TouchableOpacity
        hitSlop={14}
        onPress={onToggleShuffle}
        style={styles.controlIconBtn}
        activeOpacity={0.75}
        accessibilityLabel={isShuffle ? "Disable shuffle" : "Enable shuffle"}
      >
        <Ionicons
          name="shuffle"
          size={22}
          color={isShuffle ? "#FFFFFF" : "rgba(255, 255, 255, 0.35)"}
        />
        {isShuffle ? <View style={styles.activeDot} /> : <View style={styles.inactiveDot} />}
      </TouchableOpacity>

      {/* Skip Back / Previous */}
      <TouchableOpacity
        hitSlop={14}
        onPress={onPrevTrack}
        style={styles.controlIconBtn}
        activeOpacity={0.75}
        accessibilityLabel="Previous track"
      >
        <Ionicons name="play-skip-back" size={28} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Hero Play / Pause (Solid White on Black) */}
      <TouchableOpacity
        style={styles.mainPlayButton}
        activeOpacity={0.88}
        onPress={onTogglePlay}
        accessibilityLabel={isPlaying ? "Pause" : "Play"}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color="#000000" />
        ) : (
          <Ionicons
            name={isPlaying ? "pause" : "play"}
            size={32}
            color="#000000"
            style={isPlaying ? undefined : { marginLeft: 3 }}
          />
        )}
      </TouchableOpacity>

      {/* Skip Forward / Next */}
      <TouchableOpacity
        hitSlop={14}
        onPress={onNextTrack}
        style={styles.controlIconBtn}
        activeOpacity={0.75}
        accessibilityLabel="Next track"
      >
        <Ionicons name="play-skip-forward" size={28} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Repeat Button */}
      <TouchableOpacity
        hitSlop={14}
        onPress={onToggleRepeat}
        style={styles.controlIconBtn}
        activeOpacity={0.75}
        accessibilityLabel={`Repeat mode: ${repeatMode}`}
      >
        <Ionicons
          name="repeat"
          size={22}
          color={repeatMode !== "none" ? "#FFFFFF" : "rgba(255, 255, 255, 0.35)"}
        />
        {repeatMode === "one" ? (
          <View style={styles.repeatBadge}>
            <Text style={styles.repeatBadgeText}>1</Text>
          </View>
        ) : null}
        {repeatMode === "all" ? (
          <View style={styles.activeDot} />
        ) : (
          <View style={styles.inactiveDot} />
        )}
      </TouchableOpacity>
    </View>
  );
});
