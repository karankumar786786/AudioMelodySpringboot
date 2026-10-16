"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { musicApi } from "@/lib/api";
import { useParams, useRouter } from "next/navigation";
import { useStore } from "@tanstack/react-store";
import { getImageUrl } from "@/lib/image-utils";
import { playerStore, playerActions } from "@/store/player.store";
import { mapListToPlayerSongs } from "@/lib/player-utils";
import { getSolidBgFromImage } from "@/lib/color-utils";
import { toast } from "sonner";
import { NotFoundPage, ServerErrorPage, SomethingWentWrongPage } from "@/components/ErrorPages";
import { previewPlayer } from "@/lib/preview-player";
import { ArtistHero, ArtistPopularSongs } from "./components";

export default function ArtistPage() {
  const { id } = useParams();
  const _router = useRouter();

  const currentSong = useStore(playerStore, (s) => s.currentSong);
  const isPlaying = useStore(playerStore, (s) => s.isPlaying);
  const systemUser = useStore(playerStore, (s) => s.systemUser);
  const queryClient = useQueryClient();

  const [backgroundColor, setBackgroundColor] = useState("#181818");
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  const [localFollowStatus, setLocalFollowStatus] = useState<{
    followersCount: number;
    isFollowing: boolean;
  } | null>(null);

  /* -------------------------------------------------------------------------- */
  /*                                ARTIST QUERY                                */
  /* -------------------------------------------------------------------------- */

  const { data: artistResponse, isLoading: isArtistLoading, error: artistError, refetch: refetchArtist } = useQuery({
    queryKey: ["artist", id],
    queryFn: () => musicApi.artists.getById(id as string),
  });

  /* -------------------------------------------------------------------------- */
  /*                                 SONG QUERY                                 */
  /* -------------------------------------------------------------------------- */

  const { data: songsResponse, isLoading: isSongsLoading, error: _songsError, refetch: refetchSongs } = useQuery({
    queryKey: ["artist-songs", id],
    queryFn: () => musicApi.artists.getSongs(id as string),
  });

  /* -------------------------------------------------------------------------- */
  /*                              FOLLOW STATUS QUERY                           */
  /* -------------------------------------------------------------------------- */

  const { data: followStatusData } = useQuery({
    queryKey: ["artist-follow-status", id],
    queryFn: async () => {
      if (!id) return null;
      const res = await musicApi.artists.getFollowStatus(id as string);
      return res?.data;
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 2,
  });

  // Keep local follower UI state in sync with server query cache
  useEffect(() => {
    if (followStatusData) {
      setLocalFollowStatus({
        followersCount: followStatusData.followersCount,
        isFollowing: followStatusData.isFollowing,
      });
    }
  }, [followStatusData]);

  const isFollowing = localFollowStatus?.isFollowing ?? followStatusData?.isFollowing ?? false;
  const followersCount = localFollowStatus?.followersCount ?? followStatusData?.followersCount ?? 0;

  /* -------------------------------------------------------------------------- */
  /*                              DERIVED VALUES                                */
  /* -------------------------------------------------------------------------- */

  const artist = artistResponse?.data;
  const songs = songsResponse?.data?.data || [];

  const coverUrl = getImageUrl(artist?.coverImageKey, {
    width: 600,
    height: 600,
    focus: "auto",
    aspectRatio: "1-1",
  });

  /* -------------------------------------------------------------------------- */
  /*                         EXTRACT ARTIST COLOR                               */
  /* -------------------------------------------------------------------------- */

  useEffect(() => {
    let cancelled = false;

    async function extractColor() {
      if (!coverUrl) {
        setBackgroundColor("#181818");
        return;
      }

      const color = await getSolidBgFromImage(coverUrl, artist?.name || "artist");

      if (!cancelled) {
        setBackgroundColor(color);
      }
    }

    extractColor();

    return () => {
      cancelled = true;
    };
  }, [coverUrl, artist?.name]);

  /* -------------------------------------------------------------------------- */
  /*                                  LOADING                                   */
  /* -------------------------------------------------------------------------- */

  if (isArtistLoading || isSongsLoading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-4 text-zinc-500">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
        <span className="text-xs font-black uppercase italic tracking-widest">
          Loading Artist...
        </span>
      </div>
    );
  }

  // Error & Not Found handling
  if (artistError || !artist) {
    const is404 =
      !artist ||
      (artistError as any)?.status === 404 ||
      (artistError as any)?.response?.status === 404;
    const is500 =
      (artistError as any)?.status >= 500 ||
      (artistError as any)?.response?.status >= 500;

    if (is404 && !is500) {
      return <NotFoundPage />;
    }
    if (is500) {
      return <ServerErrorPage onRetry={() => { refetchArtist(); refetchSongs(); }} />;
    }
    return (
      <SomethingWentWrongPage
        error={artistError as Error}
        reset={() => { refetchArtist(); refetchSongs(); }}
      />
    );
  }

  /* -------------------------------------------------------------------------- */
  /*                              PLAY ALL SONGS                                */
  /* -------------------------------------------------------------------------- */

  const handlePlayAll = () => {
    if (songs.length === 0) return;
    playerActions.playAll(mapListToPlayerSongs(songs));
    toast.success("Playing Songs", {
      description: `Starting playback for ${artist?.name}.`,
    });
  };

  /* -------------------------------------------------------------------------- */
  /*                              PLAY SONG                                     */
  /* -------------------------------------------------------------------------- */

  const handlePlaySong = (song: any, index: number) => {
    previewPlayer.stopPreview(true);
    const isActive = currentSong?.id === song.id;

    if (isActive) {
      playerActions.setIsPlaying(!isPlaying);
      return;
    }

    const allPlayerSongs = mapListToPlayerSongs(songs);
    playerActions.playAllFrom(allPlayerSongs, index);
  };

  /* -------------------------------------------------------------------------- */
  /*                              FOLLOW HANDLER                                */
  /* -------------------------------------------------------------------------- */

  const handleFollowToggle = async () => {
    if (!systemUser?.id) {
      toast.error("Sign in required", {
        description: "Please sign in to follow artists.",
      });
      return;
    }
    if (!id || isFollowLoading) return;

    try {
      setIsFollowLoading(true);
      const isCurrentlyFollowing = isFollowing;
      let res;
      if (isCurrentlyFollowing) {
        res = await musicApi.artists.unfollow(id as string);
        toast.success("Unfollowed", {
          description: `You are no longer following ${artist?.name || "this artist"}.`,
        });
      } else {
        res = await musicApi.artists.follow(id as string);
        toast.success("Following", {
          description: `You are now following ${artist?.name || "this artist"}.`,
        });
      }

      if (res?.data) {
        setLocalFollowStatus({
          followersCount: res.data.followersCount,
          isFollowing: res.data.isFollowing,
        });
        queryClient.setQueryData(["artist-follow-status", id], res.data);
        if (artist?.name) {
          queryClient.setQueryData(["artist-follow-status", artist.name], res.data);
        }
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to update follow status");
    } finally {
      setIsFollowLoading(false);
    }
  };

  return (
    <div className="min-h-full pb-24 px-2">
      {/* Hero Header */}
      <ArtistHero
        artist={artist}
        coverUrl={coverUrl}
        backgroundColor={backgroundColor}
        followersCount={followersCount}
        songs={songs}
        isFollowing={isFollowing}
        isFollowLoading={isFollowLoading}
        onPlayAll={handlePlayAll}
        onFollowToggle={handleFollowToggle}
      />

      {/* Popular Tracks */}
      <ArtistPopularSongs
        songs={songs}
        currentSong={currentSong}
        isPlaying={isPlaying}
        onPlaySong={handlePlaySong}
      />
    </div>
  );
}