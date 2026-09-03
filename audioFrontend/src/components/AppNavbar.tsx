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
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { musicApi } from "@/lib/api";
import { getImageUrl } from "@/lib/image-utils";
import { mapToPlayerSong } from "@/lib/player-utils";
import { playerActions, playerStore } from "@/store/player.store";

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

  // Fetch History
  const { data: searchHistory } = useQuery({
    queryKey: ["search-history", systemUser?.id],
    queryFn: () => musicApi.users.getSearchHistory(1, 5),
    enabled: !!systemUser?.id && isFocused && !query.trim(),
  });

  // Fetch Live Results
  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ["active-search", debouncedQuery],
    queryFn: () => musicApi.search.unified(debouncedQuery),
    enabled: isFocused && !!debouncedQuery.trim(),
  });

  const saveHistory = useMutation({
    mutationFn: (text: string) => musicApi.users.saveSearchHistory(text),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["search-history"] }),
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Search results are rendered dynamically on typing; do not persist query on form submit
  };

  const handleRecentClick = (text: string) => {
    setQuery(text);
  };

  const handlePlaySong = (song: any) => {
    playerActions.play(mapToPlayerSong(song));
    toast.success("Playing Song", {
      description: `Starting playback for "${song.title}"...`,
    });
    if (systemUser?.id) saveHistory.mutate(song.title);
    setIsFocused(false);
  };

  const handleArtistClick = (artist: any) => {
    router.push(`/artists/${artist.id}`);
    if (systemUser?.id) saveHistory.mutate(artist.name);
    setIsFocused(false);
  };

  const handlePlaylistClick = (playlist: any) => {
    router.push(`/playlists/${playlist.id}`);
    if (systemUser?.id) saveHistory.mutate(playlist.name);
    setIsFocused(false);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsFocused(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
            type="text"
            placeholder="What do you want to listen to?"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsFocused(true)}
            className="bg-[#282828] border border-white/10 hover:border-white/25 focus:border-white rounded-full py-2.5 pl-11 pr-8 text-xs font-semibold focus:ring-0 transition-all outline-none w-full text-white placeholder-zinc-300 shadow-md relative z-10"
          />
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-300 group-focus-within:text-white transition-colors z-20">
            <Search size={16} />
          </div>
        </form>

        <AnimatePresence>
          {isFocused && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              className="absolute top-full left-0 mt-2 w-[calc(100vw-6rem)] sm:w-[420px] md:w-[480px] max-w-[480px] bg-[#181818] border border-[#282828] rounded-xl shadow-2xl overflow-hidden pointer-events-auto z-50"
            >
              {!query.trim() ? (
                /* RECENT SEARCHES */
                <>
                  <div className="p-3 border-b border-[#282828] flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-400">
                      Recent Searches
                    </span>
                  </div>
                  <div className="p-2">
                    {!systemUser ? (
                      <div className="p-4 text-center text-zinc-500 text-xs font-normal">
                        Sign in to save your search history.
                      </div>
                    ) : searchHistory?.data?.data.length === 0 ? (
                      <div className="p-4 text-center text-zinc-500 text-xs font-normal">
                        No recent searches.
                      </div>
                    ) : (
                      searchHistory?.data?.data.map((item: any) => (
                        <button
                          key={item.id}
                          onClick={() => handleRecentClick(item.searchedText)}
                          className="w-full flex items-center gap-3 p-2.5 hover:bg-[#282828] rounded-lg transition-all text-left group"
                        >
                          <History
                            size={16}
                            className="text-zinc-400 group-hover:text-white"
                          />
                          <span className="text-xs font-medium text-zinc-300 group-hover:text-white truncate">
                            {item.searchedText}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </>
              ) : (
                /* LIVE SEARCH RESULTS */
                <div className="max-h-[60vh] overflow-y-auto no-scrollbar">
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
                        {searchResults?.data?.songs.map((song: any) => (
                          <button
                            key={song.id}
                            onClick={() => handlePlaySong(song)}
                            className="w-full flex items-center gap-3 p-2 hover:bg-[#282828] rounded-lg transition-all text-left group"
                          >
                            <div className="w-10 h-10 rounded-md bg-zinc-900 overflow-hidden shrink-0">
                              <img
                                src={getImageUrl(song.imageKey, {
                                  width: 100,
                                  height: 100,
                                  focus: "auto",
                                  aspectRatio: "1-1",
                                })}
                                className="w-full h-full object-cover"
                                alt=""
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-white truncate">
                                {song.title}
                              </p>
                              <p className="text-[11px] text-zinc-400 font-normal truncate">
                                {song.artistName}
                              </p>
                            </div>
                            <Play
                              size={16}
                              className="text-primary opacity-0 group-hover:opacity-100 transition-all mr-2"
                            />
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Artists */}
                    {(searchResults?.data?.artists?.length ?? 0) > 0 && (
                      <div className="mb-3">
                        <h4 className="px-3 py-1 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                          Artists
                        </h4>
                        {searchResults?.data?.artists.map((artist: any) => (
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

                    {/* Playlists */}
                    {(searchResults?.data?.playlists?.length ?? 0) > 0 && (
                      <div>
                        <h4 className="px-3 py-1 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                          Playlists
                        </h4>
                        {searchResults?.data?.playlists.map((playlist: any) => (
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
                                Playlist
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {debouncedQuery.trim() &&
                      !isSearching &&
                      !searchResults?.data?.songs?.length &&
                      !searchResults?.data?.artists?.length &&
                      !searchResults?.data?.playlists?.length && (
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
