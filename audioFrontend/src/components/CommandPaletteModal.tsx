"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useStore } from "@tanstack/react-store";
import { useRouter } from "next/navigation";
import {
  Search,
  Music,
  User,
  ListMusic,
  X,
  Play,
  CornerDownLeft,
  Clock,
  Sparkles,
  Command,
  Loader2,
} from "lucide-react";
import { musicApi, Song, Artist, Playlist } from "@/lib/api";
import { getImageUrl } from "@/lib/image-utils";
import { mapToPlayerSong } from "@/lib/player-utils";
import { playerActions, playerStore } from "@/store/player.store";
import { toast } from "sonner";

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = "all" | "songs" | "artists" | "playlists";

interface NavigableItem {
  id: string;
  type: "song" | "artist" | "playlist" | "history";
  title: string;
  subtitle?: string;
  imageKey?: string;
  data: any;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  isOpen,
  onClose,
}) => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const systemUser = useStore(playerStore, (s) => s.systemUser);

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>("all");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setDebouncedQuery("");
      setSelectedIndex(0);
      setActiveTab("all");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Fetch unified search results
  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ["command-palette-search", debouncedQuery],
    queryFn: () => musicApi.search.unified(debouncedQuery),
    enabled: isOpen && debouncedQuery.length > 0,
  });

  // Fetch search history
  const { data: searchHistory } = useQuery({
    queryKey: ["command-palette-history", systemUser?.id],
    queryFn: () => musicApi.users.getSearchHistory(1, 6),
    enabled: isOpen && !!systemUser?.id && !debouncedQuery,
  });

  const saveHistory = useMutation({
    mutationFn: (text: string) => musicApi.users.saveSearchHistory(text),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["command-palette-history"] });
      queryClient.invalidateQueries({ queryKey: ["search-history"] });
    },
  });

  const rawSongs: Song[] = searchResults?.data?.songs || [];
  const rawArtists: Artist[] = searchResults?.data?.artists || [];
  const rawPlaylists: Playlist[] = searchResults?.data?.playlists || [];
  const historyList: string[] = searchHistory?.data?.data?.map((h: any) => h.searchText || h) || [];

  // Build flattened list for keyboard navigation
  const items: NavigableItem[] = useMemo(() => {
    if (!debouncedQuery) {
      return historyList.map((h, i) => ({
        id: `history-${i}`,
        type: "history" as const,
        title: h,
        subtitle: "Recent Search",
        data: h,
      }));
    }

    const list: NavigableItem[] = [];

    if (activeTab === "all" || activeTab === "songs") {
      rawSongs.forEach((song) => {
        list.push({
          id: `song-${song.id}`,
          type: "song",
          title: song.title,
          subtitle: song.artistName || "Track",
          imageKey: song.imageKey,
          data: song,
        });
      });
    }

    if (activeTab === "all" || activeTab === "artists") {
      rawArtists.forEach((artist) => {
        list.push({
          id: `artist-${artist.id}`,
          type: "artist",
          title: artist.name,
          subtitle: "Artist",
          imageKey: artist.coverImageKey,
          data: artist,
        });
      });
    }

    if (activeTab === "all" || activeTab === "playlists") {
      rawPlaylists.forEach((playlist) => {
        list.push({
          id: `playlist-${playlist.id}`,
          type: "playlist",
          title: playlist.name,
          subtitle: "Playlist",
          imageKey: playlist.coverImageKey,
          data: playlist,
        });
      });
    }

    return list;
  }, [debouncedQuery, activeTab, rawSongs, rawArtists, rawPlaylists, historyList]);

  // Keep selected index in bounds
  useEffect(() => {
    setSelectedIndex((prev) => (items.length > 0 ? Math.min(prev, items.length - 1) : 0));
  }, [items]);

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const activeEl = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
    if (activeEl) {
      activeEl.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  const handleSelectItem = (item: NavigableItem) => {
    if (item.type === "song") {
      playerActions.play(mapToPlayerSong(item.data));
      toast.success("Playing song", {
        description: `Now playing "${item.title}"`,
      });
      if (systemUser?.id) saveHistory.mutate(item.title);
      onClose();
    } else if (item.type === "artist") {
      router.push(`/artists/${item.data.id}`);
      if (systemUser?.id) saveHistory.mutate(item.title);
      onClose();
    } else if (item.type === "playlist") {
      router.push(`/playlists/${item.data.id}`);
      if (systemUser?.id) saveHistory.mutate(item.title);
      onClose();
    } else if (item.type === "history") {
      setQuery(item.data);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (items.length > 0 ? (prev + 1) % items.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (items.length > 0 ? (prev - 1 + items.length) % items.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (items[selectedIndex]) {
        handleSelectItem(items[selectedIndex]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[300] flex items-start justify-center pt-16 sm:pt-24 px-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative w-full max-w-2xl rounded-2xl bg-[#121212]/95 border border-white/15 shadow-2xl backdrop-blur-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Bar Input */}
        <div className="relative flex items-center px-4 py-3.5 border-b border-white/10 gap-3">
          <Search size={20} className="text-zinc-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search songs, artists, playlists, or albums..."
            className="flex-1 bg-transparent text-white text-base placeholder-zinc-500 focus:outline-none"
          />
          {isSearching && (
            <Loader2 size={18} className="animate-spin text-primary shrink-0" />
          )}
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              className="p-1 rounded-full text-zinc-500 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X size={16} />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-0.5 rounded bg-zinc-800 border border-white/10 text-[11px] font-mono text-zinc-400 shadow-sm">
            ESC
          </kbd>
        </div>

        {/* Filter Category Tabs */}
        {debouncedQuery.length > 0 && (
          <div className="flex items-center gap-1.5 px-4 py-2 border-b border-white/5 bg-zinc-900/40 text-xs">
            {(["all", "songs", "artists", "playlists"] as TabType[]).map((tab) => {
              const count =
                tab === "songs"
                  ? rawSongs.length
                  : tab === "artists"
                  ? rawArtists.length
                  : tab === "playlists"
                  ? rawPlaylists.length
                  : rawSongs.length + rawArtists.length + rawPlaylists.length;

              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab);
                    setSelectedIndex(0);
                  }}
                  className={`px-3 py-1 rounded-full font-medium capitalize transition-all cursor-pointer ${
                    activeTab === tab
                      ? "bg-primary text-black font-semibold shadow-sm"
                      : "text-zinc-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {tab} {count > 0 ? `(${count})` : ""}
                </button>
              );
            })}
          </div>
        )}

        {/* Results List */}
        <div
          ref={listRef}
          className="max-h-[50vh] overflow-y-auto no-scrollbar p-2 space-y-1"
        >
          {items.length > 0 ? (
            items.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              const imageUrl = item.imageKey
                ? getImageUrl(item.imageKey, { width: 80, height: 80, aspectRatio: "1-1" })
                : null;

              return (
                <div
                  key={item.id}
                  data-index={idx}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  onClick={() => handleSelectItem(item)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-colors select-none ${
                    isSelected
                      ? "bg-white/10 text-white"
                      : "text-zinc-300 hover:bg-white/5"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Item Thumbnail / Icon */}
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-zinc-800 shrink-0 flex items-center justify-center border border-white/5">
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : item.type === "song" ? (
                        <Music size={18} className="text-zinc-400" />
                      ) : item.type === "artist" ? (
                        <User size={18} className="text-zinc-400" />
                      ) : item.type === "playlist" ? (
                        <ListMusic size={18} className="text-zinc-400" />
                      ) : (
                        <Clock size={16} className="text-zinc-500" />
                      )}
                    </div>

                    {/* Title & Subtitle */}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate text-white">
                        {item.title}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-zinc-400">
                        <span className="capitalize font-medium text-zinc-500">
                          {item.type}
                        </span>
                        {item.subtitle && (
                          <>
                            <span>•</span>
                            <span className="truncate">{item.subtitle}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action Pill / Indicator */}
                  <div className="shrink-0 flex items-center gap-2 pl-3">
                    {item.type === "song" && (
                      <span className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-xs text-primary font-medium">
                        <Play size={12} fill="currentColor" /> Play
                      </span>
                    )}
                    {isSelected && (
                      <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-white/10 text-[10px] font-mono text-zinc-300">
                        <CornerDownLeft size={11} />
                      </kbd>
                    )}
                  </div>
                </div>
              );
            })
          ) : debouncedQuery ? (
            <div className="py-12 text-center text-zinc-500 space-y-2">
              <Search size={32} className="mx-auto text-zinc-600" />
              <p className="text-sm">No results found for &ldquo;{debouncedQuery}&rdquo;</p>
              <p className="text-xs text-zinc-600">
                Try searching with a different artist, song title, or keyword
              </p>
            </div>
          ) : (
            <div className="py-10 text-center text-zinc-500 space-y-2">
              <Sparkles size={28} className="mx-auto text-primary/60" />
              <p className="text-sm text-zinc-300 font-medium">
                Search anything on AudioMelody
              </p>
              <p className="text-xs text-zinc-500">
                Type song names, artists, playlists, or press <kbd className="px-1 py-0.5 rounded bg-zinc-800 text-[10px]">↑</kbd> <kbd className="px-1 py-0.5 rounded bg-zinc-800 text-[10px]">↓</kbd> to navigate
              </p>
            </div>
          )}
        </div>

        {/* Footer Shortcut Bar */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-950 border-t border-white/10 text-[11px] text-zinc-400 select-none">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-white/10 font-mono text-[10px]">
                ↑↓
              </kbd>{" "}
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-white/10 font-mono text-[10px]">
                ↵
              </kbd>{" "}
              Select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-white/10 font-mono text-[10px]">
                ESC
              </kbd>{" "}
              Close
            </span>
          </div>
          <div className="flex items-center gap-1 text-zinc-500">
            <Command size={12} />
            <span>Spotlight Search</span>
          </div>
        </div>
      </div>
    </div>
  );
};
