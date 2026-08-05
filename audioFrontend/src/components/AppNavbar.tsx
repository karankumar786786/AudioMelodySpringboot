"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useStore } from "@tanstack/react-store";
import { AnimatePresence, motion } from "framer-motion";
import {
  History,
  ListMusic,
  Loader2,
  LogOut,
  Mic2,
  Play,
  Search,
  Sparkles,
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

  const clearHistory = useMutation({
    mutationFn: () => musicApi.users.clearSearchHistory(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["search-history"] });
      toast.success("History Cleared", {
        description: "Your search history has been cleared.",
      });
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    if (systemUser?.id) saveHistory.mutate(query.trim());
    // In-navbar search: focus remains, results shown dynamically
  };

  const handleRecentClick = (text: string) => {
    setQuery(text);
    if (systemUser?.id) saveHistory.mutate(text);
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
    <header className="sticky top-0 z-40 w-full px-5 py-6 flex items-center justify-between pointer-events-none">
      {/* Search Input Container */}
      <div
        className="flex items-center gap-6 pointer-events-auto relative"
        ref={menuRef}
      >
        <form
          onSubmit={handleSearch}
          className="relative group rounded-2xl w-96"
        >
          <input
            type="text"
            placeholder="Search for tracks, artists..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsFocused(true)}
            className="bg-black/60 backdrop-blur-3xl border border-white/10 rounded-2xl py-3 pl-14 pr-8 text-xs font-black focus:ring-2 focus:ring-primary/50 transition-all outline-none w-full text-white placeholder-zinc-700 shadow-2xl relative z-10"
          />
          <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-zinc-500 group-focus-within:text-primary transition-colors z-20">
            <Search size={18} />
          </div>
        </form>

        <AnimatePresence>
          {isFocused && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute top-full left-0 mt-4 w-[480px] glass-effect-strong rounded-3xl shadow-[0_40px_100px_rgba(0,0,0,0.8)] overflow-hidden pointer-events-auto"
            >
              {!query.trim() ? (
                /* RECENT SEARCHES */
                <>
                  <div className="p-4 border-b border-white/5 flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 italic">
                      Recent Searches
                    </span>
                    {systemUser && (
                      <button
                        onClick={() => clearHistory.mutate()}
                        className="text-[10px] font-black text-primary hover:text-white transition-colors"
                      >
                        CLEAR ALL
                      </button>
                    )}
                  </div>
                  <div className="p-2">
                    {!systemUser ? (
                      <div className="p-4 text-center text-zinc-600 text-[10px] font-bold italic">
                        Sign in to sync frequencies.
                      </div>
                    ) : searchHistory?.data?.data.length === 0 ? (
                      <div className="p-4 text-center text-zinc-600 text-[10px] font-bold italic">
                        Memory empty.
                      </div>
                    ) : (
                      searchHistory?.data?.data.map((item: any) => (
                        <button
                          key={item.id}
                          onClick={() => handleRecentClick(item.searchedText)}
                          className="w-full flex items-center gap-3 p-3 hover:bg-white/5 rounded-xl transition-all text-left group"
                        >
                          <History
                            size={14}
                            className="text-zinc-600 group-hover:text-primary"
                          />
                          <span className="text-xs font-black text-zinc-300 group-hover:text-white truncate">
                            {item.searchedText}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </>
              ) : (
                /* LIVE SEARCH RESULTS */
                <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
                  <div className="p-4 border-b border-white/5 flex items-center justify-between sticky top-0 bg-zinc-950/80 backdrop-blur-md z-10">
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 italic">
                      Live Results
                    </span>
                    {isSearching && (
                      <Loader2
                        size={12}
                        className="text-primary animate-spin"
                      />
                    )}
                  </div>

                  <div className="p-2 space-y-1">
                    {/* Songs */}
                    {(searchResults?.data?.songs?.length ?? 0) > 0 && (
                      <div className="mb-4">
                        <h4 className="px-3 py-2 text-[9px] font-black text-zinc-600 uppercase tracking-widest">
                          Tracks
                        </h4>
                        {searchResults?.data?.songs.map((song: any) => (
                          <button
                            key={song.id}
                            onClick={() => handlePlaySong(song)}
                            className="w-full flex items-center gap-3 p-2 hover:bg-white/5 rounded-xl transition-all text-left group"
                          >
                            <div className="w-10 h-10 rounded-lg bg-zinc-900 overflow-hidden shrink-0 border border-white/5">
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
                              <p className="text-xs font-black text-white truncate">
                                {song.title}
                              </p>
                              <p className="text-[10px] text-zinc-500 font-medium truncate uppercase tracking-wider">
                                {song.artistName}
                              </p>
                            </div>
                            <Play
                              size={14}
                              className="text-zinc-600 opacity-0 group-hover:opacity-100 group-hover:text-primary transition-all mr-2"
                            />
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Artists */}
                    {(searchResults?.data?.artists?.length ?? 0) > 0 && (
                      <div className="mb-4">
                        <h4 className="px-3 py-2 text-[9px] font-black text-zinc-600 uppercase tracking-widest">
                          Nodes
                        </h4>
                        {searchResults?.data?.artists.map((artist: any) => (
                          <button
                            key={artist.id}
                            onClick={() => handleArtistClick(artist)}
                            className="w-full flex items-center gap-3 p-2 hover:bg-white/5 rounded-xl transition-all text-left group"
                          >
                            <div className="w-10 h-10 rounded-full bg-zinc-900 overflow-hidden shrink-0 border border-white/5 flex items-center justify-center">
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
                                <Mic2 size={16} className="text-zinc-700" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-white truncate">
                                {artist.name}
                              </p>
                              <p className="text-[10px] text-zinc-500 font-black uppercase tracking-wider italic">
                                Artist
                              </p>
                            </div>
                            <Sparkles size={12} className="text-primary mr-2" />
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Playlists */}
                    {(searchResults?.data?.playlists?.length ?? 0) > 0 && (
                      <div>
                        <h4 className="px-3 py-2 text-[9px] font-black text-zinc-600 uppercase tracking-widest">
                          Clusters
                        </h4>
                        {searchResults?.data?.playlists.map((playlist: any) => (
                          <button
                            key={playlist.id}
                            onClick={() => handlePlaylistClick(playlist)}
                            className="w-full flex items-center gap-3 p-2 hover:bg-white/5 rounded-xl transition-all text-left group"
                          >
                            <div className="w-10 h-10 rounded-lg bg-zinc-900 overflow-hidden shrink-0 border border-white/5 flex items-center justify-center">
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
                                  className="text-zinc-700"
                                />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-white truncate">
                                {playlist.name}
                              </p>
                              <p className="text-[10px] text-zinc-500 font-medium tracking-wider uppercase">
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
                        <div className="p-8 text-center bg-white/5 rounded-2xl m-2">
                          <Search
                            size={24}
                            className="mx-auto mb-3 text-zinc-700 opacity-50"
                          />
                          <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest italic">
                            No frequencies matching "{query}"
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
          <div className="flex items-center gap-3">
            {/* Welcome Greeting */}
            <span className="text-xs font-bold text-zinc-400">
              Hi,{" "}
              <span className="text-white font-black">
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
              className="px-4 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 hover:border-red-500/35 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <LogOut size={12} />
              Log Out
            </button>
          </div>
        ) : (
          <button
            onClick={() => playerActions.openAuthModal()}
            className="px-6 py-3 bg-primary text-black rounded-2xl text-[10px] font-black uppercase tracking-widest hover:brightness-110 transition-all shadow-2xl flex items-center gap-2"
          >
            <User size={14} />
            Sign In
          </button>
        )}
      </div>
    </header>
  );
}
