"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useStore } from "@tanstack/react-store";
import { useRouter } from "next/navigation";
import { Search, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  musicApi,
  type Artist,
  type Playlist,
  type SaveSearchHistoryPayload,
  type SearchHistoryItem,
  type Song,
  type UserPlaylist,
} from "@/lib/api";
import { mapToPlayerSong } from "@/lib/player-utils";
import { previewPlayer } from "@/lib/preview-player";
import { playerActions, playerStore } from "@/store/player.store";
import { CommandPaletteFooter } from "./CommandPaletteFooter";
import { CommandPaletteInput } from "./CommandPaletteInput";
import { CommandPaletteListItem } from "./CommandPaletteListItem";
import { CommandPaletteTabs } from "./CommandPaletteTabs";
import type { CommandPaletteModalProps, NavigableItem, TabType } from "./types";

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

  // Fetch structured search history
  const { data: searchHistoryData } = useQuery({
    queryKey: ["command-palette-history", systemUser?.id],
    queryFn: () => musicApi.users.getSearchHistory(),
    enabled: isOpen && !!systemUser?.id && !debouncedQuery,
  });

  const saveHistory = useMutation({
    mutationFn: (payload: SaveSearchHistoryPayload) =>
      musicApi.users.saveSearchHistory(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["command-palette-history"] });
      queryClient.invalidateQueries({ queryKey: ["search-history"] });
    },
  });

  const deleteHistoryItem = useMutation({
    mutationFn: (id: string) => musicApi.users.deleteSearchHistoryItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["command-palette-history"] });
      queryClient.invalidateQueries({ queryKey: ["search-history"] });
    },
  });

  const clearHistory = useMutation({
    mutationFn: () => musicApi.users.clearSearchHistory(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["command-palette-history"] });
      queryClient.invalidateQueries({ queryKey: ["search-history"] });
      toast.success("Search history cleared");
    },
  });

  const rawSongs: Song[] = searchResults?.data?.songs || [];
  const rawArtists: Artist[] = searchResults?.data?.artists || [];
  const rawPlaylists: Playlist[] = searchResults?.data?.playlists || [];
  const rawUserPlaylists: UserPlaylist[] = searchResults?.data?.userPlaylists || [];
  const recentHistory: SearchHistoryItem[] = searchHistoryData?.data?.recent || [];

  // Build flattened list for keyboard navigation
  const items: NavigableItem[] = useMemo(() => {
    if (!debouncedQuery) {
      return recentHistory
        .filter(
          (item) =>
            (item.type === "SONG" && item.song) ||
            (item.type === "ARTIST" && item.artist) ||
            (item.type === "PLAYLIST" && item.playlist) ||
            (item.type === "USER_PLAYLIST" && item.userPlaylist)
        )
        .map((item) => {
          if (item.type === "SONG" && item.song) {
            return {
              id: item.id,
              historyId: item.id,
              type: "song" as const,
              title: item.song.title,
              subtitle: [
                item.song.artistName || "Recent Song",
                item.song.album,
                item.song.genre,
              ].filter(Boolean).join(" • "),
              imageKey: item.song.imageKey,
              data: item.song,
            };
          }
          if (item.type === "ARTIST" && item.artist) {
            return {
              id: item.id,
              historyId: item.id,
              type: "artist" as const,
              title: item.artist.name,
              subtitle: "Recent Artist",
              imageKey: item.artist.coverImageKey,
              data: item.artist,
            };
          }
          if (item.type === "USER_PLAYLIST" && item.userPlaylist) {
            return {
              id: item.id,
              historyId: item.id,
              type: "playlist" as const,
              title: item.userPlaylist.name || "Community Playlist",
              subtitle: item.userPlaylist.ownerName ? `By ${item.userPlaylist.ownerName}` : "Community Playlist",
              imageKey: item.userPlaylist.coverImageKey,
              data: { ...item.userPlaylist, isUserPlaylist: true },
            };
          }
          return {
            id: item.id,
            historyId: item.id,
            type: "playlist" as const,
            title: item.playlist?.name || "Recent Playlist",
            subtitle: "Recent Playlist",
            imageKey: item.playlist?.coverImageKey,
            data: { ...item.playlist, isUserPlaylist: false },
          };
        });
    }

    const list: NavigableItem[] = [];

    if (activeTab === "all" || activeTab === "songs") {
      rawSongs.forEach((song) => {
        list.push({
          id: `song-${song.id}`,
          type: "song",
          title: song.title,
          subtitle: [
            song.artistName || "Track",
            song.album,
            song.genre,
          ].filter(Boolean).join(" • "),
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
          subtitle: "Official Playlist",
          imageKey: playlist.coverImageKey,
          data: { ...playlist, isUserPlaylist: false },
        });
      });
      rawUserPlaylists.forEach((playlist) => {
        list.push({
          id: `userplaylist-${playlist.id}`,
          type: "playlist",
          title: playlist.name,
          subtitle: playlist.ownerName ? `By ${playlist.ownerName}` : "Community Playlist",
          imageKey: playlist.coverImageKey,
          data: { ...playlist, isUserPlaylist: true },
        });
      });
    }

    return list;
  }, [debouncedQuery, activeTab, rawSongs, rawArtists, rawPlaylists, rawUserPlaylists, recentHistory]);

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
    previewPlayer.stopPreview(true);
    if (item.type === "song") {
      playerActions.playWithRadio(mapToPlayerSong(item.data));
      toast.success("Playing song radio", {
        description: `Now playing "${item.title}" with infinite radio`,
      });
      if (systemUser?.id && item.data.id) {
        saveHistory.mutate({ type: "SONG", songId: item.data.id });
      }
      playerActions.stageSearchPlay(item.data.id);
      onClose();
    } else if (item.type === "artist") {
      router.push(`/artists/${item.data.id}`);
      if (systemUser?.id && item.data.id) {
        saveHistory.mutate({ type: "ARTIST", artistId: item.data.id });
      }
      playerActions.recordSearchClick("ARTIST", item.data.id, debouncedQuery || query);
      onClose();
    } else if (item.type === "playlist") {
      playerActions.recordSearchClick("PLAYLIST", item.data.id, debouncedQuery || query);
      if (item.data?.isUserPlaylist) {
        router.push(`/my-playlists/${item.data.id}`);
        if (systemUser?.id && item.data.id) {
          saveHistory.mutate({ type: "USER_PLAYLIST", userPlaylistId: item.data.id });
        }
      } else {
        router.push(`/playlists/${item.data.id}`);
        if (systemUser?.id && item.data.id) {
          saveHistory.mutate({ type: "PLAYLIST", playlistId: item.data.id });
        }
      }
      onClose();
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

  const counts = {
    all: rawSongs.length + rawArtists.length + rawPlaylists.length + rawUserPlaylists.length,
    songs: rawSongs.length,
    artists: rawArtists.length,
    playlists: rawPlaylists.length + rawUserPlaylists.length,
  };

  return (
    <div
      className="fixed inset-0 z-300 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative w-full max-w-2xl rounded-2xl bg-[#121212]/95 border border-white/15 shadow-2xl backdrop-blur-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <CommandPaletteInput
          query={query}
          setQuery={setQuery}
          isSearching={isSearching}
          inputRef={inputRef}
        />

        {debouncedQuery.length > 0 && (
          <CommandPaletteTabs
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            setSelectedIndex={setSelectedIndex}
            counts={counts}
          />
        )}

        {/* Results List */}
        <div
          ref={listRef}
          className="max-h-[50vh] overflow-y-auto no-scrollbar p-2 space-y-1"
        >
          {!debouncedQuery && recentHistory.length > 0 && (
            <div className="px-3 py-1.5 flex items-center justify-between text-xs text-zinc-400">
              <span className="font-semibold text-zinc-400">Recent Searches</span>
              <button
                type="button"
                onClick={() => clearHistory.mutate()}
                className="text-[11px] font-medium text-zinc-500 hover:text-red-400 flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Trash2 size={12} />
                Clear
              </button>
            </div>
          )}

          {items.length > 0 ? (
            items.map((item, idx) => (
              <CommandPaletteListItem
                key={item.id}
                item={item}
                idx={idx}
                isSelected={idx === selectedIndex}
                onSelect={handleSelectItem}
                onMouseEnter={() => setSelectedIndex(idx)}
                onDeleteHistoryItem={(id) => deleteHistoryItem.mutate(id)}
              />
            ))
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

        <CommandPaletteFooter />
      </div>
    </div>
  );
};
