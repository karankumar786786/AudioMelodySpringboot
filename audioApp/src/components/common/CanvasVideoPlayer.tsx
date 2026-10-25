import React, { useEffect } from "react";
import { View, StyleSheet, StyleProp, ViewStyle } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { Image } from "expo-image";
import { getImageUrl, getVideoUrl } from "@/utils/imageUtils";

interface CanvasVideoPlayerProps {
  videoKey?: string | null;
  fallbackImageKey?: string | null;
  style?: StyleProp<ViewStyle>;
  isPlaying?: boolean;
}

function VideoSurface({
  videoUrl,
  isPlaying = true,
}: {
  videoUrl: string;
  isPlaying?: boolean;
}) {
  const player = useVideoPlayer(videoUrl, (p) => {
    p.loop = true;
    p.muted = true;
    if (isPlaying) {
      p.play();
    } else {
      p.pause();
    }
  });

  useEffect(() => {
    player.loop = true;
    player.muted = true;

    if (isPlaying) {
      player.play();
    } else {
      player.pause();
    }

    // Explicitly replay when reaching the end to guarantee continuous loop across all platforms
    const subscription = player.addListener("playToEnd", () => {
      if (isPlaying) {
        player.replay();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [isPlaying, player]);

  return (
    <VideoView
      style={StyleSheet.absoluteFill}
      player={player}
      contentFit="cover"
      nativeControls={false}
      allowsPictureInPicture={false}
    />
  );
}

export function CanvasVideoPlayer({
  videoKey,
  fallbackImageKey,
  style,
  isPlaying = true,
}: CanvasVideoPlayerProps) {
  const videoUrl = getVideoUrl(videoKey);
  const imageUrl = getImageUrl(fallbackImageKey, {
    width: 600,
    height: 340,
    quality: 85,
  });

  return (
    <View style={[styles.container, style]}>
      {/* Poster image placed underneath so there is no flicker while video buffers */}
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.fallbackContainer]} />
      )}

      {/* Looping ambient canvas video */}
      {videoUrl ? (
        <VideoSurface videoUrl={videoUrl} isPlaying={isPlaying} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    position: "relative",
  },
  fallbackContainer: {
    backgroundColor: "#1A1A1A",
  },
});
