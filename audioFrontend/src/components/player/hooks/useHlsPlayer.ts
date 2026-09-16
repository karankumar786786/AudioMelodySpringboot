import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { playerActions, playerStore } from "../../../store/player.store";
import { type QualityTrack } from "@/lib/player-utils";

const MAX_NETWORK_RETRIES = 5;
const MAX_MEDIA_RETRIES = 2;

export function useHlsPlayer(
  audioElement: HTMLAudioElement | null,
  currentSongId: string | undefined,
  streamUrl: string | undefined,
  isPlaying: boolean,
  selectedQuality: "auto" | number,
) {
  const hlsRef = useRef<any>(null);
  const isInternalChange = useRef(false);
  // Track isPlaying in a ref so the HLS init effect doesn't re-run on play/pause
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  const networkRetryCountRef = useRef(0);
  const mediaRetryCountRef = useRef(0);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const syncTracks = useCallback((hls: any) => {
    if (!hls) return;
    const levels = hls.levels || [];
    const tracks: QualityTrack[] = levels.map((level: any, idx: number) => ({
      index: idx,
      bandwidth: level.bitrate,
      label: level.name || `${Math.round(level.bitrate / 1000)}K`,
    }));
    playerActions.setQualityTracks(tracks);
  }, []);

  // Initialize and Load — ONLY when song/stream changes, NOT on play/pause
  useEffect(() => {
    if (!audioElement) return;
    const _songId = currentSongId;

    let isMounted = true;
    let hlsInstance: any = null;

    // Reset error counters on track change
    networkRetryCountRef.current = 0;
    mediaRetryCountRef.current = 0;
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    const initPlayer = async () => {
      try {
        if (hlsRef.current) {
          hlsRef.current.destroy();
          hlsRef.current = null;
        }

        if (streamUrl) {
          console.log("[Player] Loading stream URL:", streamUrl);
          isInternalChange.current = true;

          // Dynamic import of hls.js only on client side to prevent Next.js SSR errors
          const HlsModule = await import("hls.js");
          const Hls = HlsModule.default;

          if (Hls.isSupported()) {
            hlsInstance = new Hls({
              enableWorker: true,
              lowLatencyMode: false,
              backBufferLength: 90,
              maxBufferLength: 20,
              maxMaxBufferLength: 20,
              manifestLoadingTimeOut: 15000,
              manifestLoadingMaxRetry: 3,
              manifestLoadingRetryDelay: 1000,
              levelLoadingTimeOut: 15000,
              levelLoadingMaxRetry: 3,
              fragLoadingTimeOut: 20000,
              fragLoadingMaxRetry: 4,
            });
            hlsRef.current = hlsInstance;

            hlsInstance.attachMedia(audioElement);

            hlsInstance.on(Hls.Events.MEDIA_ATTACHED, () => {
              if (isMounted) {
                if (isPlayingRef.current) {
                  playerActions.setIsLoading(true);
                }
                hlsInstance.loadSource(streamUrl);
              }
            });

            hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
              if (!isMounted) return;
              networkRetryCountRef.current = 0; // Reset network errors on successful manifest parse
              playerActions.setIsLoading(false);
              syncTracks(hlsInstance);

              // Apply the user's previously selected quality if applicable
              const activeQuality = playerStore.state.selectedQuality;
              if (activeQuality === "auto") {
                hlsInstance.currentLevel = -1;
              } else {
                const idx = hlsInstance.levels.findIndex(
                  (level: any) => level.bitrate === activeQuality,
                );
                if (idx !== -1) {
                  hlsInstance.currentLevel = idx;
                } else {
                  // Fall back to auto if that specific bitrate doesn't exist in the new song
                  hlsInstance.currentLevel = -1;
                  playerActions.setSelectedQuality("auto");
                }
              }

              // Restore saved playback time if available
              const savedTime = playerStore.state.currentTime;
              if (
                savedTime > 0 &&
                Math.abs(audioElement.currentTime - savedTime) > 0.5
              ) {
                audioElement.currentTime = savedTime;
              }

              // Use the ref to check current isPlaying state (not stale closure)
              if (isPlayingRef.current && !playerStore.state.isVideoActive) {
                audioElement.play().catch((err) => {
                  if (err.name !== "AbortError") {
                    console.warn("[Player] Hls.js autoplay failed:", err);
                  }
                });
              }
            });

            hlsInstance.on(Hls.Events.ERROR, (_event: any, data: any) => {
              if (!isMounted) return;

              if (data.fatal) {
                switch (data.type) {
                  case Hls.ErrorTypes.NETWORK_ERROR: {
                    networkRetryCountRef.current += 1;
                    const attempt = networkRetryCountRef.current;
                    const isManifestError = data.details === "manifestLoadError" || data.details === "manifestLoadTimeOut";

                    if (attempt <= MAX_NETWORK_RETRIES) {
                      // Exponential backoff: 1s, 2s, 4s, 8s, 16s
                      const delay = Math.min(Math.pow(2, attempt - 1) * 1000, 16000);
                      console.warn(
                        `[Hls.js] Network error (${data.details}), attempt ${attempt}/${MAX_NETWORK_RETRIES}, retrying in ${delay}ms...`,
                      );
                      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
                      retryTimeoutRef.current = setTimeout(() => {
                        if (isMounted && hlsRef.current) {
                          if (isManifestError) {
                            // Manifest errors need a full source reload, startLoad() alone won't re-fetch the manifest
                            hlsRef.current.loadSource(streamUrl);
                          }
                          hlsRef.current.startLoad();
                        }
                      }, delay);
                    } else {
                      console.error(`[Hls.js] Network retry limit reached after ${MAX_NETWORK_RETRIES} attempts (${data.details}).`);
                      playerActions.setIsLoading(false);
                      toast.error("Stream connection failed", {
                        description: "Network issue loading audio stream. Click to retry.",
                        action: {
                          label: "Retry",
                          onClick: () => {
                            networkRetryCountRef.current = 0;
                            if (hlsRef.current) {
                              hlsRef.current.loadSource(streamUrl);
                              hlsRef.current.startLoad();
                            }
                          },
                        },
                      });
                      if (hlsInstance) {
                        hlsInstance.destroy();
                        hlsRef.current = null;
                      }
                    }
                    break;
                  }
                  case Hls.ErrorTypes.MEDIA_ERROR: {
                    mediaRetryCountRef.current += 1;
                    if (mediaRetryCountRef.current <= MAX_MEDIA_RETRIES) {
                      console.warn(
                        `[Hls.js] Fatal media error (attempt ${mediaRetryCountRef.current}/${MAX_MEDIA_RETRIES}), recovering media...`,
                      );
                      hlsInstance.recoverMediaError();
                    } else {
                      console.error("[Hls.js] Media error recovery failed, swapping audio element state...");
                      // Re-attach media on persistent codec/decode glitches
                      hlsInstance.swapAudioCodec();
                      hlsInstance.recoverMediaError();
                    }
                    break;
                  }
                  default: {
                    console.error("[Hls.js] Unrecoverable fatal error:", data.details);
                    playerActions.setIsLoading(false);
                    toast.error("Playback error", {
                      description: `Stream error: ${data.details || "Cannot decode track"}.`,
                      action: {
                        label: "Reload",
                        onClick: () => {
                          if (hlsRef.current) {
                            hlsRef.current.loadSource(streamUrl);
                            hlsRef.current.startLoad();
                          }
                        },
                      },
                    });
                    if (hlsInstance) {
                      hlsInstance.destroy();
                      hlsRef.current = null;
                    }
                    break;
                  }
                }
              } else {
                // Suppress spammy non-fatal warnings that recover automatically (e.g. fragParsingError)
                if (data.details !== "fragParsingError") {
                  console.debug("[Hls.js] ⚠️ Non-fatal warning details:", data);
                }
              }
            });
          } else if (
            audioElement.canPlayType("application/vnd.apple.mpegurl")
          ) {
            // Check for native HLS support (Safari on iOS)
            audioElement.src = streamUrl;
            playerActions.setQualityTracks([]); // No manual tracks for native Safari HLS

            const savedTime = playerStore.state.currentTime;
            if (
              savedTime > 0 &&
              Math.abs(audioElement.currentTime - savedTime) > 0.5
            ) {
              audioElement.currentTime = savedTime;
            }

            if (isPlayingRef.current && !playerStore.state.isVideoActive) {
              audioElement.play().catch((err) => {
                if (err.name !== "AbortError") {
                  console.warn("[Player] Native HLS autoplay failed:", err);
                }
              });
            }
          } else {
            toast.error("HLS playback is not supported in this browser.");
          }

          setTimeout(() => {
            if (isMounted) isInternalChange.current = false;
          }, 500);
        } else {
          audioElement.src = "";
        }
      } catch (e: any) {
        console.error("[Player] ❌ Hls.js Lifecycle Error:", e);
        isInternalChange.current = false;
      }
    };

    initPlayer();

    return () => {
      isMounted = false;
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      if (hlsInstance) {
        hlsInstance.destroy();
        hlsRef.current = null;
      }
    };
    // IMPORTANT: isPlaying is intentionally NOT in the dependency array.
    // It's tracked via isPlayingRef so that toggling play/pause does NOT
    // destroy and recreate the HLS instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSongId, streamUrl, audioElement, syncTracks]);

  // Quality Switching
  useEffect(() => {
    if (!hlsRef.current) return;
    const hls = hlsRef.current;

    // Only apply if levels are loaded
    if (!hls.levels || hls.levels.length === 0) return;

    if (selectedQuality === "auto") {
      hls.currentLevel = -1; // -1 represents AUTO level selection
    } else {
      const idx = hls.levels.findIndex(
        (level: any) => level.bitrate === selectedQuality,
      );
      if (idx !== -1) {
        hls.currentLevel = idx;
      }
    }
  }, [selectedQuality]);

  return { player: hlsRef.current, isInternalChange };
}
