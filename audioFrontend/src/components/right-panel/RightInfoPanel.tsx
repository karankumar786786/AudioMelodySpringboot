"use client";

import React, { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useStore } from "@tanstack/react-store";
import { Info } from "lucide-react";
import { toast } from "sonner";
import { musicApi, type Song } from "@/lib/api";
import { getImageUrl, getVideoUrl } from "@/lib/image-utils";
import { getSongInfo } from "@/lib/song-info";
import { playerActions, playerStore } from "@/store/player.store";
import { PlaylistPickerModal } from "@/components/PlaylistPickerModal";
import { RightInfoArtistSection } from "./RightInfoArtistSection";
import { RightInfoMediaHeader } from "./RightInfoMediaHeader";
import { RightInfoRelatedSongs } from "./RightInfoRelatedSongs";
import { RightInfoSongBioSection } from "./RightInfoSongBioSection";

export function RightInfoPanel() {
  const currentSong = useStore(playerStore, (s) => s.currentSong);
  const systemUser = useStore(playerStore, (s) => s.systemUser);
  const favourites = useStore(playerStore, (s) => s.favourites);

  const [isPlaylistModalOpen, setIsPlaylistModalOpen] = useState(false);
  const [isFavLoading, setIsFavLoading] = useState(false);
  const [mediaLoaded, setMediaLoaded] = useState(false);
  const queryClient = useQueryClient();
  const relatedSongsRef = useRef<HTMLDivElement>(null);

  // Reset mediaLoaded on song change
  useEffect(() => {
    setMediaLoaded(false);
  }, [currentSong?.id]);

  const scrollRelated = (distance: number) => {
    if (relatedSongsRef.current) {
      relatedSongsRef.current.scrollBy({ left: distance, behavior: "smooth" });
    }
  };

  const isFavourite = currentSong
    ? Array.from(favourites).some((id) => String(id) === String(currentSong.id))
    : false;

  // Song + Artist information (hydrates in background)
  const { data: info, isLoading: isInfoLoading } = useQuery({
    queryKey: [
      "song-info",
      currentSong?.id,
      currentSong?.title,
      currentSong?.artistName,
    ],
    queryFn: () =>
      getSongInfo(currentSong?.title || "", currentSong?.artistName || ""),
    enabled: !!currentSong,
    staleTime: 1000 * 60 * 60,
  });

  // 1. Similar songs from Radio recommendation engine
  const { data: similarSongs = [], isLoading: isSimilarLoading } = useQuery({
    queryKey: ["similar-songs", currentSong?.id],
    queryFn: async () => {
      if (!currentSong?.id) return [];
      const res = await musicApi.interactions.getRadioSongs(currentSong.id, [currentSong.id], 10);
      return res?.data?.data || [];
    },
    enabled: !!currentSong?.id,
    staleTime: 1000 * 60 * 5,
  });

  // 2. Feed fallback / artist tracks
  const { data: songsFeed, isLoading: isFeedLoading } = useQuery({
    queryKey: ["artist-more-songs", currentSong?.artistName],
    queryFn: async () => {
      const res = await musicApi.songs.getFeed(1, 50);
      return res?.data?.data || [];
    },
    enabled: !!currentSong?.artistName,
    staleTime: 1000 * 60 * 5,
  });

  // 3. Artist follow status / metadata for follower count
  const { data: artistFollowData } = useQuery({
    queryKey: ["artist-follow-status", currentSong?.artistName],
    queryFn: () => musicApi.artists.getFollowStatus(currentSong!.artistName),
    enabled: !!currentSong?.artistName,
    staleTime: 1000 * 60 * 5,
  });

  const isRelatedLoading = isSimilarLoading && isFeedLoading;

  const artistMoreSongs = React.useMemo<Song[]>(() => {
    if (!currentSong) return [];

    if (similarSongs && similarSongs.length >= 3) {
      return similarSongs.filter((s: Song) => s.id !== currentSong.id).slice(0, 10);
    }

    if (!songsFeed) return similarSongs || [];

    const normalizedArtist = currentSong.artistName.trim().toLowerCase();

    const artistMatches = songsFeed.filter(
      (s: Song) =>
        s.id !== currentSong.id &&
        s.artistName?.trim().toLowerCase().includes(normalizedArtist),
    );

    const combined = [...(similarSongs || []), ...artistMatches];
    const seen = new Set<string>();
    const unique = combined.filter((s: Song) => {
      if (s.id === currentSong.id || seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    });

    if (unique.length < 4) {
      const remaining = songsFeed.filter(
        (s: Song) => s.id !== currentSong.id && !seen.has(s.id),
      );
      return [...unique, ...remaining].slice(0, 10);
    }

    return unique.slice(0, 10);
  }, [similarSongs, songsFeed, currentSong]);

  if (!currentSong) {
    return (
      <aside className="w-80 bg-black h-screen fixed right-0 top-0 z-40 p-6 flex flex-col items-center justify-center text-center pb-24">
        <div className="w-14 h-14 rounded-full bg-[#181818] border border-[#282828] flex items-center justify-center text-zinc-600 mb-3">
          <Info size={24} />
        </div>

        <p className="text-sm font-semibold text-white">Song & Artist Info</p>

        <p className="text-xs text-zinc-400 mt-1 max-w-50">
          Play a song to view description, artist biography, and source links.
        </p>
      </aside>
    );
  }

  const activeVideoKey = currentSong.videoKey;

  const directVideoUrl = activeVideoKey
    ? getVideoUrl(activeVideoKey)
    : undefined;

  const songImage = currentSong.imageKey
    ? getImageUrl(currentSong.imageKey, {
        width: 700,
        height: 700,
        quality: 90,
        aspectRatio: "1-1",
      })
    : currentSong.posterUrl;

  const artistCoverUrl = currentSong.imageKey
    ? getImageUrl(currentSong.imageKey, {
        width: 600,
        height: 600,
        aspectRatio: "1-1",
      })
    : null;

  const handlePlaylist = () => {
    if (!systemUser?.id) {
      toast.error("Sign in required", {
        description: "Please sign in to add songs to playlists.",
      });
      return;
    }
    setIsPlaylistModalOpen(true);
  };

  const handleFavourite = async () => {
    if (!systemUser?.id) {
      toast.error("Sign in required", {
        description: "Please sign in to save songs to your library.",
      });
      return;
    }
    if (!currentSong?.id || isFavLoading) return;

    try {
      setIsFavLoading(true);
      const wasFav = isFavourite;
      await playerActions.toggleFavourite(currentSong.id);

      queryClient.invalidateQueries({ queryKey: ["favourites"] });
      queryClient.invalidateQueries({ queryKey: ["favourite-songs"] });

      toast.success(
        wasFav ? "Removed from Favourites" : "Added to Favourites",
        {
          description: wasFav
            ? `"${currentSong.title}" removed from your collection.`
            : `"${currentSong.title}" added to your collection.`,
        },
      );
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to update favourites");
    } finally {
      setIsFavLoading(false);
    }
  };

  const artistName = currentSong?.artistName?.trim() || "";

  return (
    <>
      <aside className="hidden lg:block w-72.5 xl:w-[320px] 2xl:w-85 bg-black h-[calc(100vh-64px)] fixed right-0 top-16 z-40 overflow-y-auto no-scrollbar pb-36">
        <div>
          {/* 1. MEDIA DISPLAY */}
          <RightInfoMediaHeader
            currentSong={currentSong}
            directVideoUrl={directVideoUrl}
            songImage={songImage}
            mediaLoaded={mediaLoaded}
            setMediaLoaded={setMediaLoaded}
            isFavourite={isFavourite}
            isFavLoading={isFavLoading}
            onPlaylist={handlePlaylist}
            onFavourite={handleFavourite}
            onOpenFullVideo={() => playerActions.openFullVideo()}
          />

          {/* Content Below Video */}
          <div className="px-4 pl-0 space-y-4">
            {/* 2. RELATED SONGS CAROUSEL */}
            <RightInfoRelatedSongs
              artistMoreSongs={artistMoreSongs}
              isRelatedLoading={isRelatedLoading}
              scrollRelated={scrollRelated}
              relatedSongsRef={relatedSongsRef}
            />

            {/* 3. ABOUT THE ARTIST */}
            <RightInfoArtistSection
              info={info}
              isInfoLoading={isInfoLoading}
              artistCoverUrl={artistCoverUrl}
              artistName={artistName}
              followersCount={artistFollowData?.data?.followersCount}
              artistId={artistFollowData?.data?.artistId}
            />

            {/* 4. ABOUT THE SONG */}
            <RightInfoSongBioSection
              description={info?.song?.description}
              source={info?.song?.source}
            />
          </div>
        </div>
      </aside>

      {/* Playlist Modal */}
      <PlaylistPickerModal
        isOpen={isPlaylistModalOpen}
        onClose={() => setIsPlaylistModalOpen(false)}
        songId={currentSong.id}
        songTitle={currentSong.title}
      />
    </>
  );
}
