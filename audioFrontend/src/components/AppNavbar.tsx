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
} from "lucide-react";
import { useRouter } from "next/navigation";
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
  const queryClient = useQueryClient();
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);

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
    }
  };

  const handlePlaySong = (song: Song) => {
    previewPlayer.stopPreview(true);
    playerActions.play(mapToPlayerSong(song));
    toast.success("Playing Song", {
      description: `Starting playback for "${song.title}"...`,
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
      } else if (e.key === "Escape" && isFocused) {
        setIsFocused(false);
        searchInputRef.current?.blur();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleGlobalShortcuts);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleGlobalShortcuts);
    };
  }, [isFocused]);

  const recentHistory: SearchHistoryItem[] = searchHistoryData?.data?.recent || [];

  return (
    <header className="absolute top-0 left-0 right-0 z-40 px-4 sm:px-6 md:px-8 xl:px-10 pt-[var(--app-navbar-pt,1rem)] pb-4 flex items-center justify-between pointer-events-none bg-gradient-to-b from-black/50 via-black/15 to-transparent">
      {/* Search Input Container */}
      <div
        className="flex items-center gap-6 pointer-events-auto relative"
        ref={menuRef}
      >
        <form
          onSubmit={handleSearch}
          className="relative group rounded-full w-56 sm:w-72 md:w-80 lg:w-96"
        >
          <input
            ref={searchInputRef}
            type="text"
            placeholder="What do you want to listen to?"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsFocused(true)}
            className="bg-[#282828] border border-white/10 hover:border-white/25 focus:border-white rounded-full py-2.5 pl-11 pr-14 text-xs font-semibold focus:ring-0 transition-all outline-none w-full text-white placeholder-zinc-300 shadow-md relative z-10"
          />
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-300 group-focus-within:text-white transition-colors z-20">
            <Search size={16} />
          </div>
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center gap-1 pointer-events-none z-20">
            <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded bg-zinc-800 border border-white/10 text-[10px] font-mono text-zinc-400">
              ⌘
            </kbd>
            <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded bg-zinc-800 border border-white/10 text-[10px] font-mono text-zinc-400">
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
              className="absolute top-full left-0 mt-2 w-[calc(100vw-6rem)] sm:w-[440px] md:w-[500px] max-w-[500px] bg-[#181818] border border-[#282828] rounded-xl shadow-2xl overflow-hidden pointer-events-auto z-50 max-h-[70vh] flex flex-col"
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
                                enablePreviewHover={false}
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
                            ) : isPlaylist && item.playlist ? (
                              <div className="w-10 h-10 rounded-md bg-zinc-900 overflow-hidden shrink-0 flex items-center justify-center border border-white/5">
                                {item.playlist.coverImageKey ? (
                                  <img
                                    src={getImageUrl(item.playlist.coverImageKey, {
                                      width: 80,
                                      height: 80,
                                      focus: "auto",
                                      aspectRatio: "1-1",
                                    })}
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
                                  : item.playlist?.name}
                              </p>
                              <p className="text-[11px] text-zinc-400 font-normal truncate">
                                {isSong
                                  ? item.song?.artistName || "Song"
                                  : isArtist
                                  ? "Artist"
                                  : "Playlist"}
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
                            onMouseEnter={() => previewPlayer.startHoverCountdown(song)}
                            onMouseLeave={() => previewPlayer.stopPreview()}
                            className="w-full flex items-center gap-3 p-2 hover:bg-[#282828] rounded-lg transition-all text-left group cursor-pointer"
                          >
                            <SongThumbnail
                              song={song}
                              sizeClass="w-10 h-10"
                              enablePreviewHover={false}
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
      <div className="flex items-center gap-4 pointer-events-auto">
        {mounted && !!systemUser ? (
          <div className="flex items-center gap-4">
            {/* Welcome Greeting */}
            <span className="text-xs font-medium text-zinc-400">
              {getGreeting()},{" "}
              <span className="text-white font-semibold">
                {systemUser?.name || "User"}
              </span>
            </span>

            {/* Logout button */}
            <button
              type="button"
              onClick={() => {
                playerActions.clearSystemSession();
                toast.success("Logged Out", {
                  description: "You have been successfully logged out.",
                });
              }}
              className="px-4 py-2 bg-[#282828] hover:bg-[#333333] text-zinc-200 border border-[#383838] rounded-full text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <LogOut size={14} />
              Log Out
            </button>
          </div>
        ) : (
          <button
            onClick={() => playerActions.openAuthModal()}
            className="px-6 py-2.5 bg-primary text-black rounded-full text-xs font-bold hover:scale-105 transition-all shadow-md flex items-center gap-2 cursor-pointer"
          >
            <User size={16} />
            Sign In
          </button>
        )}
      </div>
    </header>
  );
}
