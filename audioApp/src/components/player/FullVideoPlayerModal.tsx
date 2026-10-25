import React, { useEffect, useRef, useState } from "react";
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
} from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import * as ScreenOrientation from "expo-screen-orientation";
import { Ionicons } from "@expo/vector-icons";
import { store } from "@/store/hook";
import { audioPlayerService } from "@/service/audioPlayerService";
import { formatDuration } from "@/utils/formatUtils";
import { PlayerSettingsModal } from "./PlayerSettingsModal";

interface FullVideoPlayerModalProps {
  visible: boolean;
  videoStreamUrl?: string;
  initialTime?: number;
  title: string;
  artistName: string;
  onClose: (finalTimestamp: number) => void;
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
  onClose,
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
  const currentTimeRef = useRef(initialTime);

  // Enable auto-rotation when video modal opens, restore portrait lock when closed
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

  const player = useVideoPlayer(visible && videoStreamUrl ? videoStreamUrl : "", (p) => {
    p.loop = false;
    p.muted = false;
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

  useEffect(() => {
    if (!visible) {
      player?.pause();
      return;
    }

    if (!videoStreamUrl) return;

    // Pause background audio service when video modal opens
    audioPlayerService.pause();

    if (player) {
      player.loop = false;
      player.muted = false;
      const savedRate = store.getState().player.playbackRate || 1;
      applyRate(player, savedRate);
      if (initialTime > 0) {
        player.currentTime = initialTime;
      }
      player.play();
      setIsPlaying(true);
    }
  }, [visible, videoStreamUrl]);

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
        currentTimeRef.current = time;
        setCurrentTime(time);
        setDuration(player.duration || 0);
        setIsBuffering(player.status === "loading");
        setIsPlaying(player.playing);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [player]);

  const handleClose = () => {
    const finalTime = currentTimeRef.current;
    if (player) {
      player.pause();
    }
    // Return to portrait before closing
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    onClose(finalTime);
  };

  const handleTogglePlay = () => {
    if (!player) return;
    if (player.playing) {
      player.pause();
      setIsPlaying(false);
    } else {
      player.play();
      setIsPlaying(true);
    }
  };

  const handleSeek = (offsetSec: number) => {
    if (!player) return;
    const target = Math.max(0, Math.min(duration, currentTime + offsetSec));
    player.currentTime = target;
    setCurrentTime(target);
  };

  const handleProgressBarPress = (e: GestureResponderEvent) => {
    if (!player || progressBarWidth <= 0 || duration <= 0) return;
    const { locationX } = e.nativeEvent;
    const ratio = Math.max(0, Math.min(1, locationX / progressBarWidth));
    const target = ratio * duration;
    player.currentTime = target;
    setCurrentTime(target);
  };

  const handleToggleOrientation = async () => {
    try {
      if (isLandscape) {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      } else {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      }
      // Re-enable rotation listening after manual change
      setTimeout(() => {
        ScreenOrientation.unlockAsync().catch(() => {});
      }, 1000);
    } catch {}
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
        {/* Top Header */}
        {showControls ? (
          <View style={[styles.header, isLandscape && styles.headerLandscape]}>
            <TouchableOpacity
              style={styles.iconCircleBtn}
              hitSlop={14}
              onPress={handleClose}
              activeOpacity={0.75}
            >
              <Ionicons name="close" size={24} color="#FFFFFF" />
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

              <TouchableOpacity
                style={styles.iconCircleBtn}
                hitSlop={14}
                onPress={handleToggleOrientation}
                activeOpacity={0.75}
              >
                <Ionicons
                  name={isLandscape ? "phone-portrait-outline" : "phone-landscape-outline"}
                  size={20}
                  color="#FFFFFF"
                />
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {/* Video Surface */}
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
            allowsPictureInPicture
          />

          {isBuffering ? (
            <View style={styles.loaderOverlay}>
              <ActivityIndicator size="large" color="#FFFFFF" />
            </View>
          ) : null}
        </TouchableOpacity>

        {/* Bottom Controls */}
        {showControls ? (
          <View style={[styles.controlsSection, isLandscape && styles.controlsSectionLandscape]}>
            {/* Progress row */}
            <View style={styles.progressRow}>
              <Text style={styles.timeLabel}>{formatDuration(currentTime)}</Text>
              <TouchableOpacity
                activeOpacity={1}
                style={styles.progressTouchArea}
                onPress={handleProgressBarPress}
                onLayout={(e) => setProgressBarWidth(e.nativeEvent.layout.width)}
              >
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
                      },
                    ]}
                  />
                </View>
              </TouchableOpacity>
              <Text style={styles.timeLabel}>{formatDuration(duration)}</Text>
            </View>

            {/* Action buttons */}
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
                  name={isPlaying ? "pause" : "play"}
                  size={32}
                  color="#000000"
                  style={isPlaying ? undefined : { marginLeft: 3 }}
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

        {/* Playback Settings Modal */}
        <PlayerSettingsModal
          visible={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          mode="video"
          useNativeModal={false}
          onSpeedChange={(rate) => {
            applyRate(player, rate);
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
    justifyContent: "space-between",
  },
  containerLandscape: {
    position: "relative",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: Platform.OS === "ios" ? 54 : 28,
    paddingHorizontal: 20,
    paddingBottom: 12,
    zIndex: 20,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
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
  headerRightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconCircleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    justifyContent: "center",
    alignItems: "center",
  },
  titleInfo: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 16,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  artist: {
    color: "#AAAAAA",
    fontSize: 12,
    marginTop: 2,
  },
  videoWrapper: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000000",
  },
  videoWrapperLandscape: {
    ...StyleSheet.absoluteFill,
  },
  videoViewPortrait: {
    backgroundColor: "#000000",
  },
  videoViewLandscape: {
    width: "100%",
    height: "100%",
    backgroundColor: "#000000",
  },
  loaderOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },
  controlsSection: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === "ios" ? 36 : 20,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
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
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  progressTouchArea: {
    flex: 1,
    paddingVertical: 10,
    marginHorizontal: 8,
  },
  timeLabel: {
    color: "#AAAAAA",
    fontSize: 12,
    width: 44,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  progressTrack: {
    height: 4.5,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#FFFFFF",
  },
  buttonsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 36,
  },
  controlBtn: {
    padding: 8,
  },
  playPauseBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#FFFFFF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
});
