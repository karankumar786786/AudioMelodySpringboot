import React, { memo } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useSelector } from "react-redux";
import { Ionicons } from "@expo/vector-icons";
import { AppState } from "@/store/hook";
import { useLyrics } from "@/hooks/useLyrics";
import { Song, PlayerSong } from "@/types";
import { songStyles as styles } from "@/styles";

interface PlayerLyricsPreviewCardProps {
  song: Song | PlayerSong | null;
  dominantColor?: string;
  onOpenFullLyrics: () => void;
}

export const PlayerLyricsPreviewCard = memo(function PlayerLyricsPreviewCard({
  song,
  dominantColor,
  onOpenFullLyrics,
}: PlayerLyricsPreviewCardProps) {
  // Isolate high-frequency currentTime subscription so lyric line updates only re-render this card
  const currentTime = useSelector((state: AppState) => state.player.currentTime);

  const {
    currentLine,
    nextLine,
    transcriptions,
    plainLyrics,
    hasLyrics,
  } = useLyrics(
    song?.lrclibId,
    currentTime,
    song?.title,
    song?.artistName,
    song?.duration,
    song?.id
  );

  if (!hasLyrics || !song) return null;

  return (
    <View style={styles.lyricsSection}>
      <TouchableOpacity
        style={[
          styles.lyricsCard,
          dominantColor ? { backgroundColor: `${dominantColor}38` } : undefined,
        ]}
        activeOpacity={0.88}
        onPress={onOpenFullLyrics}
        accessibilityLabel="Open synchronized lyrics full screen"
      >
        <View style={styles.lyricsCardHeader}>
          <View style={styles.lyricsCardTitleRow}>
            <Ionicons name="musical-notes" size={17} color="#FFFFFF" />
            <Text style={styles.lyricsCardTitle}>Lyrics</Text>
          </View>
          <View style={styles.lyricsCardMorePill}>
            <Text style={styles.lyricsCardMoreText}>FULL SCREEN</Text>
            <Ionicons name="expand-outline" size={13} color="#FFFFFF" />
          </View>
        </View>

        <View style={styles.lyricsCardContent}>
          {currentLine?.text ? (
            <>
              <View style={styles.lyricsActiveIndicatorRow}>
                <View style={styles.lyricsActiveDot} />
                <Text style={styles.lyricsLinePrimary} numberOfLines={2}>
                  {currentLine.text}
                </Text>
              </View>
              {nextLine?.text ? (
                <Text style={styles.lyricsLineSecondary} numberOfLines={1}>
                  {nextLine.text}
                </Text>
              ) : null}
            </>
          ) : transcriptions.length > 0 ? (
            <>
              <View style={styles.lyricsActiveIndicatorRow}>
                <View style={styles.lyricsActiveDot} />
                <Text style={styles.lyricsLinePrimary} numberOfLines={2}>
                  {transcriptions[0].text}
                </Text>
              </View>
              {transcriptions[1]?.text ? (
                <Text style={styles.lyricsLineSecondary} numberOfLines={1}>
                  {transcriptions[1].text}
                </Text>
              ) : null}
            </>
          ) : plainLyrics ? (
            <Text style={styles.lyricsLinePrimary} numberOfLines={3}>
              {plainLyrics.trim().split("\n").slice(0, 3).join("\n")}
            </Text>
          ) : (
            <Text style={styles.lyricsLineSecondary}>Tap to open lyrics</Text>
          )}
        </View>
      </TouchableOpacity>
    </View>
  );
});

