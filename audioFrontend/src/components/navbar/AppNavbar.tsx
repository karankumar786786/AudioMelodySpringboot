"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useStore } from "@tanstack/react-store";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  musicApi,
  type Artist,
  type Playlist,
  type SaveSearchHistoryPayload,
  type Song,
  type UserPlaylist,
} from "@/lib/api";
import { mapToPlayerSong } from "@/lib/player-utils";
import { previewPlayer } from "@/lib/preview-player";
import { playerActions, playerStore } from "@/store/player.store";
import { ConnectedDevicesModal } from "../ConnectedDevicesModal";
import { EditProfileModal } from "../EditProfileModal";
import { NavbarBrand } from "./NavbarBrand";
import { NavbarProfileMenu } from "./NavbarProfileMenu";
import { NavbarSearch } from "./NavbarSearch";

export function AppNavbar() {
  const systemUser = useStore(playerStore, (s) => s.systemUser);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [isDevicesModalOpen, setIsDevicesModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const router = useRouter();

  useEffect(() => {
    const handleScroll = () => {
      const mainEl = document.querySelector("main");
      const scrollY = mainEl ? mainEl.scrollTop : window.scrollY;
      setIsScrolled(scrollY > 10);
    };

    const mainEl = document.querySelector("main");
    if (mainEl) {
      mainEl.addEventListener("scroll", handleScroll, { passive: true });
    }
    window.addEventListener("scroll", handleScroll, { capture: true, passive: true });
    handleScroll();

    const t = setTimeout(handleScroll, 100);

    return () => {
      clearTimeout(t);
      if (mainEl) {
        mainEl.removeEventListener("scroll", handleScroll);
      }
      window.removeEventListener("scroll", handleScroll, { capture: true } as any);
    };
  }, [pathname]);

  // Debounce query
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const saveHistory = useMutation({
    mutationFn: (payload: SaveSearchHistoryPayload) =>
      musicApi.users.saveSearchHistory(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["search-history"] });
      queryClient.invalidateQueries({ queryKey: ["command-palette-history"] });
    },
  });

  const handlePlaySong = async (song: Song) => {
    previewPlayer.stopPreview(true);
    let songToPlay: Song = song;

    // Load full song details on-demand from the backend when clicked from Algolia search results
    if (!song.songKey && song.id) {
      try {
        const res = await musicApi.songs.getById(song.id);
        if (res?.data) {
          songToPlay = { ...song, ...res.data };
        }
      } catch (err) {
        console.warn("Failed to load song details from backend:", err);
      }
    }

    playerActions.playWithRadio(mapToPlayerSong(songToPlay));
    toast.success("Playing Song Radio", {
      description: `Starting infinite radio for "${songToPlay.title}"...`,
    });
    if (systemUser?.id && songToPlay.id) {
      saveHistory.mutate({ type: "SONG", songId: songToPlay.id });
    }
    // Search Dwell Validation: Stage search conversion (only confirmed after >= 15s listening)
    playerActions.stageSearchPlay(songToPlay.id);
    setIsFocused(false);
  };

  const handleArtistClick = (artist: Artist) => {
    router.push(`/artists/${artist.id}`);
    if (systemUser?.id && artist.id) {
      saveHistory.mutate({ type: "ARTIST", artistId: artist.id });
    }
    playerActions.recordSearchClick("ARTIST", artist.id, debouncedQuery || query);
    setIsFocused(false);
  };

  const handlePlaylistClick = (playlist: Playlist) => {
    router.push(`/playlists/${playlist.id}`);
    if (systemUser?.id && playlist.id) {
      saveHistory.mutate({ type: "PLAYLIST", playlistId: playlist.id });
    }
    playerActions.recordSearchClick("PLAYLIST", playlist.id, debouncedQuery || query);
    setIsFocused(false);
  };

  const handleUserPlaylistClick = (playlist: UserPlaylist) => {
    router.push(`/my-playlists/${playlist.id}`);
    if (systemUser?.id && playlist.id) {
      saveHistory.mutate({ type: "USER_PLAYLIST", userPlaylistId: playlist.id });
    }
    playerActions.recordSearchClick("PLAYLIST", playlist.id, debouncedQuery || query);
    setIsFocused(false);
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 h-16 z-50 flex items-center select-none pointer-events-auto transition-all duration-300 ease-out ${
        isScrolled
          ? "bg-black/60 backdrop-blur-xl border-b border-white/8 shadow-lg shadow-black/40"
          : "bg-transparent backdrop-blur-sm border-b border-white/3"
      }`}
    >
      {/* 1. Left: Brand & Logo */}
      <NavbarBrand />

      {/* 2. Main Section Header: Search & User Controls */}
      <div className="flex-1 flex items-center justify-between min-w-0 px-4 sm:px-6 md:px-8 xl:px-10 h-full">
        <NavbarSearch
          query={query}
          setQuery={setQuery}
          debouncedQuery={debouncedQuery}
          isFocused={isFocused}
          setIsFocused={setIsFocused}
          isScrolled={isScrolled}
          onPlaySong={handlePlaySong}
          onArtistClick={handleArtistClick}
          onPlaylistClick={handlePlaylistClick}
          onUserPlaylistClick={handleUserPlaylistClick}
        />

        <NavbarProfileMenu
          onOpenProfileModal={() => setIsProfileModalOpen(true)}
          onOpenDevicesModal={() => setIsDevicesModalOpen(true)}
        />
      </div>

      {/* Connected Devices Modal */}
      <ConnectedDevicesModal
        isOpen={isDevicesModalOpen}
        onClose={() => setIsDevicesModalOpen(false)}
      />

      {/* Edit Profile Modal */}
      <EditProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />
    </header>
  );
}
