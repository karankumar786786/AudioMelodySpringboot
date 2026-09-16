"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useStore } from "@tanstack/react-store";
import { AnimatePresence, motion } from "framer-motion";
import {
  History,
  ListMusic,
  Loader2,
  LogOut,
  Play,
  Search,
  User,
  BookmarkPlus,
  X,
  Trash2,
  Music,
  Sun,
  Moon,
  Heart,
} from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  musicApi,
  SaveSearchHistoryPayload,
  SearchHistoryItem,
  Song,
  Artist,
  Playlist,
  UserPlaylist,
} from "@/lib/api";
import { getImageUrl } from "@/lib/image-utils";
import { mapToPlayerSong } from "@/lib/player-utils";
import { previewPlayer } from "@/lib/preview-player";
import { playerActions, playerStore } from "@/store/player.store";
import { SongThumbnail } from "./SongThumbnail";

export function AppNavbar() {
  const systemUser = useStore(playerStore, (s) => s.systemUser);
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const queryClient = useQueryClient();
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  const getGreeting = () => {
    const hrs = new Date().getHours();
    if (hrs < 12) return "Good Morning";
    if (hrs < 18) return "Good Afternoon";
    return "Good Evening";
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  // Debounce query
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Fetch History (returns grouped + recent items)
  const { data: searchHistoryData, isLoading: isHistoryLoading } = useQuery({
    queryKey: ["search-history", systemUser?.id],
    queryFn: () => musicApi.users.getSearchHistory(),
    enabled: !!systemUser?.id && isFocused && !query.trim(),
  });

  // Fetch Live Results
  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ["active-search", debouncedQuery],
    queryFn: () => musicApi.search.unified(debouncedQuery),
    enabled: isFocused && !!debouncedQuery.trim(),
  });

  const saveHistory = useMutation({
    mutationFn: (payload: SaveSearchHistoryPayload) =>
      musicApi.users.saveSearchHistory(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["search-history"] });
      queryClient.invalidateQueries({ queryKey: ["command-palette-history"] });
    },
  });

  const deleteHistoryItem = useMutation({
    mutationFn: (id: string) => musicApi.users.deleteSearchHistoryItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["search-history"] });
      queryClient.invalidateQueries({ queryKey: ["command-palette-history"] });
    },
  });

  const clearHistory = useMutation({
    mutationFn: () => musicApi.users.clearSearchHistory(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["search-history"] });
      queryClient.invalidateQueries({ queryKey: ["command-palette-history"] });
      toast.success("Search history cleared");
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
  };

  const handleRecentClick = (item: SearchHistoryItem) => {
    if (item.type === "SONG" && item.song) {
      handlePlaySong(item.song);
    } else if (item.type === "ARTIST" && item.artist) {
      handleArtistClick(item.artist);
    } else if (item.type === "PLAYLIST" && item.playlist) {
      handlePlaylistClick(item.playlist);
    } else if (item.type === "USER_PLAYLIST" && item.userPlaylist) {
      handleUserPlaylistClick(item.userPlaylist);
    }
  };

  const handlePlaySong = (song: Song) => {
    previewPlayer.stopPreview(true);
    playerActions.playWithRadio(mapToPlayerSong(song));
    toast.success("Playing Song Radio", {
      description: `Starting infinite radio for "${song.title}"...`,
    });
    if (systemUser?.id && song.id) {
      saveHistory.mutate({ type: "SONG", songId: song.id });
    }
    setIsFocused(false);
  };

  const handleArtistClick = (artist: Artist) => {
    router.push(`/artists/${artist.id}`);
    if (systemUser?.id && artist.id) {
      saveHistory.mutate({ type: "ARTIST", artistId: artist.id });
    }
    setIsFocused(false);
  };

  const handlePlaylistClick = (playlist: Playlist) => {
    router.push(`/playlists/${playlist.id}`);
    if (systemUser?.id && playlist.id) {
      saveHistory.mutate({ type: "PLAYLIST", playlistId: playlist.id });
    }
    setIsFocused(false);
  };

  const handleUserPlaylistClick = (playlist: UserPlaylist) => {
    router.push(`/userplaylist/${playlist.id}`);
    if (systemUser?.id && playlist.id) {
      saveHistory.mutate({ type: "USER_PLAYLIST", userPlaylistId: playlist.id });
    }
    setIsFocused(false);
  };

  const savePlaylistMutation = useMutation({
    mutationFn: (playlistId: string) => musicApi.users.savePlaylistToLibrary(playlistId),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["user-playlists"] });
      toast.success("Saved to your Library!", {
        description: `Playlist added to your playlists.`,
        action: res?.data?.id
          ? {
              label: "View",
              onClick: () => router.push(`/my-playlists/${res.data.id}`),
            }
          : undefined,
      });
    },
    onError: () => {
      toast.error("Failed to save playlist");
    },
  });

  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsFocused(false);
      }
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(e.target as Node)
      ) {
        setShowProfileMenu(false);
      }
    };

    const handleGlobalShortcuts = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        (activeEl as HTMLElement)?.isContentEditable;

      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        searchInputRef.current?.focus();
        setIsFocused(true);
      } else if (e.key === "/" && !e.shiftKey && !isInput) {
        e.preventDefault();
        searchInputRef.current?.focus();
        setIsFocused(true);
      } else if (e.key === "Escape") {
        if (isFocused) {
          setIsFocused(false);
          searchInputRef.current?.blur();
        }
        if (showProfileMenu) {
          setShowProfileMenu(false);
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleGlobalShortcuts);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleGlobalShortcuts);
    };
  }, [isFocused, showProfileMenu]);

  const recentHistory: SearchHistoryItem[] = searchHistoryData?.data?.recent || [];

  return (
    <header className="fixed top-0 left-0 right-0 h-16 z-50 flex items-center bg-black  select-none pointer-events-auto">
      {/* 1. Left: Brand & Logo (aligned with sidebar width) */}
      <div className="w-[64px] xl:w-[192px] shrink-0 h-full px-2 xl:px-3 flex items-center">
        <Link
          href="/home"
          className="flex items-center gap-2.5 px-1 group cursor-pointer"
          title="One Melody"
        >
          <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center overflow-hidden shrink-0 border border-white/10 group-hover:border-white/20 transition-all">
            <img
              src="/image.png"
              alt="Logo"
              className="w-full h-full object-contain"
            />
          </div>
          <span className="hidden xl:inline text-base xl:text-lg font-bold text-white tracking-tight group-hover:text-white/90 transition-colors">
            One Melody
          </span>
        </Link>
      </div>

      {/* 2. Main Section Header: Search starts exactly at main section position */}
      <div className="flex-1 flex items-center justify-between min-w-0 px-4 sm:px-6 md:px-8 xl:px-10 h-full">
        {/* Search Input Container */}
        <div
          className="w-full max-w-md sm:max-w-lg lg:max-w-xl relative"
          ref={menuRef}
        >
        <form
          onSubmit={handleSearch}
          className="relative group rounded-full w-full"
        >
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search for songs, artists, albums or playlists..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsFocused(true)}
            className="bg-[#16171b] border border-white/10 hover:border-white/20 focus:border-white/30 rounded-full py-2.5 pl-11 pr-16 text-xs sm:text-[13px] font-medium focus:ring-0 transition-all outline-none w-full text-white placeholder-zinc-400 shadow-inner relative z-10"
          />
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-400 group-focus-within:text-white transition-colors z-20">
            <Search size={16} />
          </div>
          <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center gap-1 pointer-events-none z-20">
            <kbd className="hidden sm:inline-flex items-center justify-center w-[20px] h-[20px] rounded bg-white/[0.08] border border-white/10 text-[10px] font-mono text-zinc-400 select-none shadow-sm">
              ⌘
            </kbd>
            <kbd className="hidden sm:inline-flex items-center justify-center w-[20px] h-[20px] rounded bg-white/[0.08] border border-white/10 text-[10px] font-mono text-zinc-400 select-none shadow-sm">
              K
            </kbd>
          </div>
        </form>

        <AnimatePresence>
          {isFocused && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              className="absolute top-full left-0 mt-2 w-full bg-[#181818] border border-[#282828] rounded-2xl shadow-2xl overflow-hidden pointer-events-auto z-50 max-h-[70vh] flex flex-col"
            >
              {!query.trim() ? (
                /* RECENT SEARCHES (RICH CARDS & LIST) */
                <div className="flex-1 overflow-y-auto no-scrollbar">
                  <div className="p-3 border-b border-[#282828] flex items-center justify-between sticky top-0 bg-[#181818] z-10">
                    <span className="text-xs font-semibold text-zinc-400">
                      Recent Searches
                    </span>
                    {recentHistory.length > 0 && (
                      <button
                        type="button"
                        onClick={() => clearHistory.mutate()}
                        className="text-[11px] font-medium text-zinc-500 hover:text-red-400 flex items-center gap-1 transition-colors"
                      >
                        <Trash2 size={12} />
                        Clear all
                      </button>
                    )}
                  </div>
                  <div className="p-2 space-y-1">
                    {!systemUser ? (
                      <div className="p-6 text-center text-zinc-500 text-xs font-normal">
                        Sign in to save your recent searches.
                      </div>
                    ) : isHistoryLoading ? (
                      <div className="p-6 text-center text-zinc-500 text-xs flex items-center justify-center gap-2">
                        <Loader2 size={14} className="animate-spin text-primary" />
                        Loading recent searches...
                      </div>
                    ) : recentHistory.length === 0 ? (
                      <div className="p-6 text-center text-zinc-500 text-xs font-normal">
                        No recent searches found.
                      </div>
                    ) : (
                      recentHistory.map((item) => {
                        const isSong = item.type === "SONG" && !!item.song;
                        const isArtist = item.type === "ARTIST" && !!item.artist;
                        const isPlaylist = item.type === "PLAYLIST" && !!item.playlist;
                        const isUserPlaylist = item.type === "USER_PLAYLIST" && !!item.userPlaylist;

                        return (
                          <div
                            key={item.id}
                            onClick={() => handleRecentClick(item)}
                            className="w-full flex items-center gap-3 p-2 hover:bg-[#282828] rounded-lg transition-all text-left group cursor-pointer"
                          >
                            {/* Rich Thumbnail with Hover Preview for Songs */}
                            {isSong && item.song ? (
                              <SongThumbnail
                                song={item.song}
                                sizeClass="w-10 h-10"
                                roundedClass="rounded-md"
                                enablePreviewHover={true}
                                onPlayClick={() => handlePlaySong(item.song!)}
                              />
                            ) : isArtist && item.artist ? (
                              <div className="w-10 h-10 rounded-full bg-zinc-900 overflow-hidden shrink-0 flex items-center justify-center border border-white/5">
                                {item.artist.coverImageKey ? (
                                  <img
                                    src={getImageUrl(item.artist.coverImageKey, {
                                      width: 80,
                                      height: 80,
                                      focus: "face",
                                      aspectRatio: "1-1",
                                    })}
                                    className="w-full h-full object-cover"
                                    alt=""
                                  />
                                ) : (
                                  <User size={16} className="text-zinc-500" />
                                )}
                              </div>
                            ) : (isPlaylist && item.playlist) || (isUserPlaylist && item.userPlaylist) ? (
                              <div className="w-10 h-10 rounded-md bg-zinc-900 overflow-hidden shrink-0 flex items-center justify-center border border-white/5">
                                {(item.playlist?.coverImageKey || item.userPlaylist?.coverImageKey) ? (
                                  <img
                                    src={getImageUrl(
                                      (item.playlist?.coverImageKey || item.userPlaylist?.coverImageKey)!,
                                      {
                                        width: 80,
                                        height: 80,
                                        focus: "auto",
                                        aspectRatio: "1-1",
                                      }
                                    )}
                                    className="w-full h-full object-cover"
                                    alt=""
                                  />
                                ) : (
                                  <ListMusic size={16} className="text-zinc-500" />
                                )}
                              </div>
                            ) : (
                              <div className="w-10 h-10 rounded-md bg-zinc-900/60 overflow-hidden shrink-0 flex items-center justify-center border border-white/5 text-zinc-400">
                                <History size={16} />
                              </div>
                            )}

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-white truncate">
                                {isSong
                                  ? item.song?.title
                                  : isArtist
                                  ? item.artist?.name
                                  : isPlaylist
                                  ? item.playlist?.name
                                  : item.userPlaylist?.name}
                              </p>
                              <p className="text-[11px] text-zinc-400 font-normal truncate">
                                {isSong
                                  ? item.song?.artistName || "Song"
                                  : isArtist
                                  ? "Artist"
                                  : isPlaylist
                                  ? "Playlist"
                                  : item.userPlaylist?.ownerName
                                  ? `By ${item.userPlaylist.ownerName}`
                                  : "Community Playlist"}
                              </p>
                            </div>

                            {/* Actions: Play if Song, Delete item */}
                            <div className="flex items-center gap-1 shrink-0">
                              {isSong && item.song && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handlePlaySong(item.song!);
                                  }}
                                  className="p-1.5 rounded-full hover:bg-white/10 text-primary opacity-0 group-hover:opacity-100 transition-all"
                                  title="Play"
                                >
                                  <Play size={14} fill="currentColor" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteHistoryItem.mutate(item.id);
                                }}
                                className="p-1.5 rounded-full hover:bg-white/10 text-zinc-500 hover:text-zinc-200 transition-colors opacity-0 group-hover:opacity-100"
                                title="Remove from history"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              ) : (
                /* LIVE SEARCH RESULTS */
                <div className="flex-1 overflow-y-auto no-scrollbar">
                  <div className="p-3 border-b border-[#282828] flex items-center justify-between sticky top-0 bg-[#181818] z-10">
                    <span className="text-xs font-semibold text-zinc-400">
                      Search Results
                    </span>
                    {isSearching && (
                      <Loader2
                        size={14}
                        className="text-primary animate-spin"
                      />
                    )}
                  </div>

                  <div className="p-2 space-y-1">
                    {/* Songs */}
                    {(searchResults?.data?.songs?.length ?? 0) > 0 && (
                      <div className="mb-3">
                        <h4 className="px-3 py-1 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                          Songs
                        </h4>
                        {searchResults?.data?.songs.map((song: Song) => (
                          <div
                            key={song.id}
                            onClick={() => handlePlaySong(song)}
                            className="w-full flex items-center gap-3 p-2 hover:bg-[#282828] rounded-lg transition-all text-left group cursor-pointer"
                          >
                            <SongThumbnail
                              song={song}
                              sizeClass="w-10 h-10"
                              enablePreviewHover={true}
                              onPlayClick={() => handlePlaySong(song)}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-white truncate">
                                {song.title}
                              </p>
                              <p className="text-[11px] text-zinc-400 font-normal truncate">
                                {song.artistName}
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0 mr-1">
                              <Play
                                size={15}
                                className="text-primary opacity-0 group-hover:opacity-100 transition-all"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Artists */}
                    {(searchResults?.data?.artists?.length ?? 0) > 0 && (
                      <div className="mb-3">
                        <h4 className="px-3 py-1 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                          Artists
                        </h4>
                        {searchResults?.data?.artists.map((artist: Artist) => (
                          <button
                            key={artist.id}
                            onClick={() => handleArtistClick(artist)}
                            className="w-full flex items-center gap-3 p-2 hover:bg-[#282828] rounded-lg transition-all text-left group"
                          >
                            <div className="w-10 h-10 rounded-full bg-zinc-900 overflow-hidden shrink-0 flex items-center justify-center">
                              {artist.coverImageKey ? (
                                <img
                                  src={getImageUrl(artist.coverImageKey, {
                                    width: 100,
                                    height: 100,
                                    focus: "face",
                                    aspectRatio: "1-1",
                                  })}
                                  className="w-full h-full object-cover"
                                  alt=""
                                />
                              ) : (
                                <User size={16} className="text-zinc-500" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-white truncate">
                                {artist.name}
                              </p>
                              <p className="text-[11px] text-zinc-400 font-normal">
                                Artist
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Official/System Playlists */}
                    {(searchResults?.data?.playlists?.length ?? 0) > 0 && (
                      <div className="mb-3">
                        <h4 className="px-3 py-1 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                          Official Playlists
                        </h4>
                        {searchResults?.data?.playlists.map((playlist: Playlist) => (
                          <button
                            key={playlist.id}
                            onClick={() => handlePlaylistClick(playlist)}
                            className="w-full flex items-center gap-3 p-2 hover:bg-[#282828] rounded-lg transition-all text-left group"
                          >
                            <div className="w-10 h-10 rounded-md bg-zinc-900 overflow-hidden shrink-0 flex items-center justify-center">
                              {playlist.coverImageKey ? (
                                <img
                                  src={getImageUrl(playlist.coverImageKey, {
                                    width: 100,
                                    height: 100,
                                    focus: "auto",
                                    aspectRatio: "1-1",
                                  })}
                                  className="w-full h-full object-cover"
                                  alt=""
                                />
                              ) : (
                                <ListMusic
                                  size={16}
                                  className="text-zinc-500"
                                />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-white truncate">
                                {playlist.name}
                              </p>
                              <p className="text-[11px] text-zinc-400 font-normal">
                                Official Playlist
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Community / User Playlists */}
                    {(searchResults?.data?.userPlaylists?.length ?? 0) > 0 && (
                      <div>
                        <h4 className="px-3 py-1 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                          Community Playlists
                        </h4>
                        {searchResults?.data?.userPlaylists.map((playlist: UserPlaylist) => (
                          <button
                            key={playlist.id}
                            onClick={() => handleUserPlaylistClick(playlist)}
                            className="w-full flex items-center gap-3 p-2 hover:bg-[#282828] rounded-lg transition-all text-left group"
                          >
                            <div className="w-10 h-10 rounded-md bg-zinc-900 overflow-hidden shrink-0 flex items-center justify-center">
                              {playlist.coverImageKey ? (
                                <img
                                  src={getImageUrl(playlist.coverImageKey, {
                                    width: 100,
                                    height: 100,
                                    focus: "auto",
                                    aspectRatio: "1-1",
                                  })}
                                  className="w-full h-full object-cover"
                                  alt=""
                                />
                              ) : (
                                <ListMusic
                                  size={16}
                                  className="text-zinc-500"
                                />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-white truncate">
                                {playlist.name}
                              </p>
                              <p className="text-[11px] text-zinc-400 font-normal truncate">
                                {playlist.ownerName ? `By ${playlist.ownerName}` : "User Playlist"}
                              </p>
                            </div>
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!systemUser?.id) {
                                  toast.info("Sign in required", {
                                    description: "Please sign in to save playlists to your library.",
                                  });
                                  return;
                                }
                                savePlaylistMutation.mutate(playlist.id);
                              }}
                              className="p-1.5 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                              title="Save to your library"
                            >
                              <BookmarkPlus size={15} />
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {debouncedQuery.trim() &&
                      !isSearching &&
                      !searchResults?.data?.songs?.length &&
                      !searchResults?.data?.artists?.length &&
                      !searchResults?.data?.playlists?.length &&
                      !searchResults?.data?.userPlaylists?.length && (
                        <div className="p-6 text-center bg-[#282828]/50 rounded-lg m-2">
                          <Search
                            size={20}
                            className="mx-auto mb-2 text-zinc-500"
                          />
                          <p className="text-xs font-medium text-zinc-400">
                            No results found for "{query}"
                          </p>
                        </div>
                      )}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* User & Actions */}
      <div className="flex items-center gap-4 sm:gap-5 shrink-0 pointer-events-auto ml-4">
        {mounted && !!systemUser ? (
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Sun icon & Greeting */}
            <div className="hidden sm:flex items-center gap-2 text-xs sm:text-[13px] text-zinc-300 select-none">
              <Sun size={17} className="text-zinc-300 stroke-[1.75] shrink-0" />
              <span className="truncate max-w-[180px] md:max-w-none">
                {getGreeting()},{" "}
                <span className="text-white font-medium capitalize">
                  {systemUser?.name || "karan"}
                </span>
              </span>
            </div>

            {/* Profile Icon button with dropdown */}
            <div className="relative" ref={profileMenuRef}>
              <button
                type="button"
                onClick={() => setShowProfileMenu((prev) => !prev)}
                className="w-9 h-9 rounded-full bg-[#181818] hover:bg-[#222222] border border-white/10 hover:border-white/25 flex items-center justify-center text-zinc-300 hover:text-white transition-all shadow-md cursor-pointer focus:outline-none"
                title={systemUser?.name || "Profile"}
                aria-label="User profile"
              >
                <User size={18} />
              </button>

              <AnimatePresence>
                {showProfileMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.96 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-2 w-56 bg-[#161616] border border-[#282828] rounded-2xl shadow-2xl p-2 z-50 pointer-events-auto backdrop-blur-xl"
                  >
                    <div className="px-3 py-2.5 border-b border-[#282828] mb-1">
                      <p className="text-xs font-bold text-white truncate">
                        {systemUser?.name || "User"}
                      </p>
                      <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                        {systemUser?.email || "Music Explorer"}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setShowProfileMenu(false);
                        router.push("/favourites");
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-zinc-300 hover:text-white hover:bg-white/10 rounded-xl transition-colors text-left cursor-pointer"
                    >
                      <Heart size={14} className="text-zinc-400" />
                      <span>Favourites</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowProfileMenu(false);
                        router.push("/playlists");
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-zinc-300 hover:text-white hover:bg-white/10 rounded-xl transition-colors text-left cursor-pointer"
                    >
                      <ListMusic size={14} className="text-zinc-400" />
                      <span>Playlists</span>
                    </button>

                    <div className="border-t border-[#282828] mt-1 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setShowProfileMenu(false);
                          playerActions.clearSystemSession();
                          toast.success("Logged Out", {
                            description: "You have been successfully logged out.",
                          });
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-colors text-left cursor-pointer"
                      >
                        <LogOut size={14} />
                        <span>Log Out</span>
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        ) : (
          <button
            onClick={() => playerActions.openAuthModal()}
            className="w-9 h-9 rounded-full bg-[#181818] hover:bg-[#222222] border border-white/10 hover:border-white/25 flex items-center justify-center text-zinc-300 hover:text-white transition-all shadow-md cursor-pointer"
            title="Sign In"
          >
            <User size={18} />
          </button>
        )}
      </div>
      </div>
    </header>
  );
}
