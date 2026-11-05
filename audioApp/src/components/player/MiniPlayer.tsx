import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSelector, useDispatch } from "react-redux";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import { AppState } from "@/store/hook";
import { audioPlayerService } from "@/service/audioPlayerService";
import { nextTrack, prevTrack } from "@/store/queueActions";
import { setDominantColor } from "@/store/playerSlice";
import { selectIsFavourite, toggleFavourite } from "@/store/favouriteSlice";
import { favouriteService } from "@/service";
import { hapticFeedback } from "@/utils/haptics";
import { useDominantColor } from "@/utils/colorUtils";
import { getImageUrl } from "@/utils/imageUtils";
import { colors, radii, shadows, spacing, typography } from "@/theme";

const SWIPE_THRESHOLD = 50;

export function MiniPlayer() {
  const router = useRouter();
  const dispatch = useDispatch();

  const currentSong = useSelector((state: AppState) => state.player.currentSong);
  const isPlaying = useSelector((state: AppState) => state.player.isPlaying);
  const isLoading = useSelector((state: AppState) => state.player.isLoading);
  const currentTime = useSelector((state: AppState) => state.player.currentTime);
  const duration = useSelector((state: AppState) => state.player.duration);
  const bufferedTime = useSelector((state: AppState) => state.player.bufferedTime || 0);
  const reduxDominantColor = useSelector((state: AppState) => state.player.dominantColor);
  const isLiked = useSelector((state: AppState) => selectIsFavourite(state, currentSong?.id));

  const artworkUrl = currentSong
    ? (currentSong as any).coverUrl ||
      (currentSong as any).posterUrl ||
      (currentSong.imageKey
        ? getImageUrl(currentSong.imageKey, {
            width: 400,
            height: 400,
            aspectRatio: "1-1",
          })
        : null)
    : null;

  const fallbackKey = currentSong
    ? `${currentSong.title || ""}-${currentSong.artistName || ""}-${currentSong.id || ""}`
    : "default";

  const { dominantColor: extractedColor } = useDominantColor(
    artworkUrl,
    fallbackKey
  );

  // Sync extracted dominant color into Redux store so all screens stay consistent
  useEffect(() => {
    if (extractedColor && currentSong?.id) {
      dispatch(setDominantColor(extractedColor));
    }
  }, [extractedColor, currentSong?.id, dispatch]);

  const dominantColor = extractedColor || reduxDominantColor || "#1A1A1A";

  const progressPercent =
    duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;
  const effectiveBuffer = Math.max(bufferedTime, currentTime);
  const bufferPercent =
    duration > 0 ? Math.min(100, Math.max(progressPercent, (effectiveBuffer / duration) * 100)) : 0;

  const handleOpenFullPlayer = () => {
    if (!currentSong) return;
    hapticFeedback.selection();
    router.push(`/song/${currentSong.id}`);
  };

  const handleTogglePlay = (e?: any) => {
    e?.stopPropagation?.();
    hapticFeedback.medium();
    audioPlayerService.togglePlay();
  };

  const handleNext = (e?: any) => {
    e?.stopPropagation?.();
    hapticFeedback.light();
    (dispatch as any)(nextTrack(true));
  };

  const handlePrev = () => {
    hapticFeedback.light();
    (dispatch as any)(prevTrack());
  };

  const handleToggleLike = (e?: any) => {
    e?.stopPropagation?.();
    if (!currentSong) return;
    hapticFeedback.success();
    (dispatch as any)(toggleFavourite(currentSong));
  };

  // Pan gesture: swipe horizontally to skip tracks, swipe up to expand full player
  // NOTE: No visual stretching or translation during the gesture so the miniplayer stays perfectly stable
  const panGesture = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .activeOffsetY([-20, 20])
    .onEnd((event) => {
      // Swipe Up -> Open full player
      if (event.translationY < -40) {
        runOnJS(handleOpenFullPlayer)();
      }
      // Swipe Left -> Next Track
      else if (event.translationX < -SWIPE_THRESHOLD) {
        runOnJS(handleNext)();
      }
      // Swipe Right -> Previous Track
      else if (event.translationX > SWIPE_THRESHOLD) {
        runOnJS(handlePrev)();
      }
    });

  if (!currentSong) return null;

  return (
    <GestureDetector gesture={panGesture}>
      <View
        style={[
          styles.outerContainer,
          {
            backgroundColor: dominantColor,
            borderColor: `${dominantColor}55`,
          },
        ]}
      >
        {/* Dynamic Majority Color Ambient Linear Gradient */}
        <LinearGradient
          colors={[
            `${dominantColor}FA`, // ~98% vibrant majority color at top-left
            `${dominantColor}CC`, // ~80% mid tone
            "rgba(14, 14, 14, 0.90)", // smooth deep contrast on bottom-right
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        {/* Frosted Glass Overlay */}
        <BlurView
          intensity={Platform.OS === "ios" ? 35 : 20}
          tint="dark"
          style={styles.blurContainer}
        >
          <View style={styles.contentRow}>
            {/* Track Info Touch Area */}
            <TouchableOpacity
              style={styles.trackInfoTouchArea}
              activeOpacity={0.85}
              onPress={handleOpenFullPlayer}
            >
              {artworkUrl ? (
                <Image
                  source={{ uri: artworkUrl }}
                  style={styles.artwork}
                  contentFit="cover"
                  transition={200}
                  cachePolicy="memory"
                />
              ) : (
                <View style={[styles.artwork, styles.artworkFallback]}>
                  <Ionicons name="musical-note" size={20} color="rgba(255, 255, 255, 0.7)" />
                </View>
              )}

              <View style={styles.textContainer}>
                <Text style={styles.title} numberOfLines={1}>
                  {currentSong.title}
                </Text>
                <Text style={styles.artist} numberOfLines={1}>
                  {currentSong.artistName}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Quick Actions Row */}
            <View style={styles.actionsRow}>
              {/* Like / Heart Button */}
              <TouchableOpacity
                style={styles.iconButton}
                hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
                onPress={handleToggleLike}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={isLiked ? "heart" : "heart-outline"}
                  size={20}
                  color={isLiked ? "#FF3B30" : "rgba(255, 255, 255, 0.85)"}
                />
              </TouchableOpacity>

              {/* Next Track Button */}
              <TouchableOpacity
                style={styles.iconButton}
                hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
                onPress={handleNext}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="play-skip-forward"
                  size={19}
                  color="#FFFFFF"
                />
              </TouchableOpacity>

              {/* Play / Pause Pill Button with High Contrast Solid White */}
              <TouchableOpacity
                style={styles.playButton}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
                onPress={handleTogglePlay}
                activeOpacity={0.85}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#000000" />
                ) : (
                  <Ionicons
                    name={isPlaying ? "pause" : "play"}
                    size={19}
                    color="#000000"
                    style={isPlaying ? undefined : { marginLeft: 2 }}
                  />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Active Progress Bar at the bottom edge */}
          <View style={styles.progressBarBackground}>
            <View
              style={[styles.progressBarBuffer, { width: `${bufferPercent}%` }]}
            />
            <View
              style={[styles.progressBarFill, { width: `${progressPercent}%` }]}
            />
          </View>
        </BlurView>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    marginHorizontal: spacing.sm + 2,
    marginBottom: 6,
    borderRadius: radii.lg + 2,
    overflow: "hidden",
    borderWidth: 1,
    ...shadows.md,
  },
  blurContainer: {
    overflow: "hidden",
    backgroundColor: "transparent",
  },
  contentRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 1,
  },
  trackInfoTouchArea: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    minWidth: 0,
  },
  artwork: {
    width: 44,
    height: 44,
    borderRadius: radii.md - 2,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
  },
  artworkFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  textContainer: {
    flex: 1,
    marginLeft: spacing.md,
    marginRight: spacing.sm,
    justifyContent: "center",
    minWidth: 0,
  },
  title: {
    ...typography.body1,
    color: "#FFFFFF",
    fontWeight: "700",
    marginBottom: 2,
  },
  artist: {
    ...typography.body2,
    color: "rgba(255, 255, 255, 0.8)",
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + 2,
  },
  iconButton: {
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  playButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    ...shadows.sm,
  },
  progressBarBackground: {
    height: 2.5,
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    width: "100%",
    position: "relative",
  },
  progressBarBuffer: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(255, 255, 255, 0.45)",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#FFFFFF",
  },
});
