import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  useWindowDimensions,
  GestureResponderEvent,
  Platform,
  AppState as RNAppState,
  Animated,
} from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import * as ScreenOrientation from "expo-screen-orientation";
import { Ionicons } from "@expo/vector-icons";
import { useSelector } from "react-redux";
import { store, AppState } from "@/store/hook";
import { audioPlayerService } from "@/service/audioPlayerService";
import { formatDuration } from "@/utils/formatUtils";
import { configureAudioPriority } from "@/utils/audioConfig";
import { useHlsQualities } from "@/hooks/useHlsQualities";
import { PlayerSettingsModal, VideoResizeMode } from "./PlayerSettingsModal";
import { hapticFeedback } from "@/utils/haptics";

interface ResizeModeConfig {
  key: VideoResizeMode;
  label: string;
  badgeLabel: string;
  iconName: keyof typeof Ionicons.glyphMap;
  description: string;
}

const RESIZE_MODES: ResizeModeConfig[] = [
  {
    key: "fit",
    label: "Fit",
    badgeLabel: "Fit to Screen",
    iconName: "scan-outline",
    description: "Entire video visible without cropping",
  },
  {
    key: "16:9",
    label: "16:9",
    badgeLabel: "16:9 Widescreen",
    iconName: "tv-outline",
    description: "Standard 16:9 widescreen ratio",
  },
  {
    key: "cover",
    label: "Fill",
    badgeLabel: "Fill Screen (Zoom)",
    iconName: "expand-outline",
    description: "Fills display without black borders",
  },
  {
    key: "fill",
    label: "Stretch",
    badgeLabel: "Stretch to Fit",
    iconName: "resize-outline",
    description: "Stretched to fill all screen edges",
  },
];

interface FullVideoPlayerModalProps {
  visible: boolean;
  videoStreamUrl?: string;
  initialTime?: number;
  title: string;
  artistName: string;
  artworkUrl?: string;
  onClose: (finalTimestamp: number) => void;
  onTrackEnd?: () => void;
}

const applyRate = (targetPlayer: any, rate: number) => {
  try {
    if (typeof targetPlayer?.setPlaybackRate === "function") {
      targetPlayer.setPlaybackRate(rate);
    } else if (targetPlayer) {
      targetPlayer.playbackRate = rate;
    }
  } catch {}
};

