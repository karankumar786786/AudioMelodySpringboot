import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { Ionicons } from "@expo/vector-icons";
import { audioPlayerService } from "@/service/audioPlayerService";
import { formatDuration } from "@/utils/formatUtils";

interface FullVideoPlayerModalProps {
  visible: boolean;
  videoStreamUrl?: string;
  initialTime?: number;
  title: string;
  artistName: string;
  onClose: (finalTimestamp: number) => void;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

export function FullVideoPlayerModal({
  visible,
  videoStreamUrl,
  initialTime = 0,
  title,
  artistName,
  onClose,
}: FullVideoPlayerModalProps) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(initialTime);
  const [duration, setDuration] = useState(0);
  const [isBuffering, setIsBuffering] = useState(true);
  const currentTimeRef = useRef(initialTime);

  const player = useVideoPlayer(videoStreamUrl || "", (p) => {
    p.loop = false;
    p.muted = false;
    if (initialTime > 0) {
      p.currentTime = initialTime;
    }
    p.play();
  });

  useEffect(() => {
    if (!visible || !videoStreamUrl) return;

    // Pause audio service when video modal opens
    audioPlayerService.pause();

    if (player) {
      player.loop = false;
      player.muted = false;
      if (initialTime > 0) {
        player.currentTime = initialTime;
      }
      player.play();
      setIsPlaying(true);
    }
  }, [visible, videoStreamUrl]);

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
    // Return timestamp to parent so audio can resume at the exact position
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

  if (!visible || !videoStreamUrl) return null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        {/* Top Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.closeBtn}
            hitSlop={14}
            onPress={handleClose}
          >
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.titleInfo}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            <Text style={styles.artist} numberOfLines={1}>
              {artistName}
            </Text>
          </View>

          <View style={styles.placeholder} />
        </View>

        {/* Video Surface */}
        <View style={styles.videoWrapper}>
          <VideoView
            player={player}
            style={styles.videoView}
            contentFit="contain"
            nativeControls={false}
            allowsPictureInPicture
          />

          {isBuffering ? (
            <View style={styles.loaderOverlay}>
              <ActivityIndicator size="large" color="#FFFFFF" />
            </View>
          ) : null}
        </View>

        {/* Bottom Controls */}
        <View style={styles.controlsSection}>
          {/* Progress row */}
          <View style={styles.progressRow}>
            <Text style={styles.timeLabel}>{formatDuration(currentTime)}</Text>
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
            <Text style={styles.timeLabel}>{formatDuration(duration)}</Text>
          </View>

          {/* Action buttons */}
          <View style={styles.buttonsRow}>
            <TouchableOpacity
              style={styles.controlBtn}
              hitSlop={12}
              onPress={() => handleSeek(-10)}
            >
              <Ionicons name="play-back-outline" size={26} color="#FFFFFF" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.playPauseBtn}
              onPress={handleTogglePlay}
            >
              <Ionicons
                name={isPlaying ? "pause" : "play"}
                size={34}
                color="#000000"
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.controlBtn}
              hitSlop={12}
              onPress={() => handleSeek(10)}
            >
              <Ionicons name="play-forward-outline" size={26} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 54,
    paddingHorizontal: 16,
    paddingBottom: 12,
    zIndex: 10,
  },
  closeBtn: {
    padding: 6,
  },
  titleInfo: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 10,
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
  placeholder: {
    width: 40,
  },
  videoWrapper: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  videoView: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * (9 / 16),
  },
  loaderOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },
  controlsSection: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
  },
  timeLabel: {
    color: "#AAAAAA",
    fontSize: 12,
    width: 40,
    textAlign: "center",
  },
  progressTrack: {
    flex: 1,
    height: 4,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 2,
    marginHorizontal: 10,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#1DB954",
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
  },
});
