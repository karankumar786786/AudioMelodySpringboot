"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { musicApi } from "@/lib/api";
import { useParams, useRouter } from "next/navigation";
import { playerActions, playerStore } from "@/store/player.store";
import { mapListToPlayerSongs } from "@/lib/player-utils";
import { useStore } from "@tanstack/react-store";
import { toast } from "sonner";
import { getImageUrl } from "@/lib/image-utils";
import { getSolidBgFromImage } from "@/lib/color-utils";
import { NotFoundPage, ServerErrorPage, SomethingWentWrongPage } from "@/components/ErrorPages";
import { PlaylistShareModal } from "@/components/PlaylistShareModal";
import { PlaylistPickerModal } from "@/components/PlaylistPickerModal";
import { previewPlayer } from "@/lib/preview-player";
import {
  PrivatePlaylistNotice,
  SharedPlaylistHero,
  SharedPlaylistTrackList,
} from "./components";

export default function SharedPlaylistPage() {
  const { token } = useParams();
  const _router = useRouter();
  const queryClient = useQueryClient();

  const systemUser = useStore(playerStore, (s) => s.systemUser);
  const currentSong = useStore(playerStore, (s) => s.currentSong);
  const isPlaying = useStore(playerStore, (s) => s.isPlaying);

  const [backgroundColor, setBackgroundColor] = useState("#181818");
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [selectedSongForPicker, setSelectedSongForPicker] = useState<any | null>(null);

  const tokenStr = Array.isArray(token) ? token[0] : (token as string);

  /* -------------------------------------------------------------------------- */
  /*                               SHARED PLAYLIST                              */
  /* -------------------------------------------------------------------------- */

  const {
    data: playlistResponse,
    isLoading: isPlaylistLoading,
    error: playlistError,
    refetch: refetchPlaylist,
  } = useQuery({
    queryKey: ["shared-playlist", tokenStr],
    queryFn: () => musicApi.users.getSharedPlaylist(tokenStr),
    retry: 1,
  });

  /* -------------------------------------------------------------------------- */
  /*                             SHARED SONGS                                   */
  /* -------------------------------------------------------------------------- */

  const {
    data: songsResponse,
    isLoading: isSongsLoading,
    error: _songsError,
    refetch: refetchSongs,
  } = useQuery({
    queryKey: ["shared-playlist-songs", tokenStr],
    queryFn: () => musicApi.users.getSharedPlaylistSongs(tokenStr, 1, 100),
    enabled: !!playlistResponse?.data,
    retry: 1,
  });

  const playlist = playlistResponse?.data;
  const songs = songsResponse?.data?.data || [];

  const isOwner =
    Boolean(systemUser?.id && (playlist?.ownerId || playlist?.userId) && systemUser.id === (playlist.ownerId || playlist.userId));

  /* -------------------------------------------------------------------------- */
  /*                          SAVE PLAYLIST TO LIBRARY                          */
  /* -------------------------------------------------------------------------- */

  const targetIdOrToken = playlist?.id || tokenStr;

  const { data: isSaved = false } = useQuery({
    queryKey: ["playlist-is-saved", targetIdOrToken, systemUser?.id],
    queryFn: () => musicApi.users.isPlaylistSaved(targetIdOrToken),
    enabled: !!systemUser?.id && !!targetIdOrToken,
  });

  const toggleSaveMutation = useMutation({
    mutationFn: async () => {
      if (!systemUser?.id) {
        toast.error("Sign in required", {
          description: "Please sign in to save this playlist to your library.",
        });
        playerStore.setState((s) => ({ ...s, isAuthModalOpen: true }));
        return;
      }
      if (!targetIdOrToken) return;
      if (isSaved) {
        await musicApi.users.unsavePlaylistFromLibrary(targetIdOrToken);
        return { isSaved: false };
      } else {
        await musicApi.users.savePlaylistToLibrary(targetIdOrToken);
        return { isSaved: true };
      }
    },
    onSuccess: (res) => {
      if (!res) return;
      queryClient.invalidateQueries({ queryKey: ["user-playlists"] });
      queryClient.invalidateQueries({ queryKey: ["playlist-is-saved", targetIdOrToken] });
      if (res.isSaved) {
        toast.success("Saved to your Library!", {
          description: `"${playlist?.name}" is now in your library with dynamic live sync!`,
        });
      } else {
        toast.info("Removed from your Library");
      }
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err?.message || "Failed to update library");
    },
  });

  /* -------------------------------------------------------------------------- */
  /*                                COVER IMAGE                                 */
  /* -------------------------------------------------------------------------- */

  const coverUrl = getImageUrl(playlist?.coverImageKey, {
    width: 600,
    height: 600,
    focus: "auto",
    aspectRatio: "1-1",
  });

  const hasCustomCover = Boolean(coverUrl);

  const mosaicImages = songs.slice(0, 4).map((song: any) =>
    getImageUrl(song.imageKey || song.coverImageKey, {
      width: 300,
      height: 300,
      aspectRatio: "1-1",
    })
  );

  const showMosaic = !hasCustomCover && songs.length >= 4;
  const showSingleSongImage =
    !hasCustomCover && songs.length > 0 && songs.length < 4;
  const singleSongImage = showSingleSongImage ? mosaicImages[0] : null;

  const colorSourceImage = coverUrl || mosaicImages[0] || null;

  useEffect(() => {
    let cancelled = false;
    async function extractColor() {
      if (!colorSourceImage) {
        setBackgroundColor("#181818");
        return;
      }
      const color = await getSolidBgFromImage(
        colorSourceImage,
        playlist?.name || "shared-playlist"
      );
      if (!cancelled) setBackgroundColor(color);
    }
    extractColor();
    return () => {
      cancelled = true;
    };
  }, [colorSourceImage, playlist?.name]);

  /* -------------------------------------------------------------------------- */
  /*                                  LOADING                                   */
  /* -------------------------------------------------------------------------- */

  if (isPlaylistLoading || (playlist && isSongsLoading)) {
    return (
      <div className="flex h-[70vh] flex-col items-center justify-center gap-4 text-zinc-500">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
        <span className="text-xs font-black uppercase italic tracking-widest text-zinc-400">
          Loading Shared Playlist...
        </span>
      </div>
    );
  }

  /* -------------------------------------------------------------------------- */
  /*                           ERROR / PRIVATE STATES                           */
  /* -------------------------------------------------------------------------- */

  if (playlistError || !playlist) {
    const errorStatus =
      (playlistError as any)?.status ||
      (playlistError as any)?.response?.status;

    if (errorStatus === 403) {
      return <PrivatePlaylistNotice />;
    }

    if (errorStatus === 404) {
      return <NotFoundPage />;
    }
    if (errorStatus >= 500) {
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
  /*                              PLAYBACK HANDLERS                             */
  /* -------------------------------------------------------------------------- */

  const handleStreamAll = () => {
    if (songs.length === 0) return;
    const playerSongs = mapListToPlayerSongs(songs);
    playerActions.playAll(playerSongs);
    toast.success("Playing All Tracks", {
      description: `Started streaming ${songs.length} songs from "${playlist.name}".`,
    });
  };

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

  const privacy = playlist.privacy || "SHARE_BY_LINK";

  return (
    <div className="min-h-full pb-24">
      {/* Hero Header */}
      <SharedPlaylistHero
        playlist={playlist}
        songs={songs}
        backgroundColor={backgroundColor}
        coverUrl={coverUrl}
        hasCustomCover={hasCustomCover}
        showMosaic={showMosaic}
        mosaicImages={mosaicImages}
        showSingleSongImage={showSingleSongImage}
        singleSongImage={singleSongImage}
        privacy={privacy}
        isOwner={isOwner}
        isSaved={isSaved}
        isSavingPending={toggleSaveMutation.isPending}
        onStreamAll={handleStreamAll}
        onToggleSave={() => toggleSaveMutation.mutate()}
        onOpenShare={() => setIsShareModalOpen(true)}
      />

      {/* Share Modal */}
      <PlaylistShareModal
        playlist={playlist}
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        isOwner={isOwner}
      />

      {/* Song Picker Modal for adding individual song */}
      {selectedSongForPicker && (
        <PlaylistPickerModal
          songId={selectedSongForPicker.id}
          songTitle={selectedSongForPicker.title}
          isOpen={Boolean(selectedSongForPicker)}
          onClose={() => setSelectedSongForPicker(null)}
        />
      )}

      {/* Track List */}
      <SharedPlaylistTrackList
        songs={songs}
        currentSong={currentSong}
        isPlaying={isPlaying}
        onPlaySong={handlePlaySong}
        onSelectSongForPicker={setSelectedSongForPicker}
      />
    </div>
  );
}
