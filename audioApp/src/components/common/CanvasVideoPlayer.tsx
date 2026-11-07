import React, { useEffect, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  StyleProp,
  ViewStyle,
  ActivityIndicator,
  AppState,
  Platform,
} from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { Image } from "expo-image";
import { getImageUrl, getVideoUrl } from "@/utils/imageUtils";
import { configureAudioPriority } from "@/utils/audioConfig";
import { audioPlayerService } from "@/service/audioPlayerService";

// iOS: expo-video's AudioSessionPolicy adds `.mixWithOthers` to the shared
// AVAudioSession when a player is "mixWithOthers", which makes iOS drop the
// Now Playing / lock screen controls of the real music player. Android: a
// "doNotMix" video player would steal audio focus from the music player.
const CANVAS_MIXING_MODE = Platform.OS === "ios" ? "doNotMix" : "mixWithOthers";

// Many canvas files are a 16:9 clip centered inside a taller frame, so black bars
// are baked into the video itself (top + bottom). `cover` can't remove those, so
// we zoom in until the 16:9 content fills the container, cropping the bars.
// Zoom-to-fill switch. false = show the video as-is (no cover crop, no bar trimming).
const ZOOM_TO_FILL = false;
const CONTENT_ASPECT = 16 / 9;
const MAX_BAR_ZOOM = 4;

function computeBarZoom(
  video: { width: number; height: number } | null | undefined,
  box: { width: number; height: number }
): number {
  if (!ZOOM_TO_FILL) return 1;
  if (!video || !video.width || !video.height || !box.width || !box.height) return 1;
  // Not taller than the content itself -> no room for baked-in bars
  if (video.height < (video.width / CONTENT_ASPECT) * 1.15) return 1;

  // Scale `cover` applies, and the height the 16:9 content then occupies
  const coverScale = Math.max(box.width / video.width, box.height / video.height);
  const contentHeight = (video.width / CONTENT_ASPECT) * coverScale;
  const contentWidth = video.width * coverScale;
  // Zoom so the content fills the box height (width only overflows -> cropped)
  const zoom = Math.max(box.height / contentHeight, box.width / contentWidth, 1);
  return Math.min(MAX_BAR_ZOOM, zoom);
}

// WHY iOS keeps the canvas playing in the background:
// expo-video's AudioSessionPolicy only removes `.mixWithOthers` (needed for Now
// Playing / lock screen controls) while a "doNotMix" video player is PLAYING.
// The moment all video players pause or unmount (lock screen, app switch) it
// inserts `.mixWithOthers` again, iOS then drops our lock screen controls, and
// we can't undo it from the background (OSStatus 560557684). So on iOS the muted
// canvas keeps "playing" through lock instead of being paused/unmounted.
const KEEP_CANVAS_ALIVE_IN_BACKGROUND = false;

