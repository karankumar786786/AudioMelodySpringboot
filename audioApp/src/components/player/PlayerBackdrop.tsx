import { View, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { CanvasVideoPlayer } from "@/components/common/CanvasVideoPlayer";
import { songStyles as styles } from "@/styles";

const CANVAS_SCRIM_COLORS = [
  "rgba(0, 0, 0, 0.72)",
  "rgba(0, 0, 0, 0.2)",
  "rgba(0, 0, 0, 0.4)",
  "rgba(18, 18, 18, 0.94)",
  "#121212",
] as const;

export interface PlayerBackdropProps {
  posterUrl?: string;
  gradientColors: readonly [string, string, ...string[]];
  /** When set, a full-screen canvas video is drawn over the blurred artwork. */
  canvas?: { videoUrl?: string; videoKey: string; isPlaying: boolean } | null;
}

/** Blurred artwork + dominant-colour gradient, optionally overlaid by the canvas video. */
export function PlayerBackdrop({ posterUrl, gradientColors, canvas }: PlayerBackdropProps) {
  return (
    <>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {posterUrl ? (
          <Image
            source={{ uri: posterUrl }}
            style={styles.ambientBlurImage}
            contentFit="cover"
            blurRadius={65}
            cachePolicy="memory"
          />
        ) : null}
        <LinearGradient
          colors={gradientColors}
          locations={[0, 0.28, 0.58, 0.88, 1]}
          style={StyleSheet.absoluteFill}
        />
      </View>

      {canvas ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <CanvasVideoPlayer
            videoUrl={canvas.videoUrl}
            videoKey={canvas.videoKey}
            fallbackImageKey={null}
            isPlaying={canvas.isPlaying}
            contentFit="cover"
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={CANVAS_SCRIM_COLORS}
            locations={[0, 0.28, 0.6, 0.88, 1]}
            style={StyleSheet.absoluteFill}
          />
        </View>
      ) : null}
    </>
  );
}
