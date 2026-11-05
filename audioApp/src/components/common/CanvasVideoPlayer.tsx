import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  StyleProp,
  ViewStyle,
  ActivityIndicator,
  AppState,
} from "react-native";
import { useVideoPlayer, VideoView, setVideoCacheSizeAsync } from "expo-video";
import { Image } from "expo-image";
import { getImageUrl, getVideoUrl } from "@/utils/imageUtils";

// Ensure native video cache is configured (100MB) for smooth looping
setVideoCacheSizeAsync(100 * 1024 * 1024).catch(() => {});

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
  onError?: (err?: any) => void;
}) {
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const isLoopingRef = useRef(false);
  const lastProgressTimestamp = useRef(Date.now());
  const hasTriggeredReady = useRef(false);

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
    p.audioMixingMode = "mixWithOthers";
    p.showNowPlayingNotification = false;
    p.staysActiveInBackground = false;
    p.timeUpdateEventInterval = 0.25;
    if (isPlaying && AppState.currentState === "active") {
      p.play();
    } else {
      p.pause();
    }
  });

  const triggerLoopReplay = useCallback(() => {
    if (!isPlaying || AppState.currentState !== "active") return;
    try {
      player.replay();
      player.play();
    } catch {
      try {
        player.currentTime = 0;
        player.play();
      } catch {
        // Ignore fallback error
      }
    }
  }, [isPlaying, player]);

  useEffect(() => {
    player.loop = true;
    player.muted = true;
    player.volume = 0;
    player.audioMixingMode = "mixWithOthers";
    player.showNowPlayingNotification = false;
    player.staysActiveInBackground = false;
    player.timeUpdateEventInterval = 0.25;

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
        }
        if (isPlaying && AppState.currentState === "active" && !player.playing) {
          player.play();
        }
      } else if (status === "idle") {
        // Android ExoPlayer maps STATE_ENDED to idle when video finishes
        if (isPlaying && AppState.currentState === "active") {
          const dur = player.duration;
          const cur = player.currentTime;
          if (dur > 0 && cur >= dur - 0.5) {
            triggerLoopReplay();
          }
        }
      } else if (status === "error") {
        onErrorRef.current?.(error);
      }
    };

    checkStatus(player.status);

    const statusSub = player.addListener("statusChange", ({ status, error }) => {
      checkStatus(status, error);
    });

    const playingSub = player.addListener("playingChange", ({ isPlaying: isCurrentlyPlaying }) => {
      if (isCurrentlyPlaying) {
        lastProgressTimestamp.current = Date.now();
        if (!hasTriggeredReady.current) {
          hasTriggeredReady.current = true;
          onReadyRef.current?.();
        }
      } else {
        // Player paused: check if it paused due to reaching the end of stream
        if (isPlaying && AppState.currentState === "active") {
          const dur = player.duration;
          const cur = player.currentTime;
          if (dur > 0 && cur >= dur - 0.4) {
            triggerLoopReplay();
          }
        }
      }
    });

    const playEndSub = player.addListener("playToEnd", () => {
      triggerLoopReplay();
    });

    const timeUpdateSub = player.addListener("timeUpdate", ({ currentTime }) => {
      lastProgressTimestamp.current = Date.now();
      const dur = player.duration;
      // Loop watchdog safety net: near end of video
      if (dur > 0 && currentTime >= dur - 0.2) {
        if (isPlaying && AppState.currentState === "active" && !isLoopingRef.current) {
          isLoopingRef.current = true;
          setTimeout(() => {
            if (player.currentTime >= dur - 0.3 && isPlaying && AppState.currentState === "active") {
              triggerLoopReplay();
            }
            isLoopingRef.current = false;
          }, 100);
        }
      }
    });

    // Stall watchdog: if playing and active, but no progress for > 8s, trigger error retry
    const stallInterval = setInterval(() => {
      if (isPlaying && AppState.currentState === "active") {
        const timeSinceProgress = Date.now() - lastProgressTimestamp.current;
        if (timeSinceProgress > 8000) {
          if (player.status === "loading" || !player.playing) {
            console.warn("[CanvasVideoPlayer] Playback stalled for > 8s, triggering retry");
            onErrorRef.current?.(new Error("Playback stalled"));
          }
        }
      }
    }, 3000);

    const appStateSub = AppState.addEventListener("change", (nextState) => {
      if (nextState !== "active") {
        player.pause();
      } else if (isPlaying) {
        player.play();
      }
    });

    return () => {
      clearInterval(stallInterval);
      try {
        statusSub.remove();
      } catch {}
      try {
        playingSub.remove();
      } catch {}
      try {
        playEndSub.remove();
      } catch {}
      try {
        timeUpdateSub.remove();
      } catch {}
      try {
        appStateSub.remove();
      } catch {}
    };
  }, [isPlaying, player, triggerLoopReplay]);

  return (
    <VideoView
      key={`vv-${videoUrl}`}
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
  const [retryAttempt, setRetryAttempt] = useState(0);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset retry attempt and ready state when the track / video URL changes
  useEffect(() => {
    setIsVideoReady(false);
    setRetryAttempt(0);
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
  }, [videoUrl]);

  // Handle retry with exponential backoff on network errors
  const handleVideoError = useCallback(
    (err?: any) => {
      console.warn(
        `[CanvasVideoPlayer] Canvas video error/stall (attempt ${retryAttempt + 1}):`,
        err?.message || err || "unknown"
      );
      setIsVideoReady(false);

      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }

      // Progressive backoff: 1.2s, 2s, 3.2s, 5s... capped at 8s
      const delay = Math.min(1200 * Math.pow(1.5, Math.min(retryAttempt, 5)), 8000);
      retryTimeoutRef.current = setTimeout(() => {
        setRetryAttempt((prev) => prev + 1);
      }, delay);
    },
    [retryAttempt]
  );

  // When app returns to foreground and video is not ready, retry immediately
  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active" && !isVideoReady && videoUrl) {
        if (retryTimeoutRef.current) {
          clearTimeout(retryTimeoutRef.current);
          retryTimeoutRef.current = null;
        }
        setRetryAttempt((prev) => prev + 1);
      }
    });
    return () => sub.remove();
  }, [isVideoReady, videoUrl]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  const shouldShowLoader = Boolean(
    videoUrl && showLoaderWhenVideoAvailable && !isVideoReady
  );
  // Show image if video is not ready yet, or while retrying
  const shouldRenderImage = !videoUrl || !isVideoReady;

  return (
    <View style={[styles.container, style]} pointerEvents="none">
      {/* Fallback poster image underneath */}
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

      {/* Looping ambient canvas video with retry key */}
      {videoUrl ? (
        <VideoSurface
          key={`${videoUrl}-retry-${retryAttempt}`}
          videoUrl={videoUrl}
          isPlaying={isPlaying}
          onReady={() => {
            setIsVideoReady(true);
            setRetryAttempt(0);
          }}
          onError={handleVideoError}
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