// expo-video recalculates the audio session when its players start/stop, so
// re-assert our session + lock screen shortly afterwards.
let reassertTimers: ReturnType<typeof setTimeout>[] = [];
function reassertPlaybackSession() {
  if (Platform.OS !== "ios") return;
  reassertTimers.forEach(clearTimeout);
  // Several attempts: expo-video recalculates the session asynchronously, and
  // while locking iOS may reject the first try (errors are swallowed).
  // NOTE: We no longer gate on AppState === "active" so the lock screen can
  // be re-asserted even while transitioning to background (locking).
  reassertTimers = [250, 900, 2000].map((delay) =>
    setTimeout(async () => {
      try {
        await configureAudioPriority(true);
      } catch {}
      try {
        audioPlayerService.refreshLockScreen(true);
      } catch {}
    }, delay)
  );
}

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

  const [box, setBox] = useState({ width: 0, height: 0 });
  const [videoSize, setVideoSize] = useState<{ width: number; height: number } | null>(null);
  const barZoom = React.useMemo(() => computeBarZoom(videoSize, box), [videoSize, box]);

  const player = useVideoPlayer(videoSource, (p) => {
    p.loop = true;
    p.muted = true;
    p.volume = 0;
    p.staysActiveInBackground = KEEP_CANVAS_ALIVE_IN_BACKGROUND;
    p.audioMixingMode = CANVAS_MIXING_MODE;
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
    player.staysActiveInBackground = KEEP_CANVAS_ALIVE_IN_BACKGROUND;
    player.audioMixingMode = CANVAS_MIXING_MODE;
    player.showNowPlayingNotification = false;

    if (isPlaying && AppState.currentState === "active") {
      player.play();
    } else {
      player.pause();
    }

    const markReady = () => {
      if (!hasTriggeredReady.current) {
        hasTriggeredReady.current = true;
        onReadyRef.current?.();
      }
    };

    const readSize = () => {
      const size = (player as any).videoTrack?.size;
      if (size?.width && size?.height) {
        setVideoSize({ width: size.width, height: size.height });
      }
    };

    const checkStatus = (status: string, error?: any) => {
      if (status === "readyToPlay") {
        readSize();
        markReady();
        if (isPlaying && AppState.currentState === "active" && !player.playing) {
          player.play();
        }
      } else if (status === "error") {
        console.warn("[CanvasVideoPlayer] ❌ Native player error:", error);
        onErrorRef.current?.(error);
      }
    };

    checkStatus(player.status);
    if (player.playing || player.currentTime > 0) {
      markReady();
    }

    const statusSub = player.addListener("statusChange", ({ status, error }) => {
      checkStatus(status, error);
    });

    const playingSub = player.addListener(
      "playingChange",
      ({ isPlaying: isCurrentlyPlaying }) => {
        if (isCurrentlyPlaying) {
          markReady();
        }
        reassertPlaybackSession();
      }
    );

    const timeUpdateSub = player.addListener("timeUpdate", ({ currentTime }) => {
      if (currentTime > 0 || player.playing) {
        markReady();
      }
    });

    const sourceLoadSub = player.addListener("sourceLoad", () => {
      readSize();
      markReady();
    });
    const trackSub = (player as any).addListener("videoTrackChange", () => readSize());

    // Active polling interval as a bulletproof fallback while video buffers
    const pollInterval = setInterval(() => {
      if (
        player.status === "readyToPlay" ||
        player.playing ||
        player.currentTime > 0
      ) {
        markReady();
        clearInterval(pollInterval);
      }
    }, 100);

    const appStateSub = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        if (isPlaying && !player.playing) player.play();
        reassertPlaybackSession();
      } else {
        // Pause canvas video on inactive/background to prevent expo-video
        // from recalculating the AVAudioSession and dropping lock screen controls
        player.pause();
        reassertPlaybackSession();
      }
    });

    return () => {
      try {
        clearInterval(pollInterval);
      } catch {}
      try {
        statusSub.remove();
      } catch {}
      try {
        playingSub.remove();
      } catch {}
      try {
        timeUpdateSub.remove();
      } catch {}
      try {
        sourceLoadSub.remove();
      } catch {}
      try {
        trackSub?.remove();
      } catch {}
      try {
        appStateSub.remove();
      } catch {}
      try {
        player.pause();
      } catch {}
      reassertPlaybackSession();
    };
  }, [isPlaying, player]);

  return (
    <VideoView
      style={[
        StyleSheet.absoluteFill,
        { width: "100%", height: "100%" },
        barZoom > 1 ? { transform: [{ scale: barZoom }] } : null,
      ]}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setBox((prev) =>
          prev.width === width && prev.height === height ? prev : { width, height }
        );
      }}
      player={player}
      // "cover" = zoom to fill: always scales the video up and crops overflow,
      // never letterboxes
      contentFit={ZOOM_TO_FILL ? "cover" : "contain"}
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

  // Screen lock / background -> show artwork and release the video player;
  // unlock / foreground -> bring the canvas back.
  const [appActive, setAppActive] = useState(AppState.currentState === "active");
  useEffect(() => {
    let resumeTimer: ReturnType<typeof setTimeout> | null = null;
    const sub = AppState.addEventListener("change", (next) => {
      console.log(`[Canvas] AppState -> ${next}`);
      if (resumeTimer) {
        clearTimeout(resumeTimer);
        resumeTimer = null;
      }
      if (next === "background" || next === "inactive") {
        // Immediately unmount the VideoSurface on lock/background so expo-video
        // cannot corrupt the iOS AVAudioSession and drop lock screen controls
        setAppActive(false);
      } else if (next === "active") {
        // Debounce: iOS can flip states twice while unlocking
        resumeTimer = setTimeout(() => {
          resumeTimer = null;
          setAppActive(true);
        }, 400);
      }
    });
    return () => {
      sub.remove();
      if (resumeTimer) clearTimeout(resumeTimer);
    };
  }, []);

  // Reset ready state when the track / video URL changes or the canvas remounts
  useEffect(() => {
    setIsVideoReady(false);
  }, [videoUrl, appActive]);

  // Fallback safety: ensure loader never stays visible indefinitely once playing
  useEffect(() => {
    if (!videoUrl || isVideoReady || !isPlaying) return;
    const safetyTimer = setTimeout(() => {
      setIsVideoReady(true);
    }, 2500);
    return () => clearTimeout(safetyTimer);
  }, [videoUrl, isVideoReady, isPlaying]);

  const handleVideoReady = () => {
    setIsVideoReady(true);
    onReady?.();
  };

  const isVideoLoading =
    Boolean(videoUrl) && appActive && !isVideoReady && isPlaying;
  const shouldShowLoader =
    (showLoader ?? showLoaderWhenVideoAvailable ?? true) && isVideoLoading;

  useEffect(() => {
    onLoadingChange?.(isVideoLoading);
  }, [isVideoLoading, onLoadingChange]);

  // Render backdrop artwork while video is buffering or as main fallback
  const shouldRenderImage =
    showFallbackImage || !videoUrl || !appActive || (!isVideoReady && Boolean(imageUrl));

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
      {videoUrl && appActive ? (
        <VideoSurface
          key={videoUrl}
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