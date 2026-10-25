import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  useWindowDimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSelector, useDispatch } from "react-redux";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { AppState } from "@/store/hook";
import { audioPlayerService } from "@/service/audioPlayerService";
import { homeService } from "@/service";
import { useLyrics, LyricEntry } from "@/hooks/useLyrics";
import { formatDuration } from "@/utils/formatUtils";
import { nextTrack, prevTrack } from "@/store/queueActions";
import { getImageUrl } from "@/utils/imageUtils";
import { useDominantColor } from "@/utils/colorUtils";
import { SafeAreaView } from "react-native-safe-area-context";

export default function LyricsScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { id } = useLocalSearchParams<{ id: string }>();

  const currentSong = useSelector((state: AppState) => state.player.currentSong);
  const currentTime = useSelector((state: AppState) => state.player.currentTime);
  const duration = useSelector((state: AppState) => state.player.duration);
  const isPlaying = useSelector((state: AppState) => state.player.isPlaying);
  const isLoading = useSelector((state: AppState) => state.player.isLoading);

  // Fetch song details if not already loaded in player
  const { data: fetchedSong } = useQuery({
    queryKey: ["song", id],
    queryFn: () => homeService.getSongById(id!),
    enabled: Boolean(id && (!currentSong || currentSong.id !== id)),
  });

  const activeSong = currentSong?.id === id ? currentSong : fetchedSong || currentSong;

  // Synced lyrics hook
  const {
    transcriptions,
    plainLyrics,
    hasLyrics,
    activeIndex,
    isLoading: isLyricsLoading,
  } = useLyrics(
    activeSong?.lrclibId,
    currentTime,
    activeSong?.title,
    activeSong?.artistName,
    activeSong?.duration
  );

  const scrollViewRef = useRef<any>(null);
  const isUserScrolledRef = useRef(false);
  const userScrollTimeoutRef = useRef<any>(null);
  const lineLayoutsRef = useRef<{ [index: number]: number }>({});
  const [showSyncButton, setShowSyncButton] = useState(false);

  // Center the active lyric line
  const scrollToActiveLine = useCallback(
    (index: number, animated = true) => {
      if (index < 0 || !scrollViewRef.current) return;
      const y = lineLayoutsRef.current[index];
      if (typeof y === "number") {
        // Offset so active line sits near vertical center
        scrollViewRef.current.scrollTo({
          y: Math.max(0, y - 240),
          animated,
        });
      }
    },
    []
  );

  // Auto-scroll on activeIndex update unless user is manually inspecting
  useEffect(() => {
    if (activeIndex >= 0 && !isUserScrolledRef.current) {
      scrollToActiveLine(activeIndex, true);
    }
  }, [activeIndex, scrollToActiveLine]);

  // Handle manual user scroll
  const handleScrollBeginDrag = () => {
    isUserScrolledRef.current = true;
    setShowSyncButton(true);

    if (userScrollTimeoutRef.current) {
      clearTimeout(userScrollTimeoutRef.current);
    }

    // Auto-resume sync after 5 seconds of inactivity
    userScrollTimeoutRef.current = setTimeout(() => {
      isUserScrolledRef.current = false;
      setShowSyncButton(false);
      if (activeIndex >= 0) {
        scrollToActiveLine(activeIndex, true);
      }
    }, 5000);
  };

  const handleResyncPress = () => {
    if (userScrollTimeoutRef.current) {
      clearTimeout(userScrollTimeoutRef.current);
    }
    isUserScrolledRef.current = false;
    setShowSyncButton(false);
    if (activeIndex >= 0) {
      scrollToActiveLine(activeIndex, true);
    }
  };

  const handleLinePress = (entry: LyricEntry) => {
    audioPlayerService.seek(entry.start_time_seconds);
    audioPlayerService.resume();
    isUserScrolledRef.current = false;
    setShowSyncButton(false);
  };

  const handleTogglePlay = () => {
    audioPlayerService.togglePlay();
  };

  const handleNext = () => {
    (dispatch as any)(nextTrack(true));
  };

  const handlePrev = () => {
    (dispatch as any)(prevTrack());
  };

  const posterUrl = activeSong
    ? getImageUrl(activeSong.imageKey, {
        width: 400,
        height: 400,
        focus: "auto",
        aspectRatio: "1-1",
      })
    : undefined;

  const fallbackKey = `${activeSong?.title || ""}-${activeSong?.artistName || ""}-${activeSong?.id || ""}`;
  const dominantTheme = useDominantColor(posterUrl, fallbackKey);

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <View style={styles.root}>
      {/* Ambient background glow */}
      {posterUrl ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Image
            source={{ uri: posterUrl }}
            style={styles.ambientImage}
            contentFit="cover"
            blurRadius={65}
            cachePolicy="memory"
          />
          <LinearGradient
            colors={dominantTheme.gradientColors}
            locations={[0, 0.28, 0.58, 0.88, 1]}
            style={StyleSheet.absoluteFill}
          />
        </View>
      ) : null}

      <SafeAreaView style={styles.container}>
        {/* Top Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => router.back()}
            hitSlop={14}
            activeOpacity={0.75}
          >
            <Ionicons name="chevron-down" size={26} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.headerTitleGroup}>
            <Text style={styles.headerSubtitle}>LYRICS</Text>
            <Text style={styles.headerTrackTitle} numberOfLines={1}>
              {activeSong?.title || "Now Playing"}
            </Text>
            <Text style={styles.headerArtist} numberOfLines={1}>
              {activeSong?.artistName || ""}
            </Text>
          </View>

          <View style={{ width: 40 }} />
        </View>

        {/* Lyrics Body */}
        <View style={styles.lyricsBody}>
          {isLyricsLoading ? (
            <View style={styles.centerState}>
              <ActivityIndicator size="large" color="#FFFFFF" />
              <Text style={styles.loadingText}>Loading synced lyrics...</Text>
            </View>
          ) : !hasLyrics ? (
            <View style={styles.centerState}>
              <Ionicons name="musical-notes-outline" size={48} color="#555555" />
              <Text style={styles.emptyTitle}>No lyrics available</Text>
              <Text style={styles.emptySubtitle}>
                Synced lyrics could not be found for this track.
              </Text>
            </View>
          ) : transcriptions.length > 0 ? (
            <ScrollView
              ref={scrollViewRef}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollList}
              onScrollBeginDrag={handleScrollBeginDrag}
            >
              <View style={{ height: 40 }} />
              {transcriptions.map((entry, index) => {
                const isActive = index === activeIndex;
                const isPast = index < activeIndex;

                return (
                  <TouchableOpacity
                    key={`${entry.start_time_seconds}-${index}`}
                    style={styles.lyricLineContainer}
                    activeOpacity={0.75}
                    onPress={() => handleLinePress(entry)}
                    onLayout={(e) => {
                      lineLayoutsRef.current[index] = e.nativeEvent.layout.y;
                    }}
                  >
                    <Text
                      style={[
                        styles.lyricLineText,
                        isActive && styles.lyricLineTextActive,
                        isPast && styles.lyricLineTextPast,
                      ]}
                    >
                      {entry.text}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              <View style={{ height: 160 }} />
            </ScrollView>
          ) : plainLyrics ? (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollList}
            >
              <View style={{ height: 40 }} />
              <Text style={styles.plainLyricsText}>{plainLyrics}</Text>
              <View style={{ height: 160 }} />
            </ScrollView>
          ) : null}

          {/* Floating Re-sync Button (like Spotify) */}
          {showSyncButton && transcriptions.length > 0 ? (
            <TouchableOpacity
              style={styles.floatingSyncBtn}
              activeOpacity={0.85}
              onPress={handleResyncPress}
            >
              <Ionicons name="refresh" size={16} color="#000000" />
              <Text style={styles.floatingSyncText}>Sync with audio</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Bottom Playback Dock */}
        <View style={styles.playbackDock}>
          {/* Progress row */}
          <View style={styles.progressRow}>
            <Text style={styles.dockTimeText}>{formatDuration(currentTime)}</Text>
            <View style={styles.dockTrack}>
              <View style={[styles.dockFill, { width: `${progressPercent}%` }]} />
            </View>
            <Text style={styles.dockTimeText}>{formatDuration(duration)}</Text>
          </View>

          {/* Controls row */}
          <View style={styles.controlsRow}>
            <TouchableOpacity
              hitSlop={14}
              onPress={handlePrev}
              style={styles.dockIconBtn}
              activeOpacity={0.75}
            >
              <Ionicons name="play-skip-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dockPlayBtn}
              activeOpacity={0.88}
              onPress={handleTogglePlay}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#000000" />
              ) : (
                <Ionicons
                  name={isPlaying ? "pause" : "play"}
                  size={26}
                  color="#000000"
                  style={isPlaying ? undefined : { marginLeft: 2 }}
                />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              hitSlop={14}
              onPress={handleNext}
              style={styles.dockIconBtn}
              activeOpacity={0.75}
            >
              <Ionicons name="play-skip-forward" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#121212",
  },
  ambientImage: {
    ...StyleSheet.absoluteFill,
    opacity: 0.6,
    transform: [{ scale: 1.15 }],
  },
  container: {
    flex: 1,
    justifyContent: "space-between",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitleGroup: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 12,
  },
  headerSubtitle: {
    color: "rgba(255, 255, 255, 0.5)",
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  headerTrackTitle: {
    color: "#FFFFFF",
    fontSize: 14.5,
    fontWeight: "700",
    marginTop: 2,
  },
  headerArtist: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 12,
    marginTop: 1,
  },
  lyricsBody: {
    flex: 1,
    position: "relative",
  },
  scrollList: {
    paddingHorizontal: 28,
  },
  lyricLineContainer: {
    paddingVertical: 14,
  },
  lyricLineText: {
    color: "rgba(255, 255, 255, 0.38)",
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: 0.2,
    lineHeight: 34,
  },
  lyricLineTextActive: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 28,
    lineHeight: 38,
    textShadowColor: "rgba(255, 255, 255, 0.4)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  lyricLineTextPast: {
    color: "rgba(255, 255, 255, 0.48)",
  },
  plainLyricsText: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 20,
    lineHeight: 32,
    fontWeight: "500",
    textAlign: "left",
  },
  centerState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  loadingText: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 15,
    marginTop: 16,
    fontWeight: "500",
  },
  emptyTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
    marginTop: 16,
  },
  emptySubtitle: {
    color: "rgba(255, 255, 255, 0.5)",
    fontSize: 14,
    marginTop: 6,
    textAlign: "center",
  },
  floatingSyncBtn: {
    position: "absolute",
    bottom: 16,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  floatingSyncText: {
    color: "#000000",
    fontSize: 13,
    fontWeight: "700",
  },
  playbackDock: {
    backgroundColor: "rgba(28, 28, 30, 0.95)",
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.1)",
    paddingTop: 12,
    paddingBottom: 16,
    paddingHorizontal: 24,
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 8,
  },
  dockTimeText: {
    color: "rgba(255, 255, 255, 0.5)",
    fontSize: 11,
    fontVariant: ["tabular-nums"],
    width: 38,
    textAlign: "center",
  },
  dockTrack: {
    flex: 1,
    height: 3.5,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: 2,
    overflow: "hidden",
  },
  dockFill: {
    height: "100%",
    backgroundColor: "#FFFFFF",
  },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 36,
  },
  dockIconBtn: {
    padding: 8,
  },
  dockPlayBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#FFFFFF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
});
