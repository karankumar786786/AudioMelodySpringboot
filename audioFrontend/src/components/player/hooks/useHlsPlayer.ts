import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { playerActions, playerStore } from "../../../store/player.store";

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

  const syncTracks = useCallback((hls: any) => {
    if (!hls) return;
    const levels = hls.levels || [];
    const tracks = levels.map((level: any, idx: number) => ({
      index: idx,
      bandwidth: level.bitrate,
      label: level.name || `${Math.round(level.bitrate / 1000)}K`,
    }));
    playerActions.setQualityTracks(tracks);
  }, []);

  // Initialize and Load — ONLY when song/stream changes, NOT on play/pause
  useEffect(() => {
    if (!audioElement) return;
    // Reference currentSongId to trigger re-run
    const _songId = currentSongId;

    let isMounted = true;
    let hlsInstance: any = null;

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
            });
            hlsRef.current = hlsInstance;

            hlsInstance.attachMedia(audioElement);

            hlsInstance.on(Hls.Events.MEDIA_ATTACHED, () => {
              if (isMounted) {
                hlsInstance.loadSource(streamUrl);
              }
            });

            hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
              if (!isMounted) return;
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
                console.error("[Hls.js] ❌ Fatal error details:", data);
                switch (data.type) {
                  case Hls.ErrorTypes.NETWORK_ERROR:
                    console.warn(
                      "[Hls.js] Fatal network error, trying to recover...",
                    );
                    hlsInstance.startLoad();
                    break;
                  case Hls.ErrorTypes.MEDIA_ERROR:
                    console.warn(
                      "[Hls.js] Fatal media error, trying to recover...",
                    );
                    hlsInstance.recoverMediaError();
                    break;
                  default:
                    console.error(
                      "[Hls.js] Unrecoverable fatal error:",
                      data.details,
                    );
                    toast.error("Playback error", {
                      description: `Unrecoverable error: ${data.details}.`,
                    });
                    hlsInstance.destroy();
                    hlsRef.current = null;
                    break;
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

            if (isPlayingRef.current) {
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
      if (hlsInstance) {
        hlsInstance.destroy();
        hlsRef.current = null;
      }
    };
    // IMPORTANT: isPlaying is intentionally NOT in the dependency array.
    // It's tracked via isPlayingRef so that toggling play/pause does NOT
    // destroy and recreate the HLS instance (which was causing the pause-reset bug).
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
