import React, { useEffect, useRef, useState } from "react";
import { View, StyleSheet, StyleProp, ViewStyle, ActivityIndicator } from "react-native";
import { useVideoPlayer, VideoView, setVideoCacheSizeAsync } from "expo-video";
import { Image } from "expo-image";
import { getImageUrl, getVideoUrl } from "@/utils/imageUtils";

// Ensure native video cache is configured (512MB) for smooth looping
setVideoCacheSizeAsync(512 * 1024 * 1024).catch(() => {});

// In-memory cache registry for active/preloaded canvas videos
const canvasMemoryCache = new Set<string>();

interface CanvasVideoPlayerProps {
  videoUrl?: string | null;
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

  // Track canvas video in memory cache
  useEffect(() => {
    if (videoUrl && !canvasMemoryCache.has(videoUrl)) {
      canvasMemoryCache.add(videoUrl);
    }
  }, [videoUrl]);

  // Use VideoSource object with useCaching: true to cache the MP4 video locally in memory/disk
  const videoSource = React.useMemo(
    () => ({
      uri: videoUrl,
      useCaching: true,
    }),
    [videoUrl]
  );

  const player = useVideoPlayer(videoSource, (p) => {
    p.loop = true;
    p.muted = true;
    p.volume = 0;
    if (isPlaying) {
      p.play();
    } else {
      p.pause();
    }
  });

  useEffect(() => {
    player.loop = true;
    player.muted = true;
    player.volume = 0;

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
      pointerEvents="none"
    />
  );
}

export function CanvasVideoPlayer({
  videoUrl: directVideoUrl,
  videoKey,
  fallbackImageKey,
  style,
  isPlaying = true,
  showLoaderWhenVideoAvailable = false,
}: CanvasVideoPlayerProps) {
  // Use direct video URL without dynamic transformation (matches audioFrontend RightInfoPanel: ?tr=orig)
  const videoUrl = directVideoUrl || (videoKey ? getVideoUrl(videoKey) : undefined);
  const imageUrl = getImageUrl(fallbackImageKey, {
    width: 1280,
    height: 720,
    aspectRatio: "16-9",
    focus: "auto",
    crop: "at_least",
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
    <View style={[styles.container, style]} pointerEvents="none">
      {/* Fallback poster image */}
      {shouldRenderImage ? (
        imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            cachePolicy="memory"
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
