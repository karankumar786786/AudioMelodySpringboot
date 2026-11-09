import React, { useState, memo } from "react";
import {
  View,
  Text,
  GestureResponderEvent,
  Dimensions,
} from "react-native";
import { useSelector } from "react-redux";
import { AppState } from "@/store/hook";
import { formatDuration } from "@/utils/formatUtils";
import { hapticFeedback } from "@/utils/haptics";
import { songStyles as styles } from "@/styles";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SIDE = 18;

interface PlayerScrubberProps {
  duration: number;
  bufferedTime: number;
  onSeek: (targetSeconds: number) => void;
}

export const PlayerScrubber = memo(function PlayerScrubber({
  duration,
  bufferedTime,
  onSeek,
}: PlayerScrubberProps) {
  // Isolate high-frequency currentTime subscription so parent components don't re-render on audio ticks
  const currentTime = useSelector((state: AppState) => state.player.currentTime);

  const [progressBarWidth, setProgressBarWidth] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubTime, setScrubTime] = useState<number | null>(null);

  const effectiveDuration = duration > 0 ? duration : 0;
  const displayTime = isScrubbing && scrubTime !== null ? scrubTime : currentTime;
  const progressPercent =
    effectiveDuration > 0
      ? Math.min(100, Math.max(0, (displayTime / effectiveDuration) * 100))
      : 0;

  const effectiveBuffer = Math.max(bufferedTime, displayTime);
  const bufferPercent =
    effectiveDuration > 0
      ? Math.min(100, Math.max(progressPercent, (effectiveBuffer / effectiveDuration) * 100))
      : 0;

  const calculateSecondsFromEvent = (e: GestureResponderEvent) => {
    const barWidth =
      progressBarWidth > 0 ? progressBarWidth : SCREEN_WIDTH - SIDE * 2;
    const { locationX } = e.nativeEvent;
    const ratio = Math.max(0, Math.min(1, locationX / barWidth));
    return ratio * effectiveDuration;
  };

  const handleSeekStart = (e: GestureResponderEvent) => {
    hapticFeedback.selection();
    const targetSeconds = calculateSecondsFromEvent(e);
    setIsScrubbing(true);
    setScrubTime(targetSeconds);
  };

  const handleSeekMove = (e: GestureResponderEvent) => {
    const targetSeconds = calculateSecondsFromEvent(e);
    setScrubTime(targetSeconds);
  };

  const handleSeekEnd = (e: GestureResponderEvent) => {
    hapticFeedback.medium();
    const targetSeconds = calculateSecondsFromEvent(e);
    setIsScrubbing(false);
    setScrubTime(null);
    onSeek(targetSeconds);
  };

  const handleSeekCancel = () => {
    setIsScrubbing(false);
    setScrubTime(null);
  };

  return (
    <View style={styles.progressContainer}>
      <View
        style={styles.progressBarTouchArea}
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
        hitSlop={{ top: 14, bottom: 14, left: 0, right: 0 }}
      >
        <View style={styles.progressBarBackground} pointerEvents="none">
          {/* Buffered Track Bar */}
          <View
            style={[styles.progressBarBuffer, { width: `${bufferPercent}%` }]}
            pointerEvents="none"
          />
          {/* Active Played Progress Fill Bar */}
          <View
            style={[styles.progressBarFill, { width: `${progressPercent}%` }]}
            pointerEvents="none"
          >
            {/* Scrubber Knob (Enlarges on touch) */}
            <View
              style={[
                styles.progressThumb,
                isScrubbing && styles.progressThumbActive,
              ]}
            />
          </View>
        </View>
      </View>

      {/* Time Labels */}
      <View style={styles.timeRow}>
        <Text
          style={[
            styles.timeText,
            isScrubbing && styles.timeTextScrubbing,
          ]}
        >
          {formatDuration(displayTime)}
        </Text>
        <Text style={styles.timeText}>
          {formatDuration(effectiveDuration)}
        </Text>
      </View>
    </View>
  );
});
