"use client";

import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { musicApi, type Song } from "@/lib/api";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { playerActions, playerStore } from "@/store/player.store";
import { mapListToPlayerSongs } from "@/lib/player-utils";
import { useStore } from "@tanstack/react-store";
import { toast } from "sonner";
import { getImageUrl, getVideoUrl } from "@/lib/image-utils";
import { previewPlayer } from "@/lib/preview-player";
import { NotFoundPage, ServerErrorPage, SomethingWentWrongPage } from "@/components/ErrorPages";
import { PlaylistHeroBanner, PlaylistTrackTable } from "./components";

export default function PlaylistPage() {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();

  const systemUser = useStore(playerStore, (s) => s.systemUser);
  const currentSong = useStore(playerStore, (s) => s.currentSong);
  const isPlaying = useStore(playerStore, (s) => s.isPlaying);

  const playlistType = searchParams.get("type");

  useEffect(() => {
    if (playlistType === "user") {
      router.replace(`/my-playlists/${id}`);
    }
  }, [playlistType, id, router]);

  /* -------------------------------------------------------------------------- */
  /*                                  PLAYLIST                                  */
  /* -------------------------------------------------------------------------- */

  const {
    data: playlistResponse,
    isLoading: isPlaylistLoading,
    error: playlistError,
    refetch: refetchPlaylist,
  } = useQuery({
    queryKey: ["playlist", id, playlistType],
    queryFn: async () => {
      if (playlistType === "user") {
        return await musicApi.users.getPlaylistById(id as string);
      }

      if (playlistType === "system") {
        return await musicApi.playlists.getById(id as string);
      }

      try {
        return await musicApi.playlists.getById(id as string);
      } catch {
        return await musicApi.users.getPlaylistById(id as string);
      }
    },
  });

  useEffect(() => {
    if (
      playlistResponse?.data &&
      ("ownerId" in playlistResponse.data ||
        "ownerName" in playlistResponse.data ||
        "privacy" in playlistResponse.data)
    ) {
      router.replace(`/my-playlists/${id}`);
    }
  }, [playlistResponse, id, router]);

  /* -------------------------------------------------------------------------- */
  /*                                    SONGS                                   */
  /* -------------------------------------------------------------------------- */

  const {
    data: songsResponse,
    isLoading: isSongsLoading,
    error: _songsError,
    refetch: refetchSongs,
  } = useQuery({
    queryKey: ["playlist-songs", id, playlistType],
    queryFn: async () => {
      if (playlistType === "user") {
        return await musicApi.users.getPlaylistSongs(id as string);
      }

      if (playlistType === "system") {
        return await musicApi.playlists.getSongs(id as string);
      }

      try {
        return await musicApi.playlists.getSongs(id as string);
      } catch {
        return await musicApi.users.getPlaylistSongs(id as string);
      }
    },
  });

  /* -------------------------------------------------------------------------- */
  /*                               REMOVE SONG                                  */
  /* -------------------------------------------------------------------------- */

  const removeSong = useMutation({
    mutationFn: (songId: string) =>
      musicApi.users.removeSongFromPlaylist(id as string, songId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["playlist-songs", id],
        exact: false,
      });
    },
  });

  /* -------------------------------------------------------------------------- */
  /*                                  DATA                                      */
  /* -------------------------------------------------------------------------- */

  const playlist = playlistResponse?.data;
  const songs = songsResponse?.data?.data || [];

  const isUserPlaylist =
    playlistType === "user" || (playlist && "userId" in playlist);

  const activeVideoKey = playlist?.videoKey;
  const videoUrl = activeVideoKey ? getVideoUrl(activeVideoKey) : undefined;

  const coverUrl = getImageUrl(playlist?.coverImageKey, {
    width: 1600,
    height: 900,
    focus: "auto",
    aspectRatio: "16-9",
  });

  /* -------------------------------------------------------------------------- */
  /*                                  LOADING                                   */
  /* -------------------------------------------------------------------------- */

  if (isPlaylistLoading || isSongsLoading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-4 text-zinc-500">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
        <span className="text-xs font-black uppercase italic tracking-widest">
          Loading Playlist...
        </span>
      </div>
    );
  }

  // Error & Not Found handling
  if (playlistError || !playlist) {
    const is404 =
      !playlist ||
      (playlistError as any)?.status === 404 ||
      (playlistError as any)?.response?.status === 404;
    const is500 =
      (playlistError as any)?.status >= 500 ||
      (playlistError as any)?.response?.status >= 500;

    if (is404 && !is500) {
      return <NotFoundPage />;
    }
    if (is500) {
      return (
        <ServerErrorPage
          onRetry={() => {
            refetchPlaylist();
            refetchSongs();
          }}
        />
      );
    }
    return (
      <SomethingWentWrongPage
        error={playlistError as Error}
        reset={() => {
          refetchPlaylist();
          refetchSongs();
        }}
      />
    );
  }

  /* -------------------------------------------------------------------------- */
  /*                              PLAY ALL                                      */
  /* -------------------------------------------------------------------------- */

  const handleStreamAll = () => {
    if (songs.length === 0) return;
    const playerSongs = mapListToPlayerSongs(songs);
    playerActions.playAll(playerSongs);
    toast.success("Playing All", {
      description: `Starting playback for ${songs.length} tracks.`,
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

    const playerSongs = mapListToPlayerSongs(songs);
    playerActions.playAllFrom(playerSongs, index);
  };

  const handleRemoveSong = (songId: string, songTitle: string) => {
    toast.promise(removeSong.mutateAsync(songId), {
      loading: "Removing track...",
      success: "Track Removed",
      error: "Failed to remove",
      description: `"${songTitle}" removed from playlist.`,
    });
  };

  return (
    <div className="min-h-full pb-24 mx-2">
      {/* Hero Banner */}
      <PlaylistHeroBanner
        playlist={playlist}
        songs={songs}
        videoUrl={videoUrl}
        coverUrl={coverUrl}
        isUserPlaylist={Boolean(isUserPlaylist)}
        username={systemUser?.username}
        onStreamAll={handleStreamAll}
      />

      {/* Track List */}
      <PlaylistTrackTable
        songs={songs}
        currentSong={currentSong}
        isPlaying={isPlaying}
        isUserPlaylist={Boolean(isUserPlaylist)}
        onPlaySong={handlePlaySong}
        onRemoveSong={handleRemoveSong}
      />
    </div>
  );
}
