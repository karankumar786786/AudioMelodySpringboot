import { useEffect, useMemo, useRef } from "react";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useDispatch, useSelector } from "react-redux";
import { AppState } from "@/store/hook";
import { homeService, artistService } from "@/service";
import { useSongInfo } from "@/hooks/useSongInfo";
import {
  playSong,
  setDominantColor,
  selectIsFavourite,
  selectIsSongInAnyPlaylist,
} from "@/store";
import { getImageUrl, useDominantColor } from "@/utils";

/**
 * Everything the song screen reads: player/queue state, the song to display
 * (player's current song, a queued song, or fetched by id), its like/dislike/playlist
 * state, Wikipedia info, artwork, dominant colour and artist follow data.
 * Also keeps the route id in step with the playing track and deep-link auto-plays.
 */
export function useSongScreenData(id: string | undefined) {
  const router = useRouter();
  const dispatch = useDispatch();

  // NOTE: currentTime is isolated in PlayerScrubber to prevent 250ms re-renders
  const currentSong = useSelector((state: AppState) => state.player.currentSong);
  const isPlaying = useSelector((state: AppState) => state.player.isPlaying);
  const isLoading = useSelector((state: AppState) => state.player.isLoading);
  const duration = useSelector((state: AppState) => state.player.duration);
  const bufferedTime = useSelector((state: AppState) => state.player.bufferedTime || 0);
  const repeatMode = useSelector((state: AppState) => state.queue.repeatMode);
  const isShuffle = useSelector((state: AppState) => state.queue.isShuffle);
  const queue = useSelector((state: AppState) => state.queue.queue);
  const currentIndex = useSelector((state: AppState) => state.queue.currentIndex);

  const upcomingCount = useMemo(() => {
    if (!queue || queue.length === 0) return 0;
    return Math.max(0, queue.length - (currentIndex + 1));
  }, [queue, currentIndex]);

  // Load song metadata from backend if needed (fallback if not already active in player)
  const { data: fetchedSong, isLoading: isFetching, isError, error } = useQuery({
    queryKey: ["song", id],
    queryFn: () => homeService.getSongById(id!),
    enabled: Boolean(id && (!currentSong || currentSong.id !== id)),
  });

  // Effective song to display: prefer currentSong from player state if matching id, then queue, fallback to fetchedSong
  const activeSong =
    currentSong && String(currentSong.id) === String(id)
      ? currentSong
      : (queue?.find((s) => String(s.id) === String(id)) || fetchedSong || currentSong);
  const targetSongId = (activeSong?.id || id) ? String(activeSong?.id || id) : undefined;
  const isLiked = useSelector((state: AppState) => selectIsFavourite(state, targetSongId));
  const isDisliked = useSelector((state: AppState) =>
    targetSongId ? state.queue.dislikedSongIds?.includes(targetSongId) : false
  );
  const isSongInAnyPlaylist = useSelector((state: AppState) =>
    selectIsSongInAnyPlaylist(state, targetSongId)
  );

  // Song description and biography from Wikipedia
  const { data: songInfo, isLoading: isSongInfoLoading } = useSongInfo(
    activeSong?.title,
    activeSong?.artistName
  );

  // Natural aspect ratio for the artist Wikipedia photo
  const artistImgAspectRatio = useMemo(() => {
    if (songInfo?.artist?.imageWidth && songInfo?.artist?.imageHeight) {
      const ratio = songInfo.artist.imageWidth / songInfo.artist.imageHeight;
      return Math.max(0.72, Math.min(1.33, ratio));
    }
    return 1;
  }, [songInfo?.artist?.imageWidth, songInfo?.artist?.imageHeight]);

  const posterUrl: string | undefined =
    (activeSong as any)?.posterUrl ||
    (activeSong as any)?.coverUrl ||
    (activeSong?.imageKey
      ? getImageUrl(activeSong.imageKey, {
          width: 720,
          height: 720,
          focus: "auto",
          aspectRatio: "1-1",
          quality: 90,
        })
      : undefined);

  const fallbackKey = `${activeSong?.title || ""}-${activeSong?.artistName || ""}-${activeSong?.id || ""}`;
  const dominantTheme = useDominantColor(posterUrl, fallbackKey);

  useEffect(() => {
    if (dominantTheme?.dominantColor) {
      dispatch(setDominantColor(dominantTheme.dominantColor));
    }
  }, [dominantTheme?.dominantColor, dispatch]);

  // Artist metadata (artistId for profile navigation)
  const { data: artistFollowData } = useQuery({
    queryKey: ["artist-follow-status", activeSong?.artistName],
    queryFn: () => artistService.getFollowStatus(activeSong!.artistName),
    enabled: Boolean(activeSong?.artistName),
    staleTime: 1000 * 60 * 5,
  });

  // Synchronize route param id with currentSong when track advances
  useEffect(() => {
    if (currentSong?.id && currentSong.id !== id) {
      router.setParams({ id: currentSong.id });
    }
  }, [currentSong?.id, id]);

  // Deep-link auto play if cold-opened with no song currently playing
  const hasAutoPlayedRef = useRef(false);
  useEffect(() => {
    if (!currentSong && fetchedSong && !hasAutoPlayedRef.current) {
      hasAutoPlayedRef.current = true;
      (dispatch as any)(playSong(fetchedSong));
    }
  }, [currentSong, fetchedSong, dispatch]);

  return {
    currentSong,
    isPlaying,
    isLoading,
    duration,
    bufferedTime,
    repeatMode,
    isShuffle,
    queue,
    currentIndex,
    upcomingCount,
    fetchedSong,
    isFetching,
    isError,
    error,
    activeSong,
    targetSongId,
    isLiked,
    isDisliked,
    isSongInAnyPlaylist,
    songInfo,
    isSongInfoLoading,
    artistImgAspectRatio,
    posterUrl,
    dominantTheme,
    artistFollowData,
  };
}
