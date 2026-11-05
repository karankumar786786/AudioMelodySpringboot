import React, { useEffect, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  StyleProp,
  ViewStyle,
  ActivityIndicator,
  AppState,
} from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { Image } from "expo-image";
import { getImageUrl, getVideoUrl } from "@/utils/imageUtils";
import { configureAudioPriority } from "@/utils/audioConfig";
import { audioPlayerService } from "@/service/audioPlayerService";

interface CanvasVideoPlayerProps {
  videoUrl?: string | null;
  videoKey?: string | null;
  fallbackImageKey?: string | null;
  style?: StyleProp<ViewStyle>;
  isPlaying?: boolean;
  showLoaderWhenVideoAvailable?: boolean;
  showFallbackImage?: boolean;
  showLoader?: boolean;
  onReady?: () => void;
  onLoadingChange?: (loading: boolean) => void;
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
  onError?: (err?: any) => void;
}) {
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const hasTriggeredReady = useRef(false);

  // Reset ready trigger when URL changes
  useEffect(() => {
    hasTriggeredReady.current = false;
  }, [videoUrl]);

  // Standard VideoSource for smooth AVPlayer / ExoPlayer streaming
  const videoSource = React.useMemo(
    () => ({
      uri: videoUrl,
    }),
    [videoUrl]
  );

  const player = useVideoPlayer(videoSource, (p) => {
    p.loop = true;
    p.muted = true;
    p.volume = 0;
    p.staysActiveInBackground = false;
    p.audioMixingMode = "doNotMix";
    p.showNowPlayingNotification = false;
    if (isPlaying && AppState.currentState === "active") {
      p.play();
    } else {
      p.pause();
    }
  });

  useEffect(() => {
    player.loop = true;
    player.muted = true;
    player.volume = 0;
    player.staysActiveInBackground = false;
    player.audioMixingMode = "doNotMix";
    player.showNowPlayingNotification = false;

    // Immediately restore audio session priority and refresh lock screen
    // so expo-video's player setup cannot hijack the audio session
    const restoreSession = () => {
      configureAudioPriority(true).then(() => {
        audioPlayerService.refreshLockScreen();
      });
    };
    restoreSession();

    if (isPlaying && AppState.currentState === "active") {
      player.play();
    } else {
      player.pause();
    }

    const checkStatus = (status: string, error?: any) => {
      if (status === "readyToPlay") {
        if (!hasTriggeredReady.current) {
          hasTriggeredReady.current = true;
          onReadyRef.current?.();
          restoreSession();
        }
        if (isPlaying && AppState.currentState === "active" && !player.playing) {
          player.play();
        }
      } else if (status === "error") {
        console.warn("[CanvasVideoPlayer] ❌ Native player error:", error);
        onErrorRef.current?.(error);
      }
    };

    checkStatus(player.status);

    const statusSub = player.addListener("statusChange", ({ status, error }) => {
      checkStatus(status, error);
    });

    const playingSub = player.addListener("playingChange", ({ isPlaying: isCurrentlyPlaying }) => {
      if (isCurrentlyPlaying) {
        if (!hasTriggeredReady.current) {
          hasTriggeredReady.current = true;
          onReadyRef.current?.();
        }
        setTimeout(restoreSession, 60);
      }
    });

    const appStateSub = AppState.addEventListener("change", (nextState) => {
      if (nextState !== "active") {
        player.pause();
      } else if (isPlaying) {
        player.play();
        setTimeout(restoreSession, 60);
      }
    });

    return () => {
      try {
        statusSub.remove();
      } catch {}
      try {
        playingSub.remove();
      } catch {}
      try {
        appStateSub.remove();
      } catch {}
      try {
        player.pause();
      } catch {}
      restoreSession();
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
  showFallbackImage = true,
  showLoader = true,
  showLoaderWhenVideoAvailable,
  onReady,
  onLoadingChange,
}: CanvasVideoPlayerProps) {
  const videoUrl =
    (directVideoUrl
      ? getVideoUrl(directVideoUrl, { width: 540, quality: 70, format: "mp4" })
      : undefined) ||
    (videoKey
      ? getVideoUrl(videoKey, { width: 540, quality: 70, format: "mp4" })
      : undefined);

  const imageUrl = getImageUrl(fallbackImageKey, {
    width: 1280,
    height: 720,
    aspectRatio: "16-9",
    focus: "auto",
    crop: "at_least",
  });

  const [isVideoReady, setIsVideoReady] = useState(false);

  // Reset ready state when the track / video URL changes
  useEffect(() => {
    setIsVideoReady(false);
  }, [videoUrl]);

  const handleVideoReady = () => {
    setIsVideoReady(true);
    onReady?.();
  };

  const isVideoLoading = Boolean(videoUrl) && !isVideoReady && isPlaying;
  const shouldShowLoader =
    (showLoader ?? showLoaderWhenVideoAvailable ?? true) && isVideoLoading;

  useEffect(() => {
    onLoadingChange?.(isVideoLoading);
  }, [isVideoLoading, onLoadingChange]);

  // Render backdrop artwork while video is buffering or as main fallback
  const shouldRenderImage =
    showFallbackImage || !videoUrl || (!isVideoReady && Boolean(imageUrl));

  return (
    <View style={[styles.container, style]} pointerEvents="none">
      {/* Backdrop artwork displayed while video buffers or when no video available */}
      {shouldRenderImage && imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="memory"
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.fallbackContainer]} />
      )}

      {/* Looping ambient canvas video */}
      {videoUrl ? (
        <VideoSurface
          videoUrl={videoUrl}
          isPlaying={isPlaying}
          onReady={handleVideoReady}
          onError={(err) => {
            console.warn("[CanvasVideoPlayer] Canvas video error:", err);
          }}
        />
      ) : null}

      {/* Prominent frosted circular loader while canvas video is loading/buffering */}
      {shouldShowLoader ? (
        <View style={styles.loaderContainer} pointerEvents="none">
          <View style={styles.loaderBackdrop}>
            <ActivityIndicator size="small" color="#FFFFFF" />
          </View>
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
    backgroundColor: "#000000",
  },
  loaderContainer: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "transparent",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 15,
  },
  loaderBackdrop: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
});
