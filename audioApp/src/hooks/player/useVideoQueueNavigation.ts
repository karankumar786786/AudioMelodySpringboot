import { useRouter } from "expo-router";
import { useDispatch } from "react-redux";
import * as ScreenOrientation from "expo-screen-orientation";
import { audioPlayerService } from "@/service/audioPlayerService";
import { videoService } from "@/service";
import { nextTrack, prevTrack, playSong } from "@/store";
import { hapticFeedback } from "@/utils/haptics";
import { RepeatMode, Song, PlayerSong } from "@/types";

type AnySong = Song | PlayerSong;

/** Pure: whether a song can be played in the full-video modal. */
export function songHasVideo(song: AnySong | null | undefined): boolean {
  return Boolean((song as any)?.fullVideoKey || (song as any)?.videoStreamUrl);
}

/** Pure: the queue neighbour in `direction`, wrapping only when repeat-all is on. */
export function getQueueNeighbour(
  queue: AnySong[],
  currentIndex: number,
  repeatMode: RepeatMode,
  direction: "next" | "prev"
): AnySong | undefined {
  if (direction === "next") {
    const nextIndex = currentIndex + 1;
    if (nextIndex < queue.length) return queue[nextIndex];
    if (repeatMode === "all" && queue.length > 0) return queue[0];
    return undefined;
  }
  const prevIndex = currentIndex - 1;
  if (prevIndex >= 0) return queue[prevIndex];
  if (repeatMode === "all" && queue.length > 0) return queue[queue.length - 1];
  return undefined;
}

/**
 * Next / previous / track-end handling while the full-video modal is open: stays in
 * video when the neighbour has a video (or a related video exists), otherwise closes
 * the modal back to portrait audio playback.
 */
export function useVideoQueueNavigation(params: {
  activeSong: AnySong | null | undefined;
  queue: AnySong[];
  currentIndex: number;
  repeatMode: RepeatMode;
  closeVideoToArtwork: () => void;
}) {
  const { activeSong, queue, currentIndex, repeatMode, closeVideoToArtwork } = params;
  const router = useRouter();
  const dispatch = useDispatch();

  const leaveVideo = () => {
    closeVideoToArtwork();
    router.setParams({ mode: "" });
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
  };

  const goToNextVideo = async (manualUserAction: boolean) => {
    const nextSong = getQueueNeighbour(queue, currentIndex, repeatMode, "next");

    if (nextSong && songHasVideo(nextSong)) {
      await (dispatch as any)(nextTrack(manualUserAction));
      audioPlayerService.pause();
      return;
    }

    if (activeSong?.id) {
      try {
        const related = await videoService.getRelatedVideos(activeSong.id, 5);
        const videoTrack = related?.find((s) => s.id !== activeSong.id && Boolean(s.fullVideoKey));
        if (videoTrack) {
          await (dispatch as any)(playSong(videoTrack, related));
          audioPlayerService.pause();
          return;
        }
      } catch {}
    }

    leaveVideo();
    await (dispatch as any)(nextTrack(manualUserAction));
  };

  const handleVideoTrackEnd = () => goToNextVideo(false);

  const handleVideoNextTrack = async () => {
    hapticFeedback.light();
    await goToNextVideo(true);
  };

  const handleVideoPrevTrack = async () => {
    hapticFeedback.light();
    const prevSong = getQueueNeighbour(queue, currentIndex, repeatMode, "prev");

    if (prevSong && songHasVideo(prevSong)) {
      await (dispatch as any)(prevTrack(true));
      audioPlayerService.pause();
    } else {
      leaveVideo();
      await (dispatch as any)(prevTrack(true));
    }
  };

  return { handleVideoTrackEnd, handleVideoNextTrack, handleVideoPrevTrack };
}
