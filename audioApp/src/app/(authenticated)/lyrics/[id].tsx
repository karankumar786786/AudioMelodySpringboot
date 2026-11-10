import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  GestureResponderEvent,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSelector, useDispatch } from "react-redux";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { AppState } from "@/store";
import { homeService, audioPlayerService } from "@/service";
import { useLyrics, LyricEntry } from "@/hooks";
import { formatDuration, getImageUrl, useDominantColor } from "@/utils";
import { hapticFeedback } from "@/utils/haptics";
import { nextTrack, prevTrack } from "@/store";
import { lyricsStyles as styles } from "@/styles";

export default function LyricsScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const currentSong = useSelector((state: AppState) => state.player.currentSong);
  const currentTime = useSelector((state: AppState) => state.player.currentTime);
  const duration = useSelector((state: AppState) => state.player.duration);
  const isPlaying = useSelector((state: AppState) => state.player.isPlaying);
  const isLoading = useSelector((state: AppState) => state.player.isLoading);

  const { data: fetchedSong } = useQuery({
    queryKey: ["song", id],
    queryFn: () => homeService.getSongById(id!),
    enabled: Boolean(id && (!currentSong || currentSong.id !== id)),
  });

  const activeSong = currentSong?.id === id ? currentSong : fetchedSong || currentSong;

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

  // Scrubber support
  const [progressBarWidth, setProgressBarWidth] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubTime, setScrubTime] = useState<number | null>(null);

  const effectiveDuration = duration > 0 ? duration : (activeSong?.duration || 0);
  const displayTime = isScrubbing && scrubTime !== null ? scrubTime : currentTime;
  const progressPercent =
    effectiveDuration > 0
      ? Math.min(100, Math.max(0, (displayTime / effectiveDuration) * 100))
      : 0;

  const calculateSecondsFromEvent = (e: GestureResponderEvent) => {
    const barWidth = progressBarWidth > 0 ? progressBarWidth : 200;
    const { locationX } = e.nativeEvent;
    const ratio = Math.max(0, Math.min(1, locationX / barWidth));
    return ratio * effectiveDuration;
  };

  const handleSeekStart = (e: GestureResponderEvent) => {
    hapticFeedback.selection();
    const target = calculateSecondsFromEvent(e);
    setIsScrubbing(true);
    setScrubTime(target);
  };

  const handleSeekMove = (e: GestureResponderEvent) => {
    const target = calculateSecondsFromEvent(e);
    setScrubTime(target);
  };

  const handleSeekEnd = (e: GestureResponderEvent) => {
    hapticFeedback.medium();
    const target = calculateSecondsFromEvent(e);
    setIsScrubbing(false);
    setScrubTime(null);
    audioPlayerService.seek(target);
  };

  const handleSeekCancel = () => {
    setIsScrubbing(false);
    setScrubTime(null);
  };

  const scrollToActiveLine = useCallback((index: number, animated = true) => {
    if (index < 0 || !scrollViewRef.current) return;
    const y = lineLayoutsRef.current[index];
    if (typeof y === "number") {
      scrollViewRef.current.scrollTo({
        y: Math.max(0, y - 240),
        animated,
      });
    }
  }, []);

  useEffect(() => {
    if (activeIndex >= 0 && !isUserScrolledRef.current) {
      scrollToActiveLine(activeIndex, true);
    }
  }, [activeIndex, scrollToActiveLine]);

  const handleScrollBeginDrag = () => {
    isUserScrolledRef.current = true;
    setShowSyncButton(true);

    if (userScrollTimeoutRef.current) {
      clearTimeout(userScrollTimeoutRef.current);
    }

    userScrollTimeoutRef.current = setTimeout(() => {
      isUserScrolledRef.current = false;
      setShowSyncButton(false);
      if (activeIndex >= 0) {
        scrollToActiveLine(activeIndex, true);
      }
    }, 5000);
  };

  const handleResyncPress = () => {
    hapticFeedback.selection();
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
    hapticFeedback.light();
    audioPlayerService.seek(entry.start_time_seconds);
    audioPlayerService.resume();
    isUserScrolledRef.current = false;
    setShowSyncButton(false);
  };

  const handleTogglePlay = () => {
    hapticFeedback.medium();
    audioPlayerService.togglePlay();
  };

  const handleNext = () => {
    hapticFeedback.light();
    (dispatch as any)(nextTrack(true));
  };

  const handlePrev = () => {
    hapticFeedback.light();
    (dispatch as any)(prevTrack());
  };

  const posterUrl = activeSong
    ? (activeSong as any).posterUrl ||
      (activeSong as any).coverUrl ||
      (activeSong.imageKey
        ? getImageUrl(activeSong.imageKey, {
            width: 720,
            height: 720,
            focus: "auto",
            aspectRatio: "1-1",
            quality: 90,
          })
        : undefined)
    : undefined;

  const fallbackKey = `${activeSong?.title || ""}-${activeSong?.artistName || ""}-${activeSong?.id || ""}`;
  const dominantTheme = useDominantColor(posterUrl, fallbackKey);

  return (
    <View style={styles.root}>
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

      <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => router.back()}
            hitSlop={14}
            activeOpacity={0.75}
          >
            <Ionicons name="chevron-down" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.headerTitleGroup}>
            <Text style={styles.headerSubtitleLabel}>Live Lyrics</Text>
            <Text style={styles.headerTrackTitle} numberOfLines={1}>
              {activeSong?.title || "Now playing"}
            </Text>
            <Text style={styles.headerArtist} numberOfLines={1}>
              {activeSong?.artistName || ""}
            </Text>
          </View>

          <View style={{ width: 40 }} />
        </View>

        {/* Lyrics body */}
        <View style={styles.lyricsBody}>
          {isLyricsLoading ? (
            <View style={styles.centerState}>
              <ActivityIndicator size="large" color="#FFFFFF" />
              <Text style={styles.loadingText}>Loading synced lyrics…</Text>
            </View>
          ) : !hasLyrics ? (
            <View style={styles.centerState}>
              <Ionicons name="musical-notes-outline" size={44} color="#5A5A5A" />
              <Text style={styles.emptyTitle}>No lyrics found</Text>
              <Text style={styles.emptySubtitle}>
                Synced lyrics aren’t available for this song yet.
              </Text>
            </View>
          ) : transcriptions.length > 0 ? (
            <ScrollView
              ref={scrollViewRef}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollList}
              onScrollBeginDrag={handleScrollBeginDrag}
            >
              <View style={{ height: 32 }} />
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
                        isPast && styles.lyricLineTextPast,
                        isActive && styles.lyricLineTextActive,
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
              <View style={{ height: 32 }} />
              <Text style={styles.plainLyricsText}>{plainLyrics}</Text>
              <View style={{ height: 160 }} />
            </ScrollView>
          ) : null}

          {showSyncButton && transcriptions.length > 0 ? (
            <TouchableOpacity
              style={styles.floatingSyncBtn}
              activeOpacity={0.85}
              onPress={handleResyncPress}
            >
              <Ionicons name="refresh" size={15} color="#000000" />
              <Text style={styles.floatingSyncText}>Sync with audio</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Full-width Bottom Playback Dock */}
        <View
          style={[
            styles.playbackDock,
            {
              paddingBottom: Math.max(16, insets.bottom + 8),
            },
          ]}
        >
          <View style={styles.progressRow}>
            <Text style={styles.dockTimeText}>{formatDuration(displayTime)}</Text>
            <View
              style={styles.dockTrackTouchArea}
              onLayout={(e) => {
                const w = e.nativeEvent.layout.width;
                if (w > 0) setProgressBarWidth(w);
              }}
              onStartShouldSetResponder={() => true}
              onMoveShouldSetResponder={() => true}
              onResponderGrant={handleSeekStart}
              onResponderMove={handleSeekMove}
              onResponderRelease={handleSeekEnd}
              onResponderTerminate={handleSeekCancel}
              onResponderTerminationRequest={() => false}
            >
              <View style={[styles.dockTrack, isScrubbing && styles.dockTrackActive]}>
                <View style={[styles.dockFill, { width: `${progressPercent}%` }]} />
              </View>
            </View>
            <Text style={styles.dockTimeText}>{formatDuration(effectiveDuration)}</Text>
          </View>

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
                  size={28}
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
