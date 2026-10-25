import React, { useEffect, useRef, useState } from "react";
import { View, StyleSheet, StyleProp, ViewStyle, ActivityIndicator } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { Image } from "expo-image";
import { getImageUrl, getVideoUrl } from "@/utils/imageUtils";

interface CanvasVideoPlayerProps {
  videoKey?: string | null;
  fallbackImageKey?: string | null;
  style?: StyleProp<ViewStyle>;
  isPlaying?: boolean;
  showLoaderWhenVideoAvailable?: boolean;
}

function VideoSurface({
  videoUrl,
  isPlaying = true,
  onReady,
  onError,
}: {
  videoUrl: string;
  isPlaying?: boolean;
  onReady?: () => void;
  onError?: () => void;
}) {
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

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

    const checkStatus = (status: string) => {
      if (status === "readyToPlay") {
        onReadyRef.current?.();
      } else if (status === "error") {
        onErrorRef.current?.();
      }
    };

    checkStatus(player.status);

    const statusSub = player.addListener("statusChange", ({ status }) => {
      checkStatus(status);
    });

    const playingSub = player.addListener("playingChange", ({ isPlaying: isCurrentlyPlaying }) => {
      if (isCurrentlyPlaying) {
        onReadyRef.current?.();
      }
    });

    const playEndSub = player.addListener("playToEnd", () => {
      if (isPlaying) {
        player.replay();
      }
    });

    return () => {
      statusSub.remove();
      playingSub.remove();
      playEndSub.remove();
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
  showLoaderWhenVideoAvailable = false,
}: CanvasVideoPlayerProps) {
  const videoUrl = getVideoUrl(videoKey);
  const imageUrl = getImageUrl(fallbackImageKey, {
    width: 600,
    height: 340,
    quality: 85,
  });

  const [isVideoReady, setIsVideoReady] = useState(false);
  const [videoError, setVideoError] = useState(false);

  // If video is available and showLoaderWhenVideoAvailable is active, show loader until ready
  const shouldShowLoader = Boolean(
    videoUrl && showLoaderWhenVideoAvailable && !isVideoReady && !videoError
  );
  // Only render poster image if no video, video errored, or showLoaderWhenVideoAvailable is false
  const shouldRenderImage =
    !videoUrl || videoError || (!showLoaderWhenVideoAvailable && !isVideoReady);

  return (
    <View style={[styles.container, style]}>
      {/* Fallback poster image */}
      {shouldRenderImage ? (
        imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.fallbackContainer]} />
        )
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.fallbackContainer]} />
      )}

      {/* Looping ambient canvas video */}
      {videoUrl && !videoError ? (
        <VideoSurface
          videoUrl={videoUrl}
          isPlaying={isPlaying}
          onReady={() => setIsVideoReady(true)}
          onError={() => setVideoError(true)}
        />
      ) : null}

      {/* Loader displayed directly when canvas video is available and still buffering */}
      {shouldShowLoader ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="small" color="#FFFFFF" />
        </View>
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
    backgroundColor: "#121212",
  },
  loaderContainer: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#121212",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2,
  },
});
