import { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Keyboard,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useBottomBarSpacing } from "@/hooks";
import { useRouter } from "expo-router";
import { useDispatch } from "react-redux";
import { Ionicons } from "@expo/vector-icons";
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { playWithSimilarSongs, AppDispatch } from "@/store";
import { searchService, albumService } from "@/service";
import {
  Song,
  Artist,
  Playlist,
  UserPlaylist,
  UserSearchHistoryItem,
  UserSearchHistoryGrouped,
  RecentSearchItem,
} from "@/types";
import {
  SongRowItem,
  ArtistCircleCard,
  PlaylistCard,
  SearchHistoryItem,
  CategoryGenreCard,
  POPULAR_GENRES,
  UserPlaylistThumbnail,
  AlbumCard,
  WordSuggestionPills,
  AutocompleteSuggestionItem,
} from "@/components";
import { hapticFeedback } from "@/utils/haptics";
import { searchStyles as styles } from "@/styles";

const FALLBACK_TRENDING: RecentSearchItem[] = [
  {
    id: "word-trending-1",
    type: "word",
    label: "Arijit Singh",
    subtitle: "Trending Artist",
    timestamp: Date.now(),
  },
  {
    id: "word-trending-2",
    type: "word",
    label: "Bollywood Hits",
    subtitle: "Popular Search",
    timestamp: Date.now(),
  },
  {
    id: "word-trending-3",
    type: "word",
    label: "Lo-Fi Chill",
    subtitle: "Trending Genre",
    timestamp: Date.now(),
  },
  {
    id: "word-trending-4",
    type: "word",
    label: "Sidhu Moose Wala",
    subtitle: "Top Artist",
    timestamp: Date.now(),
  },
  {
    id: "word-trending-5",
    type: "word",
    label: "Pritam",
    subtitle: "Composer",
    timestamp: Date.now(),
  },
];