export function FullVideoPlayerModal({
  visible,
  videoStreamUrl,
  initialTime = 0,
  title,
  artistName,
  artworkUrl,
  onClose,
  onTrackEnd,
}: FullVideoPlayerModalProps) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isLandscape = windowWidth > windowHeight;

  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(initialTime);
  const [duration, setDuration] = useState(0);
  const [bufferedTime, setBufferedTime] = useState(0);
  const [isBuffering, setIsBuffering] = useState(true);
  const [progressBarWidth, setProgressBarWidth] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubTime, setScrubTime] = useState<number | null>(null);
  const currentTimeRef = useRef(initialTime);
  const seekTargetRef = useRef<number | null>(null);
  const prevUrlRef = useRef<string | undefined>(visible ? videoStreamUrl : undefined);
  const isHandlingEndRef = useRef(false);

  // Aspect ratio / resize mode state
  const [resizeMode, setResizeMode] = useState<VideoResizeMode>("fit");
  const [hudMessage, setHudMessage] = useState<{
    text: string;
    icon: keyof typeof Ionicons.glyphMap;
  } | null>(null);
  const hudOpacity = useRef(new Animated.Value(0)).current;
  const hudTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showHudToast = (text: string, icon: keyof typeof Ionicons.glyphMap) => {
    if (hudTimeoutRef.current) {
      clearTimeout(hudTimeoutRef.current);
    }
    setHudMessage({ text, icon });
    Animated.timing(hudOpacity, {
      toValue: 1,
      duration: 150,
      useNativeDriver: true,
    }).start();

    hudTimeoutRef.current = setTimeout(() => {
      Animated.timing(hudOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setHudMessage(null);
      });
    }, 1200);
  };

  const handleCycleResizeMode = () => {
    hapticFeedback.light();
    setResizeMode((prev) => {
      const idx = RESIZE_MODES.findIndex((m) => m.key === prev);
      const nextIdx = (idx + 1) % RESIZE_MODES.length;
      const nextMode = RESIZE_MODES[nextIdx];
      showHudToast(nextMode.badgeLabel, nextMode.iconName);
      return nextMode.key;
    });
  };

  const currentModeConfig = useMemo(() => {
    return RESIZE_MODES.find((m) => m.key === resizeMode) || RESIZE_MODES[0];
  }, [resizeMode]);

  const contentFitProp: "contain" | "cover" | "fill" = useMemo(() => {
    switch (resizeMode) {
      case "cover":
        return "cover";
      case "fill":
        return "fill";
      case "16:9":
      case "fit":
      default:
        return "contain";
    }
  }, [resizeMode]);

  const videoViewStyle = useMemo(() => {
    if (resizeMode === "16:9") {
      if (isLandscape) {
        return styles.videoViewLandscape;
      }
      return [
        styles.videoViewPortrait,
        { width: windowWidth, height: windowWidth * (9 / 16) },
      ];
    }
    return isLandscape ? styles.videoViewLandscape : styles.videoViewFullScreen;
  }, [resizeMode, isLandscape, windowWidth]);

  // Redux Queue & Player State
  const repeatMode = useSelector((state: AppState) => state.queue.repeatMode);
  const selectedQuality = useSelector(
    (state: AppState) => state.player.selectedQuality ?? "auto"
  );

  // Renditions that actually exist in this video's master playlist
  const { variants } = useHlsQualities(visible ? videoStreamUrl : undefined);

  const applyQualityConstraint = (quality: string | null | undefined) => {
    if (!player) return;
    if (!quality || quality === "auto") {
      player.maxResolution = null;
    } else {
      const picked = variants.find((v) => v.id === quality);
      if (picked && picked.width > 0 && picked.height > 0) {
        player.maxResolution = { width: picked.width, height: picked.height };
      } else {
        player.maxResolution = null;
      }
    }
  };

  useEffect(() => {
    if (visible) {
      ScreenOrientation.unlockAsync().catch(() => {});
    } else {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    }
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    };
  }, [visible]);

  const videoSource = visible && videoStreamUrl ? videoStreamUrl : "";

  const player = useVideoPlayer(videoSource, (p) => {
    p.loop = false;
    p.muted = false;
    p.staysActiveInBackground = false;
    p.audioMixingMode = "doNotMix";
    const savedRate = store.getState().player.playbackRate || 1;
    applyRate(p, savedRate);
    if (visible) {
      if (initialTime > 0) {
        p.currentTime = initialTime;
      }
      p.play();
    } else {
      p.pause();
    }
  });

  const handleVideoEnd = () => {
    if (isHandlingEndRef.current) return;

    if (repeatMode === "one") {
      if (player) {
        player.currentTime = 0;
        currentTimeRef.current = 0;
        setCurrentTime(0);
        seekTargetRef.current = null;
        player.play();
        setIsPlaying(true);
      }
      return;
    }

    if (onTrackEnd) {
      isHandlingEndRef.current = true;
      onTrackEnd();
    } else {
      setIsPlaying(false);
    }
  };

  useEffect(() => {
    if (!visible) {
      player?.pause();
      configureAudioPriority(true).catch(() => {});
      return;
    }

    audioPlayerService.pause();

    if (player) {
      player.loop = false;
      player.muted = false;
      player.staysActiveInBackground = false;
      player.audioMixingMode = "doNotMix";
      const savedRate = store.getState().player.playbackRate || 1;
      applyRate(player, savedRate);

      const isNewUrl = prevUrlRef.current !== videoStreamUrl;
      prevUrlRef.current = videoStreamUrl;
      isHandlingEndRef.current = false;

      if (isNewUrl) {
        // Track transition: new song starts cleanly at 0:00
        player.currentTime = 0;
        currentTimeRef.current = 0;
        setCurrentTime(0);
        seekTargetRef.current = null;
      } else if (initialTime > 0) {
        // First mount opening video from existing audio timestamp
        player.currentTime = initialTime;
        currentTimeRef.current = initialTime;
        setCurrentTime(initialTime);
      }
      player.play();
      setIsPlaying(true);
    }
  }, [visible, videoStreamUrl]);

  // Pause video immediately if phone is locked or app goes into background
  useEffect(() => {
    if (!player) return;
    const sub = RNAppState.addEventListener("change", (nextState) => {
      if (nextState !== "active") {
        player.pause();
        setIsPlaying(false);
        configureAudioPriority(true).catch(() => {});
      }
    });
    return () => {
      sub.remove();
    };
  }, [player]);

  // Listen to native playToEnd event from expo-video
  useEffect(() => {
    if (!player) return;

    const subscription = player.addListener("playToEnd", () => {
      handleVideoEnd();
    });

    return () => {
      subscription?.remove();
    };
  }, [player, repeatMode, onTrackEnd]);

  // Keep resolution constrained to selected quality without replacing master playlist,
  // which preserves the demuxed audio track and avoids synchronous replace warnings.
  useEffect(() => {
    applyQualityConstraint(selectedQuality);
  }, [selectedQuality, variants, player]);

  useEffect(() => {
    return () => {
      player?.pause();
      configureAudioPriority(true).catch(() => {});
    };
  }, [player]);

  useEffect(() => {
    if (!player) return;

    const interval = setInterval(() => {
      if (player) {
        const time = player.currentTime || 0;
        const dur = player.duration || 0;
        const buf =
          typeof player.bufferedPosition === "number" && player.bufferedPosition >= 0
            ? player.bufferedPosition
            : 0;
        currentTimeRef.current = time;
        if (!isScrubbing) {
          if (seekTargetRef.current !== null) {
            if (Math.abs(time - seekTargetRef.current) <= 1.5) {
              seekTargetRef.current = null;
              setCurrentTime(time);
            }
          } else {
            setCurrentTime(time);
          }
        }
        setDuration(dur);
        setBufferedTime(buf);
        setIsBuffering(player.status === "loading");
        setIsPlaying(player.playing);

        // Fallback EOF check if native playToEnd event is missed or not supported
        if (
          dur > 0 &&
          time >= dur - 0.5 &&
          !player.playing &&
          !isScrubbing &&
          !isHandlingEndRef.current
        ) {
          handleVideoEnd();
        }
      }
    }, 500);

    return () => clearInterval(interval);
  }, [player, isScrubbing, repeatMode, onTrackEnd]);

  const handleClose = () => {
    const finalTime = currentTimeRef.current;
    if (player) {
      player.pause();
    }
    configureAudioPriority(true).catch(() => {});
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    onClose(finalTime);
  };

  const handleToggleOrientation = async () => {
    try {
      hapticFeedback.light();
      if (isLandscape) {
        // Explicitly force to portrait mode without needing device auto-rotate
        await ScreenOrientation.lockAsync(
          ScreenOrientation.OrientationLock.PORTRAIT_UP
        );
      } else {
        // Explicitly force to landscape mode
        await ScreenOrientation.lockAsync(
          ScreenOrientation.OrientationLock.LANDSCAPE_RIGHT
        );
      }
    } catch (err) {
      console.warn("Failed to toggle orientation:", err);
    }
  };

  const handleTogglePlay = () => {
    if (!player) return;
    if (player.playing) {
      player.pause();
      setIsPlaying(false);
    } else {
      const cur = currentTimeRef.current || currentTime;
      if (duration > 0 && cur >= duration - 0.5) {
        player.currentTime = 0;
        currentTimeRef.current = 0;
        setCurrentTime(0);
        seekTargetRef.current = null;
      }
      player.play();
      setIsPlaying(true);
    }
  };

  const handleSeek = (offsetSec: number) => {
    if (!player) return;
    const target = Math.max(0, Math.min(duration, (currentTimeRef.current || currentTime) + offsetSec));
    seekTargetRef.current = target;
    player.currentTime = target;
    currentTimeRef.current = target;
    setCurrentTime(target);
  };

  const calculateTargetFromEvent = (e: GestureResponderEvent) => {
    if (progressBarWidth <= 0 || duration <= 0) return 0;
    const { locationX } = e.nativeEvent;
    const ratio = Math.max(0, Math.min(1, locationX / progressBarWidth));
    return ratio * duration;
  };

  const handleSeekStart = (e: GestureResponderEvent) => {
    const target = calculateTargetFromEvent(e);
    setIsScrubbing(true);
    setScrubTime(target);
  };

  const handleSeekMove = (e: GestureResponderEvent) => {
    const target = calculateTargetFromEvent(e);
    setScrubTime(target);
  };

  const handleSeekEnd = (e: GestureResponderEvent) => {
    if (!player || duration <= 0) {
      setIsScrubbing(false);
      setScrubTime(null);
      return;
    }
    const target = calculateTargetFromEvent(e);
    setIsScrubbing(false);
    setScrubTime(null);
    seekTargetRef.current = target;
    player.currentTime = target;
    currentTimeRef.current = target;
    setCurrentTime(target);
  };

  const handleSeekCancel = () => {
    setIsScrubbing(false);
    setScrubTime(null);
  };

  if (!visible || !videoStreamUrl) return null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      onRequestClose={handleClose}
      supportedOrientations={["portrait", "landscape-left", "landscape-right"]}
    >
      <View style={[styles.container, isLandscape && styles.containerLandscape]}>
        {/* 1. Underlying Video Player */}
        <View
          style={[styles.videoWrapper, isLandscape && styles.videoWrapperLandscape]}
          pointerEvents="none"
        >
          <VideoView
            player={player}
            style={videoViewStyle}
            contentFit={contentFitProp}
            nativeControls={false}
            allowsPictureInPicture={false}
            startsPictureInPictureAutomatically={false}
          />

          {isBuffering ? (
            <View style={styles.loaderOverlay} pointerEvents="none">
              <ActivityIndicator size="large" color="#FFFFFF" />
            </View>
          ) : null}
        </View>

        {/* 2. Full-Screen Backdrop Touch Handler: Tapping screen toggles showControls useState */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => setShowControls((prev) => !prev)}
        />

        {/* Floating HUD feedback when toggling resize mode */}
        {hudMessage ? (
          <Animated.View
            style={[styles.hudToastOverlay, { opacity: hudOpacity }]}
            pointerEvents="none"
          >
            <View style={styles.hudToastBox}>
              <Ionicons
                name={hudMessage.icon}
                size={20}
                color="#FFFFFF"
                style={{ marginRight: 8 }}
              />
              <Text style={styles.hudToastText}>{hudMessage.text}</Text>
            </View>
          </Animated.View>
        ) : null}

        {/* 3. Top Header Overlay */}
        {showControls ? (
          <View style={[styles.header, isLandscape && styles.headerLandscape]}>
            <TouchableOpacity
              style={styles.iconCircleBtn}
              hitSlop={14}
              onPress={handleClose}
              activeOpacity={0.75}
            >
              <Ionicons name="close" size={22} color="#FFFFFF" />
            </TouchableOpacity>

            <View style={styles.titleInfo}>
              <Text style={styles.title} numberOfLines={1}>
                {title}
              </Text>
              <Text style={styles.artist} numberOfLines={1}>
                {artistName}
              </Text>
            </View>

            <View style={styles.headerRightActions}>
              {/* Aspect Ratio / Fit to Screen button */}
              <TouchableOpacity
                style={styles.fitModeBtn}
                hitSlop={8}
                onPress={handleCycleResizeMode}
                activeOpacity={0.75}
                accessibilityLabel={`Aspect ratio: ${currentModeConfig.badgeLabel}`}
              >
                <Ionicons
                  name={currentModeConfig.iconName}
                  size={15}
                  color="#FFFFFF"
                />
                <Text style={styles.fitModeBtnText}>{currentModeConfig.label}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.iconCircleBtn}
                hitSlop={14}
                onPress={() => setIsSettingsOpen(true)}
                activeOpacity={0.75}
              >
                <Ionicons name="settings-outline" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

          {/* Bottom Controls Overlay */}
          {showControls ? (
            <View style={[styles.controlsSection, isLandscape && styles.controlsSectionLandscape]}>
              <View style={styles.progressRow}>
                <Text style={styles.timeLabel}>{formatDuration(isScrubbing && scrubTime !== null ? scrubTime : currentTime)}</Text>
                <View
                  style={styles.progressTouchArea}
                  onLayout={(e) => setProgressBarWidth(e.nativeEvent.layout.width)}
                  onStartShouldSetResponder={() => true}
                  onMoveShouldSetResponder={() => true}
                  onResponderGrant={handleSeekStart}
                  onResponderMove={handleSeekMove}
                  onResponderRelease={handleSeekEnd}
                  onResponderTerminate={handleSeekCancel}
                  onResponderTerminationRequest={() => false}
                >
                  <View style={styles.progressTrack} pointerEvents="none">
                    <View
                      style={[
                        styles.progressBuffer,
                        {
                          width: `${
                            duration > 0
                              ? Math.min(100, Math.max(0, (bufferedTime / duration) * 100))
                              : 0
                          }%`,
                        },
                      ]}
                      pointerEvents="none"
                    />
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${
                            duration > 0
                              ? ((isScrubbing && scrubTime !== null ? scrubTime : currentTime) / duration) * 100
                              : 0
                          }%`,
                        },
                      ]}
                      pointerEvents="none"
                    />
                  </View>
                </View>
                <Text style={styles.timeLabel}>{formatDuration(duration)}</Text>
                <TouchableOpacity
                  style={styles.controlIconBtn}
                  hitSlop={10}
                  onPress={handleCycleResizeMode}
                  activeOpacity={0.75}
                  accessibilityLabel={`Toggle aspect ratio: ${currentModeConfig.badgeLabel}`}
                >
                  <Ionicons
                    name={currentModeConfig.iconName}
                    size={20}
                    color="#FFFFFF"
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.orientationBtn}
                  hitSlop={12}
                  onPress={handleToggleOrientation}
                  activeOpacity={0.75}
                  accessibilityLabel={
                    isLandscape ? "Switch to portrait" : "Switch to landscape"
                  }
                >
                  <Ionicons
                    name={isLandscape ? "phone-portrait-outline" : "scan-outline"}
                    size={20}
                    color="#FFFFFF"
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.buttonsRow}>
                <TouchableOpacity
                  style={styles.controlBtn}
                  hitSlop={14}
                  onPress={() => handleSeek(-10)}
                  activeOpacity={0.75}
                >
                  <Ionicons name="play-back-outline" size={26} color="#FFFFFF" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.playPauseBtn}
                  onPress={handleTogglePlay}
                  activeOpacity={0.88}
                >
                  <Ionicons
                    name={
                      isPlaying
                        ? "pause"
                        : duration > 0 && (currentTimeRef.current || currentTime) >= duration - 0.5
                        ? "reload"
                        : "play"
                    }
                    size={32}
                    color="#000000"
                    style={
                      isPlaying || (duration > 0 && (currentTimeRef.current || currentTime) >= duration - 0.5)
                        ? undefined
                        : { marginLeft: 3 }
                    }
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.controlBtn}
                  hitSlop={14}
                  onPress={() => handleSeek(10)}
                  activeOpacity={0.75}
                >
                  <Ionicons name="play-forward-outline" size={26} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          <PlayerSettingsModal
            visible={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            mode="video"
            useNativeModal={false}
            videoQualities={variants.map((v) => ({ id: v.id, label: v.label }))}
            resizeMode={resizeMode}
            onResizeModeChange={(newMode) => {
              setResizeMode(newMode);
              const target = RESIZE_MODES.find((m) => m.key === newMode);
              if (target) {
                showHudToast(target.badgeLabel, target.iconName);
              }
            }}
            onSpeedChange={(rate) => {
              applyRate(player, rate);
            }}
            onQualityChange={(quality) => {
              applyQualityConstraint(quality);
            }}
          />
        </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
    position: "relative",
  },
  containerLandscape: { position: "relative" },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: Platform.OS === "ios" ? 54 : 28,
    paddingHorizontal: 18,
    paddingBottom: 12,
    zIndex: 20,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  headerLandscape: {
    paddingTop: Platform.OS === "ios" ? 20 : 12,
    paddingHorizontal: 32,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
  },
  headerRightActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconCircleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#151515",
    borderWidth: 1,
    borderColor: "#262626",
    justifyContent: "center",
    alignItems: "center",
  },
  fitModeBtn: {
    flexDirection: "row",
    alignItems: "center",
    height: 38,
    paddingHorizontal: 12,
    borderRadius: 19,
    backgroundColor: "#151515",
    borderWidth: 1,
    borderColor: "#262626",
    gap: 6,
  },
  fitModeBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  titleInfo: { flex: 1, alignItems: "center", paddingHorizontal: 16 },
  title: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  artist: { color: "#8A8A8A", fontSize: 12, marginTop: 2 },
  videoWrapper: {
    ...StyleSheet.absoluteFill,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000000",
  },
  videoWrapperLandscape: { ...StyleSheet.absoluteFill },
  videoViewPortrait: { backgroundColor: "#000000" },
  videoViewLandscape: { width: "100%", height: "100%", backgroundColor: "#000000" },
  videoViewFullScreen: {
    width: "100%",
    height: "100%",
    backgroundColor: "#000000",
  },
  hudToastOverlay: {
    position: "absolute",
    top: "46%",
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 35,
  },
  hudToastBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(18, 18, 18, 0.88)",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.16)",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  hudToastText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  loaderOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },
  controlsSection: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 18,
    paddingBottom: Platform.OS === "ios" ? 36 : 20,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    zIndex: 20,
  },
  controlsSectionLandscape: {
    paddingHorizontal: 40,
    paddingBottom: Platform.OS === "ios" ? 24 : 14,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
  },
  progressRow: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  progressTouchArea: { flex: 1, paddingVertical: 10, marginHorizontal: 8 },
  timeLabel: {
    color: "#8A8A8A",
    fontSize: 12,
    width: 44,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  progressTrack: {
    height: 4,
    backgroundColor: "#262626",
    borderRadius: 2,
    position: "relative",
    overflow: "hidden",
  },
  progressBuffer: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(255, 255, 255, 0.4)",
    borderRadius: 2,
  },
  progressFill: { height: "100%", backgroundColor: "#FFFFFF" },
  buttonsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 36,
  },
  controlBtn: { padding: 8 },
  controlIconBtn: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  orientationBtn: {
    paddingLeft: 8,
    paddingRight: 2,
    paddingVertical: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  playPauseBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },
});