"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { musicApi, type UserPlaylist } from "@/lib/api";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ListMusic,
  Play,
  Pause,
  Clock,
  Music,
  Share2,
  Globe,
  Lock,
  Link2,
  BookmarkPlus,
  BookmarkCheck,
  Plus,
} from "lucide-react";
import { playerActions, playerStore } from "@/store/player.store";
import { mapListToPlayerSongs } from "@/lib/player-utils";
import { useStore } from "@tanstack/react-store";
import { toast } from "sonner";
import { getImageUrl } from "@/lib/image-utils";
import { getSolidBgFromImage } from "@/lib/color-utils";
import { NotFoundPage, ServerErrorPage, SomethingWentWrongPage } from "@/components/ErrorPages";
import { PlaylistShareModal } from "@/components/PlaylistShareModal";
import { PlaylistPickerModal } from "@/components/PlaylistPickerModal";
import Link from "next/link";

export default function SharedPlaylistPage() {
  const { token } = useParams();
  const router = useRouter();
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
    error: songsError,
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
    Boolean(systemUser?.id && playlist?.ownerId && systemUser.id === playlist.ownerId);

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
    onError: () => {
      toast.error("Failed to update library");
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

    // Check for 403 Forbidden (Private Playlist)
    if (errorStatus === 403) {
      return (
        <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-md w-full rounded-2xl bg-[#141414] border border-[#282828] p-8 shadow-2xl space-y-5"
          >
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/25">
              <Lock size={32} />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold text-white tracking-tight">
                This Playlist is Private
              </h2>
              <p className="text-xs text-zinc-400 leading-relaxed">
                The creator of this playlist has set its privacy to Private. Ask the owner to switch it to <strong>"Share by link"</strong> or <strong>"Public"</strong>.
              </p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
              <Link
                href="/playlists"
                className="flex-1 py-2.5 px-4 rounded-xl bg-primary text-black font-bold text-xs hover:bg-primary/90 transition-all text-center"
              >
                Browse Playlists
              </Link>
              <Link
                href="/home"
                className="flex-1 py-2.5 px-4 rounded-xl bg-zinc-800 text-zinc-200 font-semibold text-xs hover:bg-zinc-700 transition-all text-center border border-zinc-700"
              >
                Home
              </Link>
            </div>
          </motion.div>
        </div>
      );
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
    const isActive = currentSong?.id === song.id;
    if (isActive) {
      playerActions.setIsPlaying(!isPlaying);
      return;
    }
    const playerSongs = mapListToPlayerSongs(songs);
    playerActions.playAllFrom(playerSongs, index);
  };

  const formatDuration = (val?: number | string) => {
    if (!val) return "0:00";
    const num = typeof val === "string" ? parseFloat(val) : val;
    if (isNaN(num) || num <= 0) return "0:00";
    const totalSeconds = num > 10000 ? Math.floor(num / 1000) : Math.floor(num);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const privacy = playlist.privacy || "SHARE_BY_LINK";

  return (
    <div className="min-h-full pb-24">
      {/* ====================================================================== */}
      {/*                              HERO                                      */}
      {/* ====================================================================== */}

      <section
        className="relative overflow-hidden px-8 pb-8 pt-24 md:px-10 md:pt-28"
        style={{
          background: `linear-gradient(to bottom, ${backgroundColor} 0%, ${backgroundColor} 35%, rgba(0,0,0,0.94) 100%)`,
        }}
      >
        <div className="relative z-10 flex flex-col items-center gap-7 md:flex-row md:items-end">
          {/* Cover */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="h-52 w-52 shrink-0 overflow-hidden rounded-md bg-zinc-900 shadow-2xl md:h-56 md:w-56"
          >
            {hasCustomCover ? (
              <img
                src={coverUrl}
                alt={playlist.name}
                className="h-full w-full object-cover"
              />
            ) : showMosaic ? (
              <div className="grid h-full w-full grid-cols-2 grid-rows-2">
                {mosaicImages.map((img: string | null, i: number) =>
                  img ? (
                    <img
                      key={i}
                      src={img}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div
                      key={i}
                      className="flex h-full w-full items-center justify-center bg-zinc-800"
                    >
                      <Music size={20} className="text-zinc-600" />
                    </div>
                  )
                )}
              </div>
            ) : showSingleSongImage && singleSongImage ? (
              <img
                src={singleSongImage}
                alt={playlist.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <ListMusic size={64} className="text-zinc-600" />
              </div>
            )}
          </motion.div>

          {/* Details */}
          <motion.div
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35, delay: 0.05 }}
            className="min-w-0 flex-1 pb-1"
          >
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-white/80">
                Shared Playlist
              </span>
              <span>•</span>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide border ${
                  privacy === "PUBLIC"
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                    : "bg-blue-500/20 text-blue-300 border-blue-500/40"
                }`}
              >
                {privacy === "PUBLIC" ? (
                  <>
                    <Globe size={11} /> Public
                  </>
                ) : (
                  <>
                    <Link2 size={11} /> Shared by Link
                  </>
                )}
              </span>
            </div>

            <h1 className="break-words text-4xl font-black tracking-tight text-white md:text-6xl">
              {playlist.name}
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/75">
              {playlist.description || "A playlist curated and shared on AudioMelody."}
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-white/80">
              <span className="font-semibold text-white">
                Curated by {playlist.ownerName || "AudioMelody User"}
              </span>
              <span>•</span>
              <span>
                {songs.length} {songs.length === 1 ? "song" : "songs"}
              </span>

              {songs.length > 0 && (
                <>
                  <span>•</span>
                  <span>
                    {formatDuration(
                      songs.reduce(
                        (total: number, song: any) =>
                          total + (Number(song.duration) || 0),
                        0
                      )
                    )}
                  </span>

                  <button
                    type="button"
                    onClick={handleStreamAll}
                    className="ml-2 flex items-center gap-1.5 rounded-full bg-white px-5 py-2 text-sm font-semibold text-black transition-all hover:bg-white/80 hover:scale-105 cursor-pointer shadow-lg"
                  >
                    <Play size={15} fill="black" />
                    Play All
                  </button>
                </>
              )}

              {/* Save / Unsave to Library (Dynamic Reference) */}
              {!isOwner && (
                <button
                  type="button"
                  onClick={() => toggleSaveMutation.mutate()}
                  disabled={toggleSaveMutation.isPending}
                  className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                    isSaved
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-red-500/20 hover:text-red-300 hover:border-red-500/40"
                      : "bg-white/10 hover:bg-white/20 border border-white/20 text-white"
                  }`}
                  title={isSaved ? "Click to remove from your library" : "Save to library (Live updates by creator)"}
                >
                  {isSaved ? (
                    <>
                      <BookmarkCheck size={13} className="text-emerald-400" />
                      <span>{toggleSaveMutation.isPending ? "Updating..." : "Saved in Library"}</span>
                    </>
                  ) : (
                    <>
                      <BookmarkPlus size={13} className="text-primary" />
                      <span>{toggleSaveMutation.isPending ? "Saving..." : "Save to Library"}</span>
                    </>
                  )}
                </button>
              )}

              {/* Owner Edit Shortcut */}
              {isOwner && (
                <Link
                  href={`/my-playlists/${playlist.id}`}
                  className="flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3.5 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/20"
                >
                  Edit in My Playlists
                </Link>
              )}

              {/* Share button */}
              <button
                type="button"
                onClick={() => setIsShareModalOpen(true)}
                className="flex items-center gap-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 px-3.5 py-1.5 text-xs font-semibold text-white transition-all cursor-pointer"
                title="Share this playlist"
              >
                <Share2 size={13} />
                <span>Share</span>
              </button>
            </div>
          </motion.div>
        </div>
      </section>

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

      {/* ====================================================================== */}
      {/*                              TRACK LIST                                */}
      {/* ====================================================================== */}

      <section className="px-6 pb-10 pt-6 md:px-10">
        {/* Header */}
        <div className="grid grid-cols-12 items-center border-b border-white/10 px-4 pb-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
          <div className="col-span-1 text-center">#</div>
          <div className="col-span-7 md:col-span-6">Title</div>
          <div className="col-span-3 hidden md:block">Artist</div>
          <div className="col-span-4 text-right md:col-span-2">
            <Clock size={16} className="ml-auto" />
          </div>
        </div>

        {/* Songs */}
        <div className="mt-2 flex flex-col">
          {songs.length > 0 ? (
            songs.map((song: any, index: number) => {
              const isActive = currentSong?.id === song.id;
              const isCurrentPlaying = isActive && isPlaying;

              const songImage = getImageUrl(song.imageKey || song.coverImageKey, {
                width: 100,
                height: 100,
                aspectRatio: "1-1",
              });

              return (
                <motion.div
                  key={song.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2, delay: Math.min(index * 0.015, 0.3) }}
                  onClick={() => handlePlaySong(song, index)}
                  className={`group grid cursor-pointer grid-cols-12 items-center rounded-md px-4 py-2.5 transition-colors duration-150 ${
                    isActive ? "bg-white/10" : "hover:bg-white/[0.07]"
                  }`}
                >
                  {/* Index */}
                  <div className="col-span-1 flex items-center justify-center">
                    {isActive ? (
                      isCurrentPlaying ? (
                        <Pause size={14} className="text-primary" fill="currentColor" />
                      ) : (
                        <Play size={14} className="text-primary" fill="currentColor" />
                      )
                    ) : (
                      <>
                        <span className="text-xs text-zinc-500 group-hover:hidden">{index + 1}</span>
                        <Play size={14} fill="white" className="hidden text-white group-hover:block" />
                      </>
                    )}
                  </div>

                  {/* Title */}
                  <div className="col-span-7 flex min-w-0 items-center gap-3 md:col-span-6">
                    <div className="h-11 w-11 shrink-0 overflow-hidden rounded-md bg-zinc-900">
                      {songImage ? (
                        <img src={songImage} alt={song.title} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <Music size={17} className="text-zinc-600" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className={`truncate text-sm font-medium transition-colors ${isActive ? "text-primary" : "text-white"}`}>
                        {song.title}
                      </h4>
                      <p className="mt-0.5 truncate text-xs text-zinc-400">{song.artistName}</p>
                    </div>
                  </div>

                  {/* Artist */}
                  <div className="col-span-3 hidden min-w-0 md:block">
                    <span className="block truncate text-sm text-zinc-400 transition-colors group-hover:text-white">
                      {song.artistName}
                    </span>
                  </div>

                  {/* Add to my playlist / Duration */}
                  <div className="col-span-4 flex items-center justify-end gap-3 text-xs tabular-nums text-zinc-400 md:col-span-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedSongForPicker(song);
                      }}
                      className="hidden rounded p-1 text-zinc-500 transition-colors hover:text-white group-hover:block"
                      title="Add to one of my playlists"
                    >
                      <Plus size={15} />
                    </button>
                    <span>{formatDuration(song.duration)}</span>
                  </div>
                </motion.div>
              );
            })
          ) : (
            <div className="rounded-xl border border-dashed border-white/10 py-20 text-center">
              <Music size={40} className="mx-auto mb-4 text-zinc-700" />
              <p className="text-sm text-zinc-500">No tracks in this playlist yet.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