export default function SearchScreen() {
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const queryClient = useQueryClient();

  const { bottomSpace } = useBottomBarSpacing({ gap: 10 });

  const [inputText, setInputText] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [localRecentSearches, setLocalRecentSearches] = useState<
    RecentSearchItem[]
  >([]);

  // Debounce input by 180ms matching audioFrontend
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(inputText.trim());
    }, 180);
    return () => clearTimeout(timer);
  }, [inputText]);

  // Load stored recent searches from AsyncStorage on mount
  useEffect(() => {
    searchService.getStoredRecentSearches().then((stored) => {
      setLocalRecentSearches(stored);
    });
  }, []);

  // Search history query from backend
  const { data: historyData } = useQuery<UserSearchHistoryGrouped>({
    queryKey: ["search-history"],
    queryFn: () => searchService.getSearchHistory(),
    staleTime: 60 * 1000,
  });

  // Sync background account history into local recent searches on mount / update
  useEffect(() => {
    const remoteRecent = historyData?.recent;
    if (!Array.isArray(remoteRecent) || remoteRecent.length === 0) return;

    searchService.getStoredRecentSearches().then(async (current) => {
      const currentIds = new Set(current.map((c) => c.id));
      let changed = false;
      const merged: RecentSearchItem[] = [...current];

      for (const item of remoteRecent) {
        if (
          item.type === "SONG" &&
          item.song &&
          !currentIds.has(`song-${item.song.id}`)
        ) {
          merged.push({
            id: `song-${item.song.id}`,
            type: "song",
            label: item.song.title,
            subtitle: [item.song.artistName || "Song", item.song.album]
              .filter(Boolean)
              .join(" • "),
            imageKey: item.song.imageKey || "",
            timestamp: Date.now(),
            data: item.song,
          });
          currentIds.add(`song-${item.song.id}`);
          changed = true;
        } else if (
          item.type === "ARTIST" &&
          item.artist &&
          !currentIds.has(`artist-${item.artist.id}`)
        ) {
          merged.push({
            id: `artist-${item.artist.id}`,
            type: "artist",
            label: item.artist.name,
            subtitle: "Artist",
            imageKey: item.artist.coverImageKey || "",
            timestamp: Date.now(),
            data: item.artist,
          });
          currentIds.add(`artist-${item.artist.id}`);
          changed = true;
        } else if (
          item.type === "PLAYLIST" &&
          item.playlist &&
          !currentIds.has(`playlist-${item.playlist.id}`)
        ) {
          merged.push({
            id: `playlist-${item.playlist.id}`,
            type: "playlist",
            label: item.playlist.name,
            subtitle: "Playlist",
            imageKey: item.playlist.coverImageKey || "",
            timestamp: Date.now(),
            data: item.playlist,
          });
          currentIds.add(`playlist-${item.playlist.id}`);
          changed = true;
        } else if (
          item.type === "USER_PLAYLIST" &&
          item.userPlaylist &&
          !currentIds.has(`userplaylist-${item.userPlaylist.id}`)
        ) {
          merged.push({
            id: `userplaylist-${item.userPlaylist.id}`,
            type: "userPlaylist",
            label: item.userPlaylist.name,
            subtitle: "Community Playlist",
            timestamp: Date.now(),
            data: item.userPlaylist,
          });
          currentIds.add(`userplaylist-${item.userPlaylist.id}`);
          changed = true;
        }
      }

      if (changed) {
        const sliced = merged.slice(0, 12);
        await AsyncStorage.setItem(
          "@one_melody_recent_searches_v2",
          JSON.stringify(sliced)
        );
        setLocalRecentSearches(sliced);
      }
    });
  }, [historyData]);

  // Fast autocomplete multi-query (enabled while typing, before explicit submission)
  const {
    data: autocompleteData,
    isFetching: isFetchingAutocomplete,
  } = useQuery({
    queryKey: ["autocomplete", debouncedQuery],
    queryFn: () => searchService.autocomplete(debouncedQuery),
    enabled: debouncedQuery.length > 0 && !isSubmitted,
    staleTime: 30 * 1000,
  });

  // Deep search results query (enabled when user submits search)
  const {
    data: searchResults,
    isLoading: isInitialLoading,
    isFetching: isFetchingSearch,
  } = useQuery({
    queryKey: ["search", debouncedQuery],
    queryFn: () => searchService.search(debouncedQuery),
    enabled: debouncedQuery.length > 0 && isSubmitted,
    placeholderData: keepPreviousData,
    staleTime: 2 * 60 * 1000,
  });

  const isActivelySearching =
    (debouncedQuery.length > 0 &&
      (isFetchingAutocomplete || isFetchingSearch)) ||
    (inputText.trim().length > 0 && inputText.trim() !== debouncedQuery);

  // Full search results
  const fullSongs = searchResults?.songs || [];
  const fullArtists = searchResults?.artists || [];
  const fullPlaylists = searchResults?.playlists || [];
  const fullUserPlaylists = searchResults?.userPlaylists || [];

  // Autocomplete results
  const wordSuggestions = autocompleteData?.wordSuggestions || [];
  const autoSongs = autocompleteData?.songs || [];
  const autoArtists = autocompleteData?.artists || [];
  const autoPlaylists = autocompleteData?.playlists || [];
  const autoUserPlaylists = autocompleteData?.userPlaylists || [];

  const hasAutocompleteResults =
    wordSuggestions.length > 0 ||
    autoSongs.length > 0 ||
    autoArtists.length > 0 ||
    autoPlaylists.length > 0 ||
    autoUserPlaylists.length > 0;

  // Query all albums to match against query
  const { data: allAlbums = [] } = useQuery({
    queryKey: ["all-albums"],
    queryFn: () => albumService.getAllAlbums(),
    staleTime: 5 * 60 * 1000,
  });

  const matchingAlbums = useMemo(() => {
    const q = (debouncedQuery || inputText).toLowerCase().trim();
    if (!q) return [];

    const map = new Map<string, any>();

    // Matches from allAlbums
    for (const alb of allAlbums) {
      const albName = (alb?.name || alb?.album || "").trim();
      const artist = (alb?.artistName || "").trim();
      if (
        albName &&
        (albName.toLowerCase().includes(q) || artist.toLowerCase().includes(q))
      ) {
        map.set(albName.toLowerCase(), {
          name: albName,
          artistName: alb.artistName || "Various Artists",
          imageKey: alb.imageKey,
          trackCount: alb.trackCount || alb.count,
        });
      }
    }

    // Matches from songs
    for (const song of fullSongs) {
      const albName = (song.album || "").trim();
      if (albName && !map.has(albName.toLowerCase())) {
        if (
          albName.toLowerCase().includes(q) ||
          (song.title && song.title.toLowerCase().includes(q)) ||
          (song.artistName && song.artistName.toLowerCase().includes(q))
        ) {
          map.set(albName.toLowerCase(), {
            name: albName,
            artistName: song.artistName || "Various Artists",
            imageKey: song.imageKey,
          });
        }
      }
    }

    return Array.from(map.values()).slice(0, 4);
  }, [allAlbums, fullSongs, debouncedQuery, inputText]);

  const hasAnyFullResults =
    fullSongs.length > 0 ||
    matchingAlbums.length > 0 ||
    fullPlaylists.length > 0 ||
    fullUserPlaylists.length > 0 ||
    fullArtists.length > 0;

  // Handlers
  const handleTextChange = (text: string) => {
    setInputText(text);
    setIsSubmitted(false);
  };

  const handleSelectSong = (song: Song, contextSongs: Song[] = fullSongs) => {
    searchService.saveSearchHistory({ type: "SONG", songId: song.id });
    searchService.trackSearchPlay(song.id);
    searchService
      .saveRecentSearchItem({
        id: `song-${song.id}`,
        type: "song",
        label: song.title,
        subtitle:
          [song.artistName, song.album].filter(Boolean).join(" • ") || "Song",
        imageKey: song.imageKey,
        data: song,
      })
      .then(setLocalRecentSearches);

    queryClient.invalidateQueries({ queryKey: ["search-history"] });
    dispatch(
      playWithSimilarSongs(
        song,
        contextSongs.length > 0 ? contextSongs : [song]
      )
    );
    router.push({
      pathname: "/(authenticated)/song/[id]",
      params: { id: song.id },
    });
  };

  const handleSelectArtist = (artist: Artist) => {
    searchService.saveSearchHistory({ type: "ARTIST", artistId: artist.id });
    searchService.trackSearchClick("ARTIST", artist.id);
    searchService
      .saveRecentSearchItem({
        id: `artist-${artist.id}`,
        type: "artist",
        label: artist.name,
        subtitle: "Artist",
        imageKey: artist.coverImageKey,
        data: artist,
      })
      .then(setLocalRecentSearches);

    queryClient.invalidateQueries({ queryKey: ["search-history"] });
    router.push({
      pathname: "/(authenticated)/artist/[id]",
      params: { id: artist.id, name: artist.name },
    });
  };

  const handleSelectPlaylist = (playlist: Playlist) => {
    searchService.saveSearchHistory({
      type: "PLAYLIST",
      playlistId: playlist.id,
    });
    searchService.trackSearchClick("PLAYLIST", playlist.id);
    searchService
      .saveRecentSearchItem({
        id: `playlist-${playlist.id}`,
        type: "playlist",
        label: playlist.name,
        subtitle: "Playlist",
        imageKey: playlist.coverImageKey,
        data: playlist,
      })
      .then(setLocalRecentSearches);

    queryClient.invalidateQueries({ queryKey: ["search-history"] });
    router.push({
      pathname: "/(authenticated)/playlist/[id]",
      params: { id: playlist.id },
    });
  };

  const handleSelectUserPlaylist = (uPlaylist: UserPlaylist) => {
    searchService.saveSearchHistory({
      type: "USER_PLAYLIST",
      userPlaylistId: uPlaylist.id,
    });
    searchService.trackSearchClick("USER_PLAYLIST", uPlaylist.id);
    searchService
      .saveRecentSearchItem({
        id: `userplaylist-${uPlaylist.id}`,
        type: "userPlaylist",
        label: uPlaylist.name,
        subtitle: "Community Playlist",
        data: uPlaylist,
      })
      .then(setLocalRecentSearches);

    queryClient.invalidateQueries({ queryKey: ["search-history"] });
    router.push({
      pathname: "/(authenticated)/userplaylist/[id]",
      params: { id: uPlaylist.id },
    });
  };

  const handleSelectWord = (word: string) => {
    const clean = word.trim();
    if (!clean) return;

    searchService
      .saveRecentSearchItem({
        id: `word-${clean.toLowerCase()}`,
        type: "word",
        label: clean,
        subtitle: "Recent search",
      })
      .then(setLocalRecentSearches);

    setInputText(clean);
    setDebouncedQuery(clean);
    setIsSubmitted(true);
    Keyboard.dismiss();
  };

  const handleFillWord = (word: string) => {
    setInputText(word);
  };

  const handleSelectHistoryItem = (
    item: RecentSearchItem | UserSearchHistoryItem
  ) => {
    if (item.type === "word") {
      const word = (item as RecentSearchItem).label;
      handleSelectWord(word);
      return;
    }

    if (item.type === "SONG" || item.type === "song") {
      const song = (item as any).song || (item as any).data;
      if (song) handleSelectSong(song);
    } else if (item.type === "ARTIST" || item.type === "artist") {
      const artist = (item as any).artist || (item as any).data;
      if (artist) handleSelectArtist(artist);
    } else if (item.type === "PLAYLIST" || item.type === "playlist") {
      const playlist = (item as any).playlist || (item as any).data;
      if (playlist) handleSelectPlaylist(playlist);
    } else if (item.type === "USER_PLAYLIST" || item.type === "userPlaylist") {
      const userPlaylist = (item as any).userPlaylist || (item as any).data;
      if (userPlaylist) handleSelectUserPlaylist(userPlaylist);
    }
  };

  const handleDeleteHistoryItem = async (id: string) => {
    const updated = await searchService.removeRecentSearchItem(id);
    setLocalRecentSearches(updated);

    if (
      id.startsWith("song-") ||
      id.startsWith("artist-") ||
      id.startsWith("playlist-") ||
      id.startsWith("userplaylist-")
    ) {
      const rawId = id.replace(
        /^(song|artist|playlist|userplaylist)-/,
        ""
      );
      searchService.deleteSearchHistoryItem(rawId).catch(() => {});
    } else if (!id.startsWith("word-")) {
      searchService.deleteSearchHistoryItem(id).catch(() => {});
    }

    queryClient.setQueryData<UserSearchHistoryGrouped>(
      ["search-history"],
      (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          recent: prev.recent.filter((item) => item.id !== id),
        };
      }
    );
  };

  const handleClearHistory = async () => {
    await searchService.clearAllRecentSearches();
    setLocalRecentSearches([]);
    queryClient.setQueryData<UserSearchHistoryGrouped>(
      ["search-history"],
      (prev) => {
        if (!prev) return prev;
        return { ...prev, recent: [] };
      }
    );
    await searchService.clearSearchHistory();
  };

  const handleSelectGenre = (genreName: string) => {
    setInputText(genreName);
    setDebouncedQuery(genreName);
    setIsSubmitted(true);
  };

  const hasRecentHistory = localRecentSearches.length > 0;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.screenTitle}>Search</Text>

        <View style={styles.searchBar}>
          <Ionicons
            name="search"
            size={19}
            color="#8A8A8A"
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Songs, artists, playlists"
            placeholderTextColor="#5A5A5A"
            value={inputText}
            onChangeText={handleTextChange}
            onSubmitEditing={() => {
              const q = inputText.trim();
              if (q) {
                handleSelectWord(q);
              }
            }}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            selectionColor="#FFFFFF"
          />
          {isActivelySearching ? (
            <ActivityIndicator
              size="small"
              color="#FFFFFF"
              style={styles.searchSpinner}
            />
          ) : null}
          {inputText.length > 0 ? (
            <TouchableOpacity
              onPress={() => {
                setInputText("");
                setDebouncedQuery("");
                setIsSubmitted(false);
              }}
              style={styles.clearButton}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Clear search"
            >
              <Ionicons name="close-circle" size={19} color="#8A8A8A" />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Word suggestions pill chips under search bar */}
        {inputText.trim().length > 0 &&
          !isSubmitted &&
          wordSuggestions.length > 0 && (
            <WordSuggestionPills
              suggestions={wordSuggestions}
              onSelectWord={handleSelectWord}
              onFillWord={handleFillWord}
            />
          )}
      </View>

      {/* Content Area */}
      {inputText.trim().length === 0 ? (
        // VIEW A: Blank Query -> Recent searches (with word queries) + Trending fallback + Browse genres
        <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={Keyboard.dismiss}
          contentContainerStyle={{
            paddingTop: 8,
            paddingBottom: bottomSpace,
          }}
        >
          {hasRecentHistory ? (
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Recent searches</Text>
                <TouchableOpacity onPress={handleClearHistory} hitSlop={10}>
                  <Text style={styles.linkText}>Clear all</Text>
                </TouchableOpacity>
              </View>

              {localRecentSearches.slice(0, 10).map((item) => (
                <SearchHistoryItem
                  key={item.id}
                  item={item}
                  onPress={() => handleSelectHistoryItem(item)}
                  onDelete={() => handleDeleteHistoryItem(item.id)}
                />
              ))}
            </View>
          ) : (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, styles.padded]}>
                Trending searches
              </Text>
              <View style={styles.trendingChipsContainer}>
                {FALLBACK_TRENDING.map((trend) => (
                  <TouchableOpacity
                    key={trend.id}
                    style={styles.trendingChip}
                    activeOpacity={0.7}
                    onPress={() => {
                      hapticFeedback.light();
                      handleSelectWord(trend.label);
                    }}
                  >
                    <Ionicons name="trending-up" size={14} color="#8E8E93" />
                    <Text style={styles.trendingChipText}>{trend.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, styles.padded]}>Browse all</Text>
            <View style={styles.genresGrid}>
              {POPULAR_GENRES.map((genre) => (
                <CategoryGenreCard
                  key={genre.id}
                  category={genre}
                  onPress={() => handleSelectGenre(genre.name)}
                />
              ))}
            </View>
          </View>
        </ScrollView>
      ) : !isSubmitted ? (
        // VIEW B: Live Autocomplete View (while typing)
        <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={Keyboard.dismiss}
          contentContainerStyle={{
            paddingTop: 4,
            paddingBottom: bottomSpace,
          }}
        >
          {/* 1. Word & Query Completions */}
          {wordSuggestions.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.subSectionTitle}>
                Word & Query Suggestions
              </Text>
              {wordSuggestions.map((sug) => (
                <AutocompleteSuggestionItem
                  key={sug.label}
                  item={{ kind: "word", suggestion: sug }}
                  onPress={() => handleSelectWord(sug.label)}
                  onFill={handleFillWord}
                />
              ))}
            </View>
          )}

          {/* 2. Top Songs */}
          {autoSongs.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.subSectionTitle}>Songs</Text>
              {autoSongs.map((song) => (
                <AutocompleteSuggestionItem
                  key={song.id}
                  item={{ kind: "song", song }}
                  onPress={() => handleSelectSong(song, autoSongs)}
                  onPlaySong={(s) => {
                    handleSelectSong(s, autoSongs);
                  }}
                />
              ))}
            </View>
          )}

          {/* 3. Top Artists */}
          {autoArtists.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.subSectionTitle}>Artists</Text>
              {autoArtists.map((artist) => (
                <AutocompleteSuggestionItem
                  key={artist.id}
                  item={{ kind: "artist", artist }}
                  onPress={() => handleSelectArtist(artist)}
                />
              ))}
            </View>
          )}

          {/* 4. Top Playlists & Community */}
          {(autoPlaylists.length > 0 || autoUserPlaylists.length > 0) && (
            <View style={styles.section}>
              <Text style={styles.subSectionTitle}>Playlists</Text>
              {autoPlaylists.map((playlist) => (
                <AutocompleteSuggestionItem
                  key={playlist.id}
                  item={{ kind: "playlist", playlist }}
                  onPress={() => handleSelectPlaylist(playlist)}
                />
              ))}
              {autoUserPlaylists.map((uPlaylist) => (
                <AutocompleteSuggestionItem
                  key={uPlaylist.id}
                  item={{ kind: "userPlaylist", userPlaylist: uPlaylist }}
                  onPress={() => handleSelectUserPlaylist(uPlaylist)}
                />
              ))}
            </View>
          )}

          {!isActivelySearching && !hasAutocompleteResults && (
            <View style={[styles.center, { paddingTop: 40 }]}>
              <Ionicons name="search-outline" size={38} color="#FFFFFF" />
              <Text style={styles.noResultsTitle}>
                No recommendations for &ldquo;{inputText.trim()}&rdquo;
              </Text>
              <Text style={styles.noResultsText}>
                Press return to search the entire catalog.
              </Text>
            </View>
          )}
        </ScrollView>
      ) : !hasAnyFullResults && (isInitialLoading || isActivelySearching) ? (
        // VIEW C: Deep Results Loading
        <View style={styles.center}>
          <ActivityIndicator size="small" color="#FFFFFF" />
        </View>
      ) : !hasAnyFullResults ? (
        // VIEW C: Deep Results Empty
        <View style={styles.center}>
          <Ionicons name="search-outline" size={44} color="#FFFFFF" />
          <Text style={styles.noResultsTitle}>
            No results for &ldquo;{debouncedQuery || inputText.trim()}&rdquo;
          </Text>
          <Text style={styles.noResultsText}>
            Check the spelling or try a different song, artist or genre.
          </Text>
        </View>
      ) : (
        // VIEW C: Full Search Results Categorized Deep View
        <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={Keyboard.dismiss}
          contentContainerStyle={{
            paddingTop: 8,
            paddingBottom: bottomSpace,
          }}
        >
          {/* 1. Artists */}
          {fullArtists.length > 0 ? (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, styles.padded]}>Artists</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalRow}
              >
                {fullArtists.map((artist) => (
                  <ArtistCircleCard
                    key={artist.id}
                    artist={artist}
                    onPress={() => handleSelectArtist(artist)}
                  />
                ))}
              </ScrollView>
            </View>
          ) : null}

          {/* 2. Songs */}
          {fullSongs.length > 0 ? (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, styles.padded]}>Songs</Text>
              {fullSongs.map((song, idx) => (
                <SongRowItem
                  key={song.id}
                  song={song}
                  index={idx}
                  onPress={() => handleSelectSong(song, fullSongs)}
                />
              ))}
            </View>
          ) : null}

          {/* 3. Albums */}
          {matchingAlbums.length > 0 ? (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, styles.padded]}>Albums</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalRow}
              >
                {matchingAlbums.map((album, idx) => (
                  <AlbumCard
                    key={`${album.name}-${idx}`}
                    album={album}
                    onPress={() => {
                      hapticFeedback.light();
                      router.push(
                        `/album/${encodeURIComponent(album.name)}` as any
                      );
                    }}
                  />
                ))}
              </ScrollView>
            </View>
          ) : null}

          {/* 4. Playlists */}
          {fullPlaylists.length > 0 ? (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, styles.padded]}>Playlists</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalRow}
              >
                {fullPlaylists.map((playlist) => (
                  <PlaylistCard
                    key={playlist.id}
                    playlist={playlist}
                    onPress={() => handleSelectPlaylist(playlist)}
                  />
                ))}
              </ScrollView>
            </View>
          ) : null}

          {/* 5. User Playlists */}
          {fullUserPlaylists.length > 0 ? (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, styles.padded]}>
                Community Playlists
              </Text>
              {fullUserPlaylists.map((uPlaylist) => (
                <TouchableOpacity
                  key={uPlaylist.id}
                  style={styles.userPlaylistRow}
                  onPress={() => handleSelectUserPlaylist(uPlaylist)}
                  activeOpacity={0.72}
                >
                  <UserPlaylistThumbnail
                    playlist={uPlaylist}
                    size={52}
                    borderRadius={10}
                    style={{ marginRight: 12 }}
                  />
                  <View style={styles.userPlaylistInfo}>
                    <Text style={styles.userPlaylistName} numberOfLines={1}>
                      {uPlaylist.name}
                    </Text>
                    <Text style={styles.userPlaylistMeta} numberOfLines={1}>
                      By {uPlaylist.ownerName || "User"}
                      {"  ·  "}
                      {uPlaylist.totalSongs}{" "}
                      {uPlaylist.totalSongs === 1 ? "song" : "songs"}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
