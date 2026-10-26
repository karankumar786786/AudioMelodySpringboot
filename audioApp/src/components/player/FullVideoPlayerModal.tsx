import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  useWindowDimensions,
  GestureResponderEvent,
  Platform,
  AppState as RNAppState,
} from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import * as ScreenOrientation from "expo-screen-orientation";
import { Ionicons } from "@expo/vector-icons";
import { useSelector } from "react-redux";
import { store, AppState } from "@/store/hook";
import { audioPlayerService } from "@/service/audioPlayerService";
import { formatDuration } from "@/utils/formatUtils";
import { useHlsQualities } from "@/hooks/useHlsQualities";
import { PlayerSettingsModal } from "./PlayerSettingsModal";
import { usePanGesture, GestureDetector } from "react-native-gesture-handler";

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
    p.showNowPlayingNotification = false;
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
      return;
    }

    audioPlayerService.pause();

    if (player) {
      player.loop = false;
      player.muted = false;
      player.staysActiveInBackground = false;
      player.showNowPlayingNotification = false;
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
    };
  }, [player]);

  useEffect(() => {
    if (!player) return;

    const interval = setInterval(() => {
      if (player) {
        const time = player.currentTime || 0;
        const dur = player.duration || 0;
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
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    onClose(finalTime);
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

  const videoDismissGesture = usePanGesture({
    runOnJS: true,
    activeOffsetX: [-20, 20],
    activeOffsetY: [0, 20],
    onDeactivate: (e) => {
      const { translationX, translationY, velocityX, velocityY } = e;

      if (
        (translationX > 40 || velocityX > 250) &&
        Math.abs(translationX) > Math.abs(translationY) * 1.05
      ) {
        handleClose();
        return;
      }

      if (
        isLandscape &&
        translationY > 35 &&
        Math.abs(translationY) > Math.abs(translationX) * 0.8
      ) {
        handleClose();
        return;
      }

      if (
        !isLandscape &&
        translationY > 45 &&
        (velocityY > 200 || translationY > 75) &&
        Math.abs(translationY) > Math.abs(translationX) * 1.05
      ) {
        handleClose();
        return;
      }
    },
  });

  if (!visible || !videoStreamUrl) return null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      onRequestClose={handleClose}
      supportedOrientations={["portrait", "landscape-left", "landscape-right"]}
    >
      <GestureDetector gesture={videoDismissGesture}>
        <View style={[styles.container, isLandscape && styles.containerLandscape]}>
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

          <TouchableOpacity
            activeOpacity={1}
            style={[styles.videoWrapper, isLandscape && styles.videoWrapperLandscape]}
            onPress={() => setShowControls((prev) => !prev)}
          >
            <VideoView
              player={player}
              style={[
                isLandscape
                  ? styles.videoViewLandscape
                  : [styles.videoViewPortrait, { width: windowWidth, height: windowWidth * (9 / 16) }],
              ]}
              contentFit="contain"
              nativeControls={false}
              allowsPictureInPicture={false}
              startsPictureInPictureAutomatically={false}
            />

            {isBuffering ? (
              <View style={styles.loaderOverlay}>
                <ActivityIndicator size="large" color="#FFFFFF" />
              </View>
            ) : null}
          </TouchableOpacity>

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
            onSpeedChange={(rate) => {
              applyRate(player, rate);
            }}
            onQualityChange={(quality) => {
              applyQualityConstraint(quality);
            }}
          />
        </View>
      </GestureDetector>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
    justifyContent: "space-between",
  },
  containerLandscape: { position: "relative" },
  header: {
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
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
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
  titleInfo: { flex: 1, alignItems: "center", paddingHorizontal: 16 },
  title: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  artist: { color: "#8A8A8A", fontSize: 12, marginTop: 2 },
  videoWrapper: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000000",
  },
  videoWrapperLandscape: { ...StyleSheet.absoluteFill },
  videoViewPortrait: { backgroundColor: "#000000" },
  videoViewLandscape: { width: "100%", height: "100%", backgroundColor: "#000000" },
  loaderOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },
  controlsSection: {
    paddingHorizontal: 18,
    paddingBottom: Platform.OS === "ios" ? 36 : 20,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    zIndex: 20,
  },
  controlsSectionLandscape: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
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
    overflow: "hidden",
  },
  progressFill: { height: "100%", backgroundColor: "#FFFFFF" },
  buttonsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 36,
  },
  controlBtn: { padding: 8 },
  playPauseBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },
});