"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useStore } from "@tanstack/react-store";
import { AnimatePresence, motion } from "framer-motion";
import { Search } from "lucide-react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  musicApi,
  type SaveSearchHistoryPayload,
  type SearchHistoryItem,
} from "@/lib/api";
import { playerStore } from "@/store/player.store";
import { NavbarLiveSearchResults } from "./NavbarLiveSearchResults";
import { NavbarRecentSearches } from "./NavbarRecentSearches";
import type { NavbarSearchProps } from "./types";

export function NavbarSearch({
  query,
  setQuery,
  debouncedQuery,
  isFocused,
  setIsFocused,
  isScrolled,
  onPlaySong,
  onArtistClick,
  onPlaylistClick,
  onUserPlaylistClick,
}: NavbarSearchProps) {
  const systemUser = useStore(playerStore, (s) => s.systemUser);
  const queryClient = useQueryClient();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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

  const savePlaylistMutation = useMutation({
    mutationFn: (playlistId: string) => musicApi.users.savePlaylistToLibrary(playlistId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-playlists"] });
      toast.success("Saved to your Library!", {
        description: `Playlist added to your playlists.`,
      });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err?.message || "Failed to save playlist");
    },
  });

  const handleRecentClick = (item: SearchHistoryItem) => {
    if (item.type === "SONG" && item.song) {
      onPlaySong(item.song);
    } else if (item.type === "ARTIST" && item.artist) {
      onArtistClick(item.artist);
    } else if (item.type === "PLAYLIST" && item.playlist) {
      onPlaylistClick(item.playlist);
    } else if (item.type === "USER_PLAYLIST" && item.userPlaylist) {
      onUserPlaylistClick(item.userPlaylist);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
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
      } else if (e.key === "Escape") {
        if (isFocused) {
          setIsFocused(false);
          searchInputRef.current?.blur();
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleGlobalShortcuts);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleGlobalShortcuts);
    };
  }, [isFocused, setIsFocused]);

  const recentHistory: SearchHistoryItem[] = searchHistoryData?.data?.recent || [];

  return (
    <div
      className="w-full max-w-md sm:max-w-lg lg:max-w-xl relative"
      ref={containerRef}
    >
      <form
        onSubmit={(e) => e.preventDefault()}
        className="relative group rounded-full w-full"
      >
        <input
          ref={searchInputRef}
          type="text"
          placeholder="Search for songs, artists, albums or playlists..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          className={`rounded-full py-2.5 pl-11 pr-16 text-xs sm:text-[13px] font-medium focus:ring-0 transition-all duration-200 outline-none w-full text-white placeholder-zinc-400 shadow-inner relative z-10 backdrop-blur-md ${
            isScrolled
              ? "bg-white/8 border border-white/10 hover:border-white/20 focus:border-white/30 focus:bg-black/80"
              : "bg-white/6 border border-white/10 hover:border-white/20 focus:border-white/30 focus:bg-black/70"
          }`}
        />
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-400 group-focus-within:text-white transition-colors z-20">
          <Search size={16} />
        </div>
        <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center gap-1 pointer-events-none z-20">
          <kbd className="hidden sm:inline-flex items-center justify-center w-5 h-5 rounded bg-white/8 border border-white/10 text-[10px] font-mono text-zinc-400 select-none shadow-sm">
            ⌘
          </kbd>
          <kbd className="hidden sm:inline-flex items-center justify-center w-5 h-5 rounded bg-white/8 border border-white/10 text-[10px] font-mono text-zinc-400 select-none shadow-sm">
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
              <NavbarRecentSearches
                recentHistory={recentHistory}
                isLoading={isHistoryLoading}
                onRecentClick={handleRecentClick}
                onPlaySong={onPlaySong}
                onDeleteHistoryItem={(id) => deleteHistoryItem.mutate(id)}
                onClearHistory={() => clearHistory.mutate()}
                isAuthenticated={!!systemUser}
              />
            ) : (
              <NavbarLiveSearchResults
                query={query}
                debouncedQuery={debouncedQuery}
                isSearching={isSearching}
                songs={searchResults?.data?.songs || []}
                artists={searchResults?.data?.artists || []}
                playlists={searchResults?.data?.playlists || []}
                userPlaylists={searchResults?.data?.userPlaylists || []}
                onPlaySong={onPlaySong}
                onArtistClick={onArtistClick}
                onPlaylistClick={onPlaylistClick}
                onUserPlaylistClick={onUserPlaylistClick}
                onSavePlaylist={(id) => savePlaylistMutation.mutate(id)}
                isAuthenticated={!!systemUser}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
