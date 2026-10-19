"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUpRight,
  Clock,
  ListMusic,
  Loader2,
  Play,
  Search,
  Trash2,
  User,
  X,
} from "lucide-react";
import { liteClient } from "algoliasearch/lite";
import { toast } from "sonner";

import { SongThumbnail } from "@/components/SongThumbnail";
import { musicApi, type Song } from "@/lib/api";
import { getImageUrl } from "@/lib/image-utils";
import {
  formatFollowerCount,
  formatStreamCount,
  mapToPlayerSong,
} from "@/lib/player-utils";
import { previewPlayer } from "@/lib/preview-player";
import { playerActions } from "@/store/player.store";

interface AlgoliaAutocompleteProps {
  placeholder?: string;
  onSongSelected?: (song: Song) => void;
  onArtistSelected?: (artistId: string) => void;
  onPlaylistSelected?: (playlistId: string, isUserPlaylist?: boolean) => void;
  className?: string;
}

interface WordSuggestion {
  label: string;
  type: "word" | "song" | "artist";
  matchedPrefix?: string;
}

interface RecentSearchItem {
  id: string;
  type: "word" | "song" | "artist" | "playlist";
  label: string;
  subtitle?: string;
  imageKey?: string;
  timestamp: number;
  data?: any;
}

const ALGOLIA_APP_ID =
  process.env.NEXT_PUBLIC_ALGOLIA_APP_ID || "NQKIDY69EZ";
const ALGOLIA_SEARCH_KEY =
  process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_KEY ||
  "d56f43f0df08191b3eea750c0f4d3cd0";
const ALGOLIA_INDEX_NAME =
  process.env.NEXT_PUBLIC_ALGOLIA_INDEX_NAME || "one_melody_springboot";

const RECENT_SEARCHES_STORAGE_KEY = "one_melody_recent_searches_v2";
const MAX_RECENT_ITEMS = 12;

function getStoredRecentSearches(): RecentSearchItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_STORAGE_KEY);
    if (!raw) return [];
    const items = JSON.parse(raw);
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

function saveRecentSearchItem(entry: Omit<RecentSearchItem, "timestamp">) {
  if (typeof window === "undefined") return;
  try {
    const existing = getStoredRecentSearches();
    const filtered = existing.filter((item) => {
      if (item.id === entry.id) return false;
      if (item.type === "word" && entry.type === "word") {
        return item.label.toLowerCase() !== entry.label.toLowerCase();
      }
      return true;
    });
    const updated: RecentSearchItem[] = [
      { ...entry, timestamp: Date.now() },
      ...filtered,
    ].slice(0, MAX_RECENT_ITEMS);
    localStorage.setItem(RECENT_SEARCHES_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn("Failed to save recent search:", err);
  }
}

function removeRecentSearchItem(id: string) {
  if (typeof window === "undefined") return;
  try {
    const existing = getStoredRecentSearches();
    const updated = existing.filter((item) => item.id !== id);
    localStorage.setItem(RECENT_SEARCHES_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn("Failed to remove recent search item:", err);
  }
}

function clearAllRecentSearches() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(RECENT_SEARCHES_STORAGE_KEY);
  } catch (err) {
    console.warn("Failed to clear recent searches:", err);
  }
}

