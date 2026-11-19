import { useEffect, useRef } from "react";
import { Animated, Easing, Share } from "react-native";
import { useDispatch } from "react-redux";
import { useQueryClient } from "@tanstack/react-query";
import { audioPlayerService } from "@/service/audioPlayerService";
import { interactionService } from "@/service";
import {
  nextTrack,
  prevTrack,
  dislikeCurrentSong,
  toggleShuffle,
  toggleRepeat,
  toggleFavourite,
} from "@/store";
import { hapticFeedback } from "@/utils/haptics";
import { Song, PlayerSong } from "@/types";

type AnySong = Song | PlayerSong;

/** Artwork scale: 1.0 while playing, 0.9 while paused, with a spring. */
export function useArtworkPlayingScale(isPlaying: boolean): Animated.Value {
  const scale = useRef(new Animated.Value(isPlaying ? 1 : 0.9)).current;
  useEffect(() => {
    Animated.spring(scale, {
      toValue: isPlaying ? 1 : 0.9,
      friction: 8,
      tension: 40,
      useNativeDriver: true,
    }).start();
  }, [isPlaying]);
  return scale;
}

/** Transport controls with haptics: play/pause, next, previous, shuffle, repeat. */
export function useTransportActions() {
  const dispatch = useDispatch();
  return {
    handleTogglePlay: () => {
      hapticFeedback.medium();
      audioPlayerService.togglePlay();
    },
    handleNextTrack: () => {
      hapticFeedback.light();
      (dispatch as any)(nextTrack(true));
    },
    handlePrevTrack: () => {
      hapticFeedback.light();
      (dispatch as any)(prevTrack());
    },
    handleToggleShuffle: () => {
      hapticFeedback.selection();
      dispatch(toggleShuffle());
    },
    handleToggleRepeat: () => {
      hapticFeedback.selection();
      dispatch(toggleRepeat());
    },
  };
}

/** Like (with heart pulse), dislike and share for the displayed song. */
export function useSongActions(params: {
  activeSong: AnySong | null | undefined;
  fetchedSong: AnySong | null | undefined;
  targetSongId: string | undefined;
  isLiked: boolean;
}) {
  const { activeSong, fetchedSong, targetSongId, isLiked } = params;
  const dispatch = useDispatch();
  const queryClient = useQueryClient();

  // Tactile pulse animation for heart/like toggle
  const heartScaleAnim = useRef(new Animated.Value(1)).current;

  const handleToggleLike = async () => {
    const songToToggle =
      activeSong || (targetSongId ? ({ id: targetSongId, title: "Song" } as any) : null);
    if (!songToToggle) return;
    const nextLiked = !isLiked;
    if (nextLiked) {
      hapticFeedback.success();
      Animated.sequence([
        Animated.timing(heartScaleAnim, {
          toValue: 1.35,
          duration: 130,
          easing: Easing.out(Easing.back(2)),
          useNativeDriver: true,
        }),
        Animated.spring(heartScaleAnim, {
          toValue: 1,
          friction: 4,
          tension: 100,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      hapticFeedback.light();
      Animated.sequence([
        Animated.timing(heartScaleAnim, {
          toValue: 0.8,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.spring(heartScaleAnim, {
          toValue: 1,
          useNativeDriver: true,
        }),
      ]).start();
    }
    try {
      await (dispatch as any)(toggleFavourite(songToToggle)).unwrap();
      queryClient.invalidateQueries({ queryKey: ["favourites"] });
      queryClient.invalidateQueries({ queryKey: ["favourites-check"] });
    } catch (e) {
      console.warn("[SongDetail] Toggle favourite error:", e);
    }
  };

  const handleDislikeSong = async () => {
    hapticFeedback.medium();
    await (dispatch as any)(dislikeCurrentSong(targetSongId));
  };

  const handleShareSong = async () => {
    const songToShare = activeSong || fetchedSong;
    if (!songToShare) return;
    hapticFeedback.light();
    try {
      const shareUrl = `https://audiomelody.me/song/${songToShare.id}`;
      const result = await Share.share({
        title: songToShare.title,
        message: `Listen to "${songToShare.title}" by ${songToShare.artistName} on One Melody: ${shareUrl}`,
        url: shareUrl,
      });
      if (result.action === Share.sharedAction) {
        interactionService.recordShare(songToShare.id);
      }
    } catch {
      // User cancelled share
    }
  };

  return { heartScaleAnim, handleToggleLike, handleDislikeSong, handleShareSong };
}
