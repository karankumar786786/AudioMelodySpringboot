"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useQuery, useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
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

  const artist = artistResponse?.data;

  /* -------------------------------------------------------------------------- */
  /*                                 SONG QUERY                                 */
  /* -------------------------------------------------------------------------- */

  // Load songs directly from Algolia with infinite scroll (15 per page, zero DB load)
  const {
    data: songsInfiniteData,
    isLoading: isSongsLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error: _songsError,
    refetch: refetchSongs,
  } = useInfiniteQuery({
    queryKey: ["artist-songs", id, artist?.name],
    queryFn: ({ pageParam = 1 }) =>
      musicApi.artists.getSongs(id as string, pageParam as number, 15, artist?.name),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (!lastPage?.data?.pagination) return undefined;
      return lastPage.data.pagination.hasNext
        ? lastPage.data.pagination.page + 1
        : undefined;
    },
    enabled: Boolean(id && (artist?.name || !isArtistLoading)),
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

  /* -------------------------------------------------------------------------- */
  /*                              DERIVED VALUES                                */
  /* -------------------------------------------------------------------------- */

  const songs = useMemo(() => {
    return (
      songsInfiniteData?.pages?.flatMap(
        (page) => page?.data?.data || []
      ) || []
    );
  }, [songsInfiniteData]);

  const totalSongsCount = songsInfiniteData?.pages?.[0]?.data?.pagination?.total;

  /* -------------------------------------------------------------------------- */
  /*                         INFINITE SCROLL OBSERVER                           */
  /* -------------------------------------------------------------------------- */

  const observerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const target = observerRef.current;
    if (!target) return;

    const rootElement = document.querySelector("main");
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      {
        root: rootElement,
        rootMargin: "300px",
        threshold: 0.01,
      },
    );

    observer.observe(target);
    return () => {
      observer.unobserve(target);
    };
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const isFollowing = localFollowStatus?.isFollowing ?? followStatusData?.isFollowing ?? false;
  const followersCount = localFollowStatus?.followersCount ?? followStatusData?.followersCount ?? artist?.followersCount ?? 0;

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

  const handlePlayAll = async () => {
    if (songs.length === 0) return;
    const firstSong = songs[0];
    let songToPlay = firstSong;

    // Load full song details (songKey) from DB only on demand for playback
    if (!firstSong.songKey && firstSong.id) {
      try {
        const res = await musicApi.songs.getById(firstSong.id);
        if (res?.data) {
          songToPlay = { ...firstSong, ...res.data };
        }
      } catch (err) {
        console.warn("Failed to fetch full song details for playAll:", err);
      }
    }

    const updatedSongs = [...songs];
    updatedSongs[0] = songToPlay;
    playerActions.playAll(mapListToPlayerSongs(updatedSongs));
    toast.success("Playing Songs", {
      description: `Starting playback for ${artist?.name || "artist"}.`,
    });
  };

  /* -------------------------------------------------------------------------- */
  /*                              PLAY SONG                                     */
  /* -------------------------------------------------------------------------- */

  const handlePlaySong = async (song: any, index: number) => {
    previewPlayer.stopPreview(true);
    const isActive = currentSong?.id === song.id;

    if (isActive) {
      playerActions.setIsPlaying(!isPlaying);
      return;
    }

    let songToPlay = song;
    // Load full song details (songKey) from DB only on demand when user clicks to play
    if (!song.songKey && song.id) {
      try {
        const res = await musicApi.songs.getById(song.id);
        if (res?.data) {
          songToPlay = { ...song, ...res.data };
        }
      } catch (err) {
        console.warn("Failed to fetch full song details for song playback:", err);
      }
    }

    const updatedSongs = [...songs];
    updatedSongs[index] = songToPlay;
    const allPlayerSongs = mapListToPlayerSongs(updatedSongs);
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
        totalCount={totalSongsCount}
        currentSong={currentSong}
        isPlaying={isPlaying}
        onPlaySong={handlePlaySong}
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        onLoadMore={() => fetchNextPage()}
        observerRef={observerRef}
      />
    </div>
  );
}