function extractWordSuggestions(query: string, hits: any[]): WordSuggestion[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const results: WordSuggestion[] = [];
  const seen = new Set<string>();

  // 1. Extract exact matching word from Algolia's _highlightResult
  for (const hit of hits) {
    const highlights = [
      hit._highlightResult?.title?.value,
      hit._highlightResult?.name?.value,
      hit._highlightResult?.artistName?.value,
    ].filter(Boolean);

    for (const hl of highlights) {
      const regex = /<em>([^<]+)<\/em>([\w'-]*)/gi;
      let m: RegExpExecArray | null;
      while ((m = regex.exec(hl)) !== null) {
        const fullWord = (m[1] + (m[2] || "")).trim();
        const lowerWord = fullWord.toLowerCase();
        if (lowerWord.length >= q.length && !seen.has(lowerWord)) {
          seen.add(lowerWord);
          results.push({
            label: fullWord,
            type: "word",
            matchedPrefix: m[1],
          });
        }
      }
    }
    if (results.length >= 2) break;
  }

  // 2. Add top matching song / artist titles
  for (const hit of hits) {
    const title = (hit.title || hit.name || "").trim();
    if (!title) continue;
    const lowerTitle = title.toLowerCase();
    if (!seen.has(lowerTitle)) {
      seen.add(lowerTitle);
      results.push({
        label: title,
        type: hit.type === "artist" ? "artist" : "song",
      });
    }
    if (results.length >= 4) break;
  }

  return results.slice(0, 4);
}

export function AlgoliaAutocomplete({
  placeholder = "Search for songs, artists, albums or playlists...",
  onSongSelected,
  onArtistSelected,
  onPlaylistSelected,
  className = "",
}: AlgoliaAutocompleteProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const [prediction, setPrediction] = useState("");
  const [wordSuggestions, setWordSuggestions] = useState<WordSuggestion[]>([]);
  const [songs, setSongs] = useState<any[]>([]);
  const [artists, setArtists] = useState<any[]>([]);
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [recentSearches, setRecentSearches] = useState<RecentSearchItem[]>([]);

  const searchClient = useMemo(
    () => liteClient(ALGOLIA_APP_ID, ALGOLIA_SEARCH_KEY),
    []
  );

  // Sync background account history on mount
  useEffect(() => {
    setRecentSearches(getStoredRecentSearches());

    musicApi.users
      .getSearchHistory()
      .then((res) => {
        const recent = res?.data?.recent;
        if (Array.isArray(recent) && recent.length > 0) {
          const current = getStoredRecentSearches();
          const currentIds = new Set(current.map((c) => c.id));
          let changed = false;

          for (const item of recent) {
            if (
              item.type === "SONG" &&
              item.song &&
              !currentIds.has(`song-${item.song.id}`)
            ) {
              current.push({
                id: `song-${item.song.id}`,
                type: "song",
                label: item.song.title,
                subtitle: [item.song.artistName || "Song", item.song.album]
                  .filter(Boolean)
                  .join(" • "),
                imageKey: item.song.imageKey || "",
                timestamp: Date.now(),
                data: {
                  objectID: item.song.id,
                  title: item.song.title,
                  artistName: item.song.artistName,
                  album: item.song.album,
                  genre: item.song.genre,
                  imageKey: item.song.imageKey,
                  songKey: item.song.songKey,
                  duration: item.song.duration,
                },
              });
              changed = true;
            } else if (
              item.type === "ARTIST" &&
              item.artist &&
              !currentIds.has(`artist-${item.artist.id}`)
            ) {
              current.push({
                id: `artist-${item.artist.id}`,
                type: "artist",
                label: item.artist.name,
                subtitle: "Artist",
                imageKey: item.artist.coverImageKey || "",
                timestamp: Date.now(),
                data: { objectID: item.artist.id, name: item.artist.name },
              });
              changed = true;
            } else if (
              (item.type === "PLAYLIST" &&
                item.playlist &&
                !currentIds.has(`playlist-${item.playlist.id}`)) ||
              (item.type === "USER_PLAYLIST" &&
                item.userPlaylist &&
                !currentIds.has(`playlist-${item.userPlaylist.id}`))
            ) {
              const pl = item.playlist || item.userPlaylist;
              current.push({
                id: `playlist-${pl!.id}`,
                type: "playlist",
                label: pl!.name,
                subtitle:
                  item.type === "USER_PLAYLIST" ? "User Playlist" : "Playlist",
                imageKey: pl!.coverImageKey || "",
                timestamp: Date.now(),
                data: {
                  objectID: pl!.id,
                  name: pl!.name,
                  type:
                    item.type === "USER_PLAYLIST"
                      ? "userPlaylist"
                      : "playlist",
                },
              });
              changed = true;
            }
          }

          if (changed) {
            localStorage.setItem(
              RECENT_SEARCHES_STORAGE_KEY,
              JSON.stringify(current.slice(0, MAX_RECENT_ITEMS))
            );
            setRecentSearches(getStoredRecentSearches());
          }
        }
      })
      .catch(() => {});
  }, []);

  // Execute Algolia Search
  const executeSearch = useCallback(
    async (searchTerm: string) => {
      const trimmed = searchTerm.trim();
      if (!trimmed) {
        setWordSuggestions([]);
        setSongs([]);
        setArtists([]);
        setPlaylists([]);
        setPrediction("");
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      try {
        const { results }: any = await searchClient.search([
          {
            indexName: ALGOLIA_INDEX_NAME,
            params: { query: trimmed, hitsPerPage: 8 },
          },
          {
            indexName: ALGOLIA_INDEX_NAME,
            params: {
              query: trimmed,
              hitsPerPage: 5,
              facetFilters: ["type:song"],
            },
          },
          {
            indexName: ALGOLIA_INDEX_NAME,
            params: {
              query: trimmed,
              hitsPerPage: 3,
              facetFilters: ["type:artist"],
            },
          },
          {
            indexName: ALGOLIA_INDEX_NAME,
            params: {
              query: trimmed,
              hitsPerPage: 3,
              facetFilters: [["type:playlist", "type:userPlaylist"]],
            },
          },
        ]);

        const suggestionHits = results[0]?.hits || [];
        const songHits = results[1]?.hits || [];
        const artistHits = results[2]?.hits || [];
        const playlistHits = results[3]?.hits || [];

        const words = extractWordSuggestions(trimmed, suggestionHits);
        setWordSuggestions(words);
        setSongs(songHits);
        setArtists(artistHits);
        setPlaylists(playlistHits);

        if (words.length > 0) {
          setPrediction(words[0].label);
        } else if (songHits.length > 0) {
          setPrediction(songHits[0].title);
        } else {
          setPrediction("");
        }
      } catch (err) {
        console.warn("Algolia search failed:", err);
      } finally {
        setIsSearching(false);
      }
    },
    [searchClient]
  );

  // Debounced search on input change
  useEffect(() => {
    if (!query.trim()) {
      setWordSuggestions([]);
      setSongs([]);
      setArtists([]);
      setPlaylists([]);
      setPrediction("");
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(() => {
      executeSearch(query);
    }, 180);

    return () => clearTimeout(timer);
  }, [query, executeSearch]);

  // Click outside listener to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        setIsFocused(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Global keyboard shortcuts (Cmd+K, Ctrl+K, /)
  useEffect(() => {
    const handleGlobalShortcuts = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement;

      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      } else if (e.key === "/" && !e.shiftKey && !isInput) {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
    };

    window.addEventListener("keydown", handleGlobalShortcuts);
    return () => window.removeEventListener("keydown", handleGlobalShortcuts);
  }, []);

  // Apply completed word into input & search immediately without losing focus
  const handleApplyWord = useCallback(
    (wordToApply: string) => {
      const clean = wordToApply.trim();
      if (!clean) return;

      setQuery(clean);
      saveRecentSearchItem({
        id: `word-${clean.toLowerCase()}`,
        type: "word",
        label: clean,
        subtitle: "Recent search",
      });
      setRecentSearches(getStoredRecentSearches());
      executeSearch(clean);
      setIsOpen(true);

      if (inputRef.current) {
        inputRef.current.focus();
        requestAnimationFrame(() => {
          inputRef.current?.focus();
          inputRef.current?.setSelectionRange(clean.length, clean.length);
        });
      }
    },
    [executeSearch]
  );

  // Play a song
  const handlePlaySong = async (songItem: any) => {
    previewPlayer.stopPreview(true);
    let songToPlay: Song = {
      id: songItem.objectID || songItem.id,
      title: songItem.title,
      artistName: songItem.artistName || songItem.artist || "Unknown Artist",
      album: songItem.album || null,
      genre: songItem.genre || null,
      language: songItem.language || "",
      lrclibId: songItem.lrclibId || "",
      imageKey: songItem.imageKey || "",
      songKey: songItem.songKey || "",
      duration: Number(songItem.duration || 0),
      status: "ACTIVE",
      totalStreams: Number(songItem.totalStreams || 0),
      createdAt: "",
    };

    if (!songToPlay.songKey && songToPlay.id) {
      try {
        const res = await musicApi.songs.getById(songToPlay.id);
        if (res?.data) {
          songToPlay = { ...songToPlay, ...res.data };
        }
      } catch (err) {
        console.warn("Failed to load song details from backend:", err);
      }
    }

    saveRecentSearchItem({
      id: `song-${songToPlay.id}`,
      type: "song",
      label: songToPlay.title,
      subtitle:
        [songToPlay.artistName, songToPlay.album].filter(Boolean).join(" • ") ||
        "Song",
      imageKey: songToPlay.imageKey,
      data: songToPlay,
    });
    setRecentSearches(getStoredRecentSearches());

    if (onSongSelected) {
      onSongSelected(songToPlay);
    } else {
      playerActions.playWithRadio(mapToPlayerSong(songToPlay));
      toast.success("Playing Song Radio", {
        description: `Starting infinite radio for "${songToPlay.title}"...`,
      });
      playerActions.stageSearchPlay(songToPlay.id);
    }
    setIsOpen(false);
  };

  // Click artist
  const handleArtistClick = (artistId: string, artistData?: any) => {
    saveRecentSearchItem({
      id: `artist-${artistId}`,
      type: "artist",
      label: artistData?.name || "Artist",
      subtitle: "Artist",
      imageKey: artistData?.coverImageKey,
      data: artistData,
    });
    setRecentSearches(getStoredRecentSearches());
    setIsOpen(false);
    if (onArtistSelected) {
      onArtistSelected(artistId);
    } else {
      router.push(`/artists/${artistId}`);
    }
  };

  // Click playlist
  const handlePlaylistClick = (
    playlistId: string,
    isUserPlaylist: boolean,
    playlistData?: any
  ) => {
    saveRecentSearchItem({
      id: `playlist-${playlistId}`,
      type: "playlist",
      label: playlistData?.name || "Playlist",
      subtitle: isUserPlaylist ? "User Playlist" : "Playlist",
      imageKey: playlistData?.coverImageKey,
      data: playlistData,
    });
    setRecentSearches(getStoredRecentSearches());
    setIsOpen(false);
    if (onPlaylistSelected) {
      onPlaylistSelected(playlistId, isUserPlaylist);
    } else {
      router.push(
        isUserPlaylist
          ? `/my-playlists/${playlistId}`
          : `/playlists/${playlistId}`
      );
    }
  };

  // Remove individual recent search item
  const handleDeleteRecent = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    removeRecentSearchItem(id);
    if (
      id.startsWith("song-") ||
      id.startsWith("artist-") ||
      id.startsWith("playlist-")
    ) {
      const rawId = id.replace(/^(song|artist|playlist)-/, "");
      musicApi.users.deleteSearchHistoryItem(rawId).catch(() => {});
    }
    setRecentSearches(getStoredRecentSearches());
  };

  // Clear all recent searches
  const handleClearAllRecent = (e: React.MouseEvent) => {
    e.stopPropagation();
    clearAllRecentSearches();
    musicApi.users.clearSearchHistory().catch(() => {});
    setRecentSearches([]);
    toast.success("Recent searches cleared");
  };

  // Keydown handler: Tab / ArrowRight / Enter / Escape
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (
      e.key === "Tab" ||
      (e.key === "ArrowRight" &&
        inputRef.current?.selectionStart === query.length)
    ) {
      const candidate =
        prediction || wordSuggestions[0]?.label || songs[0]?.title || "";
      if (candidate) {
        e.preventDefault();
        handleApplyWord(candidate);
        return;
      }
    }

    if (e.key === "Enter") {
      e.preventDefault();
      const trimmed = query.trim();
      if (trimmed) {
        saveRecentSearchItem({
          id: `word-${trimmed.toLowerCase()}`,
          type: "word",
          label: trimmed,
          subtitle: "Recent search",
        });
        setRecentSearches(getStoredRecentSearches());
        executeSearch(trimmed);
      }
    }

    if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  const hasRecentHistory = recentSearches.length > 0;
  const fallbackTrending = [
    {
      id: "word-trending-1",
      type: "word" as const,
      label: "Arijit Singh",
      subtitle: "Trending Artist",
      timestamp: Date.now(),
    },
    {
      id: "word-trending-2",
      type: "word" as const,
      label: "Bollywood Hits",
      subtitle: "Popular Search",
      timestamp: Date.now(),
    },
    {
      id: "word-trending-3",
      type: "word" as const,
      label: "Lo-Fi Chill",
      subtitle: "Trending Genre",
      timestamp: Date.now(),
    },
  ];

  const recentItemsToDisplay = hasRecentHistory
    ? recentSearches
    : fallbackTrending;

  const hasResults =
    wordSuggestions.length > 0 ||
    songs.length > 0 ||
    artists.length > 0 ||
    playlists.length > 0;

  return (
    <div
      ref={containerRef}
      className={`w-full relative select-none ${className}`}
    >
      {/* Search Input Box */}
      <div
        onClick={() => {
          setIsOpen(true);
          inputRef.current?.focus();
        }}
        className={`relative flex items-center h-10.5 px-3.5 rounded-full transition-all duration-200 border cursor-text shadow-inner ${
          isFocused || isOpen
            ? "bg-[#121214] border-white/35 shadow-[0_0_0_1px_rgba(255,255,255,0.25),0_8px_30px_rgba(0,0,0,0.6)]"
            : "bg-white/6 hover:bg-white/10 border-white/10 hover:border-white/20"
        }`}
      >
        {/* Search Icon / Loading Spinner */}
        <div className="shrink-0 text-zinc-400 mr-2.5 flex items-center justify-center">
          {isSearching ? (
            <Loader2 size={16} className="animate-spin text-white" />
          ) : (
            <Search
              size={16}
              className={`transition-colors ${
                isFocused || isOpen ? "text-white" : "text-zinc-400"
              }`}
            />
          )}
        </div>

        {/* Input Wrapper with Ghost Prediction */}
        <div className="relative flex-1 min-w-0 flex items-center h-full">
          {/* Ghost Completion Layer */}
          {isFocused && query && prediction && (
            <div
              className="absolute inset-0 flex items-center pointer-events-none select-none text-[13px] font-medium font-sans overflow-hidden"
              aria-hidden="true"
            >
              {prediction.toLowerCase().startsWith(query.toLowerCase()) ? (
                <>
                  <span className="opacity-0 whitespace-pre">{query}</span>
                  <span className="text-zinc-500 opacity-90 whitespace-pre">
                    {prediction.slice(query.length)}
                  </span>
                  <span className="ml-2 px-1.5 py-0.5 text-[9px] font-mono font-semibold uppercase tracking-wider bg-white/10 text-zinc-400 border border-white/15 rounded shrink-0">
                    Tab ⇥
                  </span>
                </>
              ) : (
                <>
                  <span className="opacity-0 whitespace-pre">{query}</span>
                  <span className="text-zinc-500 opacity-70 whitespace-pre">
                    {" "}({prediction})
                  </span>
                  <span className="ml-2 px-1.5 py-0.5 text-[9px] font-mono font-semibold uppercase tracking-wider bg-white/10 text-zinc-400 border border-white/15 rounded shrink-0">
                    Tab ⇥
                  </span>
                </>
              )}
            </div>
          )}

          {/* Actual HTML Input */}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => {
              setIsFocused(true);
              setIsOpen(true);
              setRecentSearches(getStoredRecentSearches());
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            spellCheck="false"
            autoComplete="off"
            autoCorrect="off"
            className="w-full h-full bg-transparent text-[13px] font-medium font-sans text-white placeholder-zinc-400 outline-none border-none relative z-10 p-0"
          />
        </div>

        {/* Clear Button */}
        {query && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setQuery("");
              setPrediction("");
              setWordSuggestions([]);
              setSongs([]);
              setArtists([]);
              setPlaylists([]);
              setRecentSearches(getStoredRecentSearches());
              inputRef.current?.focus();
            }}
            className="shrink-0 p-1 text-zinc-400 hover:text-white rounded-full hover:bg-white/10 transition-colors ml-1 cursor-pointer relative z-20"
            title="Clear search"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {/* Dropdown Panel with Framer Motion */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.99 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute top-full left-0 right-0 mt-2 bg-[#121214]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl shadow-black/80 overflow-hidden z-50 max-h-[70vh] flex flex-col"
          >
            {/* VIEW A: Blank Query -> Show Recent Searches immediately */}
            {!query.trim() && (
              <div className="flex-1 overflow-y-auto no-scrollbar">
                {/* Header */}
                <div className="p-3 border-b border-white/8 flex items-center justify-between sticky top-0 bg-[#121214]/95 backdrop-blur-md z-10">
                  <div className="flex items-center gap-2 text-xs font-semibold text-zinc-400">
                    <Clock size={13} className="text-zinc-500" />
                    <span>
                      {hasRecentHistory
                        ? "Recent Searches"
                        : "Trending Searches"}
                    </span>
                  </div>
                  {hasRecentHistory && (
                    <button
                      type="button"
                      onClick={handleClearAllRecent}
                      className="text-[11px] font-medium text-zinc-500 hover:text-red-400 flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Trash2 size={12} />
                      Clear all
                    </button>
                  )}
                </div>

                {/* Recent Items List */}
                <div className="p-2 space-y-1">
                  {recentItemsToDisplay.map((item) => {
                    const isWord = item.type === "word";
                    const isSong = item.type === "song";
                    const isArtist = item.type === "artist";

                    return (
                      <div
                        key={item.id}
                        onClick={() => {
                          if (isWord) {
                            handleApplyWord(item.label);
                          } else if (isSong) {
                            handlePlaySong(
                              item.data || {
                                id: item.id.replace("song-", ""),
                                title: item.label,
                              }
                            );
                          } else if (isArtist) {
                            handleArtistClick(
                              item.data?.objectID ||
                                item.id.replace("artist-", ""),
                              item.data
                            );
                          } else {
                            handlePlaylistClick(
                              item.data?.objectID ||
                                item.id.replace("playlist-", ""),
                              item.data?.type === "userPlaylist",
                              item.data
                            );
                          }
                        }}
                        className="w-full flex items-center justify-between p-2 hover:bg-white/8 rounded-lg transition-all text-left group cursor-pointer"
                      >
                        {/* Left Icon / Thumbnail */}
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          {isWord ? (
                            <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/8 flex items-center justify-center text-zinc-500 group-hover:text-white transition-colors shrink-0">
                              <Clock size={14} />
                            </div>
                          ) : isSong ? (
                            <SongThumbnail
                              song={
                                item.data || {
                                  id: item.id.replace("song-", ""),
                                  title: item.label,
                                  imageKey: item.imageKey,
                                }
                              }
                              sizeClass="w-9 h-9"
                              roundedClass="rounded-md"
                              enablePreviewHover={true}
                              onPlayClick={() =>
                                handlePlaySong(
                                  item.data || {
                                    id: item.id.replace("song-", ""),
                                    title: item.label,
                                  }
                                )
                              }
                            />
                          ) : isArtist ? (
                            <div className="w-9 h-9 rounded-full bg-zinc-900 overflow-hidden shrink-0 flex items-center justify-center border border-white/10">
                              {item.imageKey ? (
                                <img
                                  src={getImageUrl(item.imageKey, {
                                    width: 80,
                                    height: 80,
                                    focus: "face",
                                  })}
                                  className="w-full h-full object-cover"
                                  alt=""
                                />
                              ) : (
                                <User size={15} className="text-zinc-500" />
                              )}
                            </div>
                          ) : (
                            <div className="w-9 h-9 rounded-md bg-zinc-900 overflow-hidden shrink-0 flex items-center justify-center border border-white/10">
                              {item.imageKey ? (
                                <img
                                  src={getImageUrl(item.imageKey, {
                                    width: 80,
                                    height: 80,
                                  })}
                                  className="w-full h-full object-cover"
                                  alt=""
                                />
                              ) : (
                                <ListMusic
                                  size={15}
                                  className="text-zinc-500"
                                />
                              )}
                            </div>
                          )}

                          {/* Info Text */}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-white truncate">
                              {item.label}
                            </p>
                            <p className="text-[11px] text-zinc-400 truncate">
                              {item.subtitle ||
                                (isWord
                                  ? "Recent search"
                                  : isSong
                                  ? "Song"
                                  : isArtist
                                  ? "Artist"
                                  : "Playlist")}
                            </p>
                          </div>
                        </div>

                        {/* Right Action / Delete */}
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/6 text-zinc-400 border border-white/8 shrink-0">
                            {isWord
                              ? "Search"
                              : isSong
                              ? "Song"
                              : isArtist
                              ? "Artist"
                              : "Playlist"}
                          </span>
                          {hasRecentHistory && (
                            <button
                              type="button"
                              onClick={(e) => handleDeleteRecent(e, item.id)}
                              className="p-1 rounded-full text-zinc-500 hover:text-white hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                              title="Remove"
                            >
                              <X size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* VIEW B: Active Query -> Live Algolia Search Results */}
            {query.trim() && (
              <div className="flex-1 overflow-y-auto no-scrollbar">
                {/* 1. Word & Query Completions */}
                {wordSuggestions.length > 0 && (
                  <div className="p-2 border-b border-white/5">
                    <span className="px-3 py-1 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">
                      Word & Query Completions
                    </span>
                    {wordSuggestions.map((sug) => (
                      <div
                        key={sug.label}
                        onClick={() => handleApplyWord(sug.label)}
                        className="w-full flex items-center justify-between p-2 hover:bg-white/8 rounded-lg transition-all text-left group cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <Search
                            size={14}
                            className="text-zinc-500 group-hover:text-white transition-colors shrink-0"
                          />
                          <span className="text-xs font-medium text-white truncate">
                            {sug.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500 group-hover:text-zinc-400">
                            {sug.type === "word" ? "Word" : sug.type}
                          </span>
                          <ArrowUpRight
                            size={13}
                            className="text-zinc-500 group-hover:text-white group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* 2. Songs Source */}
                {songs.length > 0 && (
                  <div className="p-2 border-b border-white/5">
                    <span className="px-3 py-1 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">
                      Songs
                    </span>
                    {songs.map((song) => (
                      <div
                        key={song.id || song.objectID}
                        onClick={() => handlePlaySong(song)}
                        className="w-full flex items-center gap-3 p-2 hover:bg-white/8 rounded-lg transition-all text-left group cursor-pointer"
                      >
                        <SongThumbnail
                          song={song}
                          sizeClass="w-10 h-10"
                          roundedClass="rounded-md"
                          enablePreviewHover={true}
                          onPlayClick={() => handlePlaySong(song)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-white truncate">
                            {song.title}
                          </p>
                          <p className="text-[11px] text-zinc-400 truncate">
                            {[song.artistName || song.artist, song.album]
                              .filter(Boolean)
                              .join(" • ")}
                            {song.totalStreams
                              ? ` • ${formatStreamCount(
                                  Number(song.totalStreams),
                                  true
                                )}`
                              : ""}
                          </p>
                        </div>
                        <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/6 text-zinc-400 border border-white/8 shrink-0">
                          Song
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* 3. Artists Source */}
                {artists.length > 0 && (
                  <div className="p-2 border-b border-white/5">
                    <span className="px-3 py-1 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">
                      Artists
                    </span>
                    {artists.map((artist) => (
                      <div
                        key={artist.objectID || artist.id}
                        onClick={() =>
                          handleArtistClick(artist.objectID || artist.id, artist)
                        }
                        className="w-full flex items-center gap-3 p-2 hover:bg-white/8 rounded-lg transition-all text-left group cursor-pointer"
                      >
                        <div className="w-10 h-10 rounded-full bg-zinc-900 overflow-hidden shrink-0 flex items-center justify-center border border-white/10">
                          {artist.coverImageKey ? (
                            <img
                              src={getImageUrl(artist.coverImageKey, {
                                width: 80,
                                height: 80,
                                focus: "face",
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
                          <p className="text-[11px] text-zinc-400 truncate">
                            {typeof artist.followersCount === "number"
                              ? formatFollowerCount(artist.followersCount)
                              : "Artist"}
                          </p>
                        </div>
                        <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/6 text-zinc-400 border border-white/8 shrink-0">
                          Artist
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* 4. Playlists Source */}
                {playlists.length > 0 && (
                  <div className="p-2">
                    <span className="px-3 py-1 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">
                      Playlists
                    </span>
                    {playlists.map((playlist) => (
                      <div
                        key={playlist.objectID || playlist.id}
                        onClick={() =>
                          handlePlaylistClick(
                            playlist.objectID || playlist.id,
                            playlist.type === "userPlaylist",
                            playlist
                          )
                        }
                        className="w-full flex items-center gap-3 p-2 hover:bg-white/8 rounded-lg transition-all text-left group cursor-pointer"
                      >
                        <div className="w-10 h-10 rounded-md bg-zinc-900 overflow-hidden shrink-0 flex items-center justify-center border border-white/10">
                          {playlist.coverImageKey ? (
                            <img
                              src={getImageUrl(playlist.coverImageKey, {
                                width: 80,
                                height: 80,
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
                          <p className="text-[11px] text-zinc-400 truncate">
                            {typeof playlist.totalSongs === "number"
                              ? `${playlist.totalSongs} tracks`
                              : playlist.type === "userPlaylist"
                              ? "User Playlist"
                              : "Playlist"}
                          </p>
                        </div>
                        <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/6 text-zinc-400 border border-white/8 shrink-0">
                          {playlist.type === "userPlaylist"
                            ? "User Playlist"
                            : "Playlist"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Empty State */}
                {!isSearching && !hasResults && (
                  <div className="p-8 text-center text-zinc-500 text-xs font-normal">
                    No results found for &quot;{query}&quot;
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
