"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { useStore } from "@tanstack/react-store";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { musicApi, type PlaylistPrivacy, type UserPlaylist } from "@/lib/api";
import { getSolidBgFromImage } from "@/lib/color-utils";
import { getImageUrl } from "@/lib/image-utils";
import { mapListToPlayerSongs } from "@/lib/player-utils";
import { previewPlayer } from "@/lib/preview-player";
import { playerActions, playerStore } from "@/store/player.store";
import { NotFoundPage, ServerErrorPage, SomethingWentWrongPage } from "@/components/ErrorPages";
import { PlaylistShareModal } from "@/components/PlaylistShareModal";
import { PlaylistHero, PlaylistRenameModal, PlaylistTrackList } from "./components";

export default function MyPlaylistPage() {
  const { id } = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();

  const systemUser = useStore(playerStore, (s) => s.systemUser);
  const currentSong = useStore(playerStore, (s) => s.currentSong);
  const isPlaying = useStore(playerStore, (s) => s.isPlaying);

  const [backgroundColor, setBackgroundColor] = useState("#181818");
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [renameText, setRenameText] = useState("");

  const isFavourites = id === "favourites";

  const renameMutation = useMutation({
    mutationFn: (name: string) => musicApi.users.renamePlaylist(id as string, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-playlist", id] });
      queryClient.invalidateQueries({ queryKey: ["user-playlists"] });
      toast.success("Playlist renamed");
      setIsRenameModalOpen(false);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err?.message || "Failed to rename playlist");
    },
  });

  const {
    data: playlistResponse,
    isLoading: isPlaylistLoading,
    error: playlistError,
    refetch: refetchPlaylist,
  } = useQuery({
    queryKey: ["user-playlist", id],
    queryFn: async () => {
      if (isFavourites) {
        const favouritesPlaylist: UserPlaylist = {
          id: "favourites",
          name: "Favourites",
          description: "Your saved collection of favourite tracks and songs.",
          privacy: "PRIVATE" as PlaylistPrivacy,
          ownerName: systemUser?.username || systemUser?.name || "You",
          ownerId: systemUser?.id || "",
          totalSongs: 0,
          coverImageKey: undefined,
        };
        return {
          data: favouritesPlaylist,
        };
      }
      return await musicApi.users.getPlaylistById(id as string);
    },
    enabled: isFavourites ? true : !!id,
  });

  const {
    data: songsResponse,
    isLoading: isSongsLoading,
    refetch: refetchSongs,
  } = useQuery({
    queryKey: isFavourites ? ["favourites", systemUser?.id] : ["user-playlist-songs", id],
    queryFn: () => (isFavourites ? musicApi.users.getFavourites() : musicApi.users.getPlaylistSongs(id as string)),
    enabled: isFavourites ? !!systemUser?.id : !!id,
  });

  const deletePlaylist = useMutation({
    mutationFn: () => musicApi.users.deletePlaylist(id as string),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-playlists"] });
      toast.success("Playlist deleted");
      router.push("/playlists");
    },
  });

  const { data: isSaved = false } = useQuery({
    queryKey: ["playlist-is-saved", id, systemUser?.id],
    queryFn: () => musicApi.users.isPlaylistSaved(id as string),
    enabled: !!systemUser?.id && !!id,
  });

  const toggleSaveMutation = useMutation({
    mutationFn: async () => {
      if (!systemUser?.id) {
        throw new Error("AUTH_REQUIRED");
      }
      if (!id) return;
      if (isSaved) {
        await musicApi.users.unsavePlaylistFromLibrary(id as string);
        return { isSaved: false };
      } else {
        await musicApi.users.savePlaylistToLibrary(id as string);
        return { isSaved: true };
      }
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["user-playlists"] });
      queryClient.invalidateQueries({ queryKey: ["playlist-is-saved", id] });
      if (res?.isSaved) {
        toast.success("Saved to your Library", {
          description: `"${playlist?.name}" is now in your library with dynamic live sync!`,
        });
      } else {
        toast.info("Removed from your Library");
      }
    },
    onError: (err: any) => {
      if (err?.message === "AUTH_REQUIRED") {
        toast.info("Please sign in", {
          description: "Sign in to save this playlist to your library.",
        });
      } else {
        toast.error(err?.response?.data?.message || err?.message || "Failed to update library");
      }
    },
  });

  const removeSong = useMutation({
    mutationFn: async (songId: string) => {
      if (isFavourites) {
        await musicApi.users.removeFavourite(songId);
      } else {
        await musicApi.users.removeSongFromPlaylist(id as string, songId);
      }
    },
    onSuccess: () => {
      if (isFavourites) {
        queryClient.invalidateQueries({ queryKey: ["favourites"] });
        playerActions.fetchFavourites();
      } else {
        queryClient.invalidateQueries({
          queryKey: ["user-playlist-songs", id],
          exact: false,
        });
      }
    },
  });

  const rawPlaylist = playlistResponse?.data;
  const songs = songsResponse?.data?.data || [];
  const playlist =
    isFavourites && rawPlaylist
      ? { ...rawPlaylist, totalSongs: songs.length }
      : rawPlaylist;

  const isOwner = isFavourites
    ? true
    : Boolean(
        systemUser?.id &&
          (playlist?.ownerId || playlist?.userId) &&
          (playlist.ownerId || playlist.userId) === systemUser.id
      );

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
  const showSingleSongImage = !hasCustomCover && songs.length > 0 && songs.length < 4;
  const singleSongImage = showSingleSongImage ? mosaicImages[0] : null;
  const colorSourceImage = coverUrl || mosaicImages[0] || null;

  useEffect(() => {
    let cancelled = false;
    async function extractColor() {
      if (isFavourites) {
        setBackgroundColor("#2e1065");
        return;
      }
      if (!colorSourceImage) {
        setBackgroundColor("#181818");
        return;
      }
      const color = await getSolidBgFromImage(colorSourceImage, playlist?.name || "playlist");
      if (!cancelled) setBackgroundColor(color);
    }
    extractColor();
    return () => {
      cancelled = true;
    };
  }, [colorSourceImage, playlist?.name, isFavourites]);

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

  if (playlistError || !playlist) {
    const errorStatus =
      (playlistError as any)?.status || (playlistError as any)?.response?.status;

    if (errorStatus === 403) {
      return (
        <div className="flex h-[60vh] flex-col items-center justify-center gap-4 text-center px-4">
          <div className="w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center text-amber-400 border border-white/10 shadow-xl">
            <Lock size={28} />
          </div>
          <h2 className="text-2xl font-bold text-white">Private Playlist</h2>
          <p className="text-sm text-zinc-400 max-w-md">
            This playlist is private and only accessible by its creator.
          </p>
          <button
            onClick={() => router.push("/home")}
            className="mt-3 px-6 py-2.5 rounded-full bg-white text-black font-semibold text-sm hover:bg-zinc-200 transition-colors shadow-lg cursor-pointer"
          >
            Explore Music
          </button>
        </div>
      );
    }

    const is404 = !playlist || errorStatus === 404;
    const is500 = errorStatus >= 500;

    if (is404 && !is500) {
      return <NotFoundPage />;
    }
    if (is500) {
      return <ServerErrorPage onRetry={() => { refetchPlaylist(); refetchSongs(); }} />;
    }
    return (
      <SomethingWentWrongPage
        error={playlistError as Error}
        reset={() => { refetchPlaylist(); refetchSongs(); }}
      />
    );
  }

  const handleStreamAll = () => {
    if (songs.length === 0) return;
    const playerSongs = mapListToPlayerSongs(songs);
    playerActions.playAll(playerSongs);
    toast.success("Playing All", {
      description: `Starting playback for ${songs.length} tracks.`,
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

  return (
    <div className="min-h-full pb-24">
      <PlaylistHero
        backgroundColor={backgroundColor}
        playlist={playlist}
        isFavourites={isFavourites}
        isOwner={isOwner}
        hasCustomCover={hasCustomCover}
        coverUrl={coverUrl}
        showMosaic={showMosaic}
        mosaicImages={mosaicImages}
        showSingleSongImage={showSingleSongImage}
        singleSongImage={singleSongImage}
        systemUser={systemUser}
        songs={songs}
        isSaved={isSaved}
        toggleSavePending={toggleSaveMutation.isPending}
        onStreamAll={handleStreamAll}
        onToggleSave={() => toggleSaveMutation.mutate()}
        onDeletePlaylist={() => {
          if (!confirm(`Delete "${playlist.name}"? This cannot be undone.`)) return;
          toast.promise(deletePlaylist.mutateAsync(), {
            loading: "Deleting playlist...",
            success: "Playlist deleted",
            error: "Failed to delete playlist",
          });
        }}
        onOpenShareModal={() => setIsShareModalOpen(true)}
        onOpenRenameModal={() => {
          setRenameText(playlist?.name || "");
          setIsRenameModalOpen(true);
        }}
      />

      {playlist && (
        <PlaylistShareModal
          playlist={playlist}
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          isOwner={isOwner}
        />
      )}

      <PlaylistRenameModal
        isOpen={isRenameModalOpen}
        renameText={renameText}
        setRenameText={setRenameText}
        isPending={renameMutation.isPending}
        onClose={() => setIsRenameModalOpen(false)}
        onSave={() => renameMutation.mutate(renameText.trim())}
      />

      <PlaylistTrackList
        songs={songs}
        currentSong={currentSong}
        isPlaying={isPlaying}
        isOwner={isOwner}
        isFavourites={isFavourites}
        systemUser={systemUser}
        onPlaySong={handlePlaySong}
        onRemoveSong={(song) => {
          toast.promise(removeSong.mutateAsync(song.id), {
            loading: isFavourites ? "Removing from favourites..." : "Removing track...",
            success: isFavourites ? "Removed from favourites" : "Track removed",
            error: "Failed to remove",
            description: isFavourites
              ? `"${song.title}" removed from your favourites.`
              : `"${song.title}" removed from playlist.`,
          });
        }}
      />
    </div>
  );
}