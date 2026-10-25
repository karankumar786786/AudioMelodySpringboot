import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Keyboard,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useDispatch } from "react-redux";
import { Ionicons } from "@expo/vector-icons";
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { AppDispatch } from "@/store";
import { playWithSimilarSongs } from "@/store/queueActions";
import { searchService } from "@/service";
import {
  Song,
  Artist,
  Playlist,
  UserPlaylist,
  UserSearchHistoryItem,
  UserSearchHistoryGrouped,
} from "@/types";
import { SongRowItem } from "@/components/home/SongRowItem";
import { ArtistCircleCard } from "@/components/home/ArtistCircleCard";
import { PlaylistCard } from "@/components/home/PlaylistCard";
import { SearchHistoryItem } from "@/components/search/SearchHistoryItem";
import { SearchTopResultCard } from "@/components/search/SearchTopResultCard";
import {
  CategoryGenreCard,
  POPULAR_GENRES,
} from "@/components/search/CategoryGenreCard";
import { UserPlaylistThumbnail } from "@/components/playlist/UserPlaylistThumbnail";

export default function SearchScreen() {
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const queryClient = useQueryClient();

  const [inputText, setInputText] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // Debounce input by 200ms for snappy, fluid search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(inputText.trim());
    }, 200);
    return () => clearTimeout(timer);
  }, [inputText]);

  // 1. Fetch Search History (when query is empty)
  const {
    data: historyData,
    isLoading: isHistoryLoading,
  } = useQuery<UserSearchHistoryGrouped>({
    queryKey: ["search-history"],
    queryFn: () => searchService.getSearchHistory(),
    staleTime: 60 * 1000,
  });

  // 2. Fetch Search Results (with keepPreviousData to preserve old results while typing)
  const {
    data: searchResults,
    isLoading: isInitialLoading,
    isFetching,
  } = useQuery({
    queryKey: ["search", debouncedQuery],
    queryFn: () => searchService.search(debouncedQuery),
    enabled: debouncedQuery.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 2 * 60 * 1000,
  });

  const isActivelySearching =
    (debouncedQuery.length > 0 && isFetching) ||
    (inputText.trim().length > 0 && inputText.trim() !== debouncedQuery);

  const songs = searchResults?.songs || [];
  const artists = searchResults?.artists || [];
  const playlists = searchResults?.playlists || [];
  const userPlaylists = searchResults?.userPlaylists || [];

  const hasAnyResults =
    songs.length > 0 ||
    artists.length > 0 ||
    playlists.length > 0 ||
    userPlaylists.length > 0;

  // Determine top result
  const topResult = useMemo(() => {
    if (!hasAnyResults) return null;

    const queryToMatch = (debouncedQuery || inputText).toLowerCase().trim();
    if (!queryToMatch) return null;

    const matchingArtist = artists.find((a) =>
      a.name.toLowerCase().includes(queryToMatch)
    );

    if (matchingArtist) {
      return { kind: "ARTIST" as const, item: matchingArtist };
    }

    if (songs.length > 0) {
      return { kind: "SONG" as const, item: songs[0] };
    }

    if (artists.length > 0) {
      return { kind: "ARTIST" as const, item: artists[0] };
    }

    if (playlists.length > 0) {
      return { kind: "PLAYLIST" as const, item: playlists[0] };
    }

    if (userPlaylists.length > 0) {
      return { kind: "USER_PLAYLIST" as const, item: userPlaylists[0] };
    }

    return null;
  }, [songs, artists, playlists, userPlaylists, debouncedQuery, inputText, hasAnyResults]);

  // Handlers for item interactions
  const handleSelectSong = (song: Song) => {
    searchService.saveSearchHistory({ type: "SONG", songId: song.id });
    searchService.trackSearchPlay(song.id);
    queryClient.invalidateQueries({ queryKey: ["search-history"] });
    dispatch(playWithSimilarSongs(song));
    router.push({
      pathname: "/(authenticated)/song/[id]",
      params: { id: song.id },
    });
  };

  const handleSelectArtist = (artist: Artist) => {
    searchService.saveSearchHistory({ type: "ARTIST", artistId: artist.id });
    searchService.trackSearchClick("ARTIST", artist.id);
    queryClient.invalidateQueries({ queryKey: ["search-history"] });
    router.push({
      pathname: "/(authenticated)/artist/[id]",
      params: { id: artist.id },
    });
  };

  const handleSelectPlaylist = (playlist: Playlist) => {
    searchService.saveSearchHistory({
      type: "PLAYLIST",
      playlistId: playlist.id,
    });
    searchService.trackSearchClick("PLAYLIST", playlist.id);
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
    queryClient.invalidateQueries({ queryKey: ["search-history"] });
    router.push({
      pathname: "/(authenticated)/userplaylist/[id]",
      params: { id: uPlaylist.id },
    });
  };

  const handleSelectHistoryItem = (item: UserSearchHistoryItem) => {
    if (item.type === "SONG" && item.song) {
      handleSelectSong(item.song);
    } else if (item.type === "ARTIST" && item.artist) {
      handleSelectArtist(item.artist);
    } else if (item.type === "PLAYLIST" && item.playlist) {
      handleSelectPlaylist(item.playlist);
    } else if (item.type === "USER_PLAYLIST" && item.userPlaylist) {
      handleSelectUserPlaylist(item.userPlaylist);
    }
  };

  const handleDeleteHistoryItem = async (id: string) => {
    // Optimistic UI update
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
    await searchService.deleteSearchHistoryItem(id);
  };

  const handleClearHistory = async () => {
    // Optimistic UI update
    queryClient.setQueryData<UserSearchHistoryGrouped>(
      ["search-history"],
      (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          recent: [],
        };
      }
    );
    await searchService.clearSearchHistory();
  };

  const handleSelectGenre = (genreName: string) => {
    setInputText(genreName);
    setDebouncedQuery(genreName);
  };

  const recentSearches = historyData?.recent || [];

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      {/* Search Header */}
      <View style={styles.header}>
        <Text style={styles.screenTitle}>Search</Text>

        <View style={styles.searchBar}>
          <Ionicons
            name="search"
            size={20}
            color="#888888"
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Songs, artists, or playlists..."
            placeholderTextColor="#777777"
            value={inputText}
            onChangeText={setInputText}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {isActivelySearching ? (
            <ActivityIndicator
              size="small"
              color="#ffffff"
              style={styles.searchSpinner}
            />
          ) : null}
          {inputText.length > 0 ? (
            <TouchableOpacity
              onPress={() => {
                setInputText("");
                setDebouncedQuery("");
              }}
              style={styles.clearButton}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={19} color="#888888" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Main Content */}
      {inputText.trim().length === 0 ? (
        // Empty Search: Recent Searches & Browse Categories
        <ScrollView
          style={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          onScrollBeginDrag={Keyboard.dismiss}
          contentContainerStyle={styles.scrollInner}
        >
          {/* Recent Searches */}
          {recentSearches.length > 0 ? (
            <View style={styles.recentSection}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionHeading}>Recent Searches</Text>
                <TouchableOpacity onPress={handleClearHistory} hitSlop={10}>
                  <Text style={styles.clearAllText}>Clear all</Text>
                </TouchableOpacity>
              </View>

              {recentSearches.slice(0, 10).map((item) => (
                <SearchHistoryItem
                  key={item.id}
                  item={item}
                  onPress={() => handleSelectHistoryItem(item)}
                  onDelete={() => handleDeleteHistoryItem(item.id)}
                />
              ))}
            </View>
          ) : null}

          {/* Browse Categories & Genres */}
          <View style={styles.browseSection}>
            <Text style={styles.sectionHeading}>Browse All</Text>
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
      ) : !hasAnyResults && (isInitialLoading || isActivelySearching) ? (
        // Initial First Search Loading State (only shown when no results exist yet)
        <View style={styles.centerContainer}>
          <ActivityIndicator size="small" color="#1DB954" />
          <Text style={styles.loadingText}>Searching Melody...</Text>
        </View>
      ) : !hasAnyResults ? (
        // Empty Results State (only shown once searching has finished with 0 hits)
        <View style={styles.centerContainer}>
          <Ionicons name="search-outline" size={54} color="#444444" />
          <Text style={styles.noResultsTitle}>
            No results found for &quot;{debouncedQuery || inputText.trim()}&quot;
          </Text>
          <Text style={styles.noResultsSubtitle}>
            Please check the spelling or try searching for another song, artist,
            or genre.
          </Text>
        </View>
      ) : (
        // Active Search Results (keeps old results visible while searching in background)
        <ScrollView
          style={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          onScrollBeginDrag={Keyboard.dismiss}
          contentContainerStyle={styles.resultsInner}
        >
          {/* Top Result Card */}
          {topResult ? (
            <SearchTopResultCard
              topResult={topResult}
              onPress={() => {
                if (topResult.kind === "SONG") {
                  handleSelectSong(topResult.item);
                } else if (topResult.kind === "ARTIST") {
                  handleSelectArtist(topResult.item);
                } else if (topResult.kind === "PLAYLIST") {
                  handleSelectPlaylist(topResult.item);
                } else if (topResult.kind === "USER_PLAYLIST") {
                  handleSelectUserPlaylist(topResult.item);
                }
              }}
            />
          ) : null}

          {/* Songs Section */}
          {songs.length > 0 ? (
            <View style={styles.resultSection}>
              <View style={styles.resultHeaderRow}>
                <Text style={styles.sectionHeading}>Songs</Text>
              </View>

              {songs.map((song, idx) => (
                <SongRowItem
                  key={song.id}
                  song={song}
                  index={idx}
                  onPress={() => handleSelectSong(song)}
                />
              ))}
            </View>
          ) : null}

          {/* Artists Section */}
          {artists.length > 0 ? (
            <View style={styles.resultSection}>
              <View style={styles.resultHeaderRow}>
                <Text style={styles.sectionHeading}>Artists</Text>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalRow}
              >
                {artists.map((artist) => (
                  <ArtistCircleCard
                    key={artist.id}
                    artist={artist}
                    onPress={() => handleSelectArtist(artist)}
                  />
                ))}
              </ScrollView>
            </View>
          ) : null}

          {/* Playlists Section */}
          {playlists.length > 0 ? (
            <View style={styles.resultSection}>
              <View style={styles.resultHeaderRow}>
                <Text style={styles.sectionHeading}>Playlists</Text>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalRow}
              >
                {playlists.map((playlist) => (
                  <PlaylistCard
                    key={playlist.id}
                    playlist={playlist}
                    onPress={() => handleSelectPlaylist(playlist)}
                  />
                ))}
              </ScrollView>
            </View>
          ) : null}

          {/* User Playlists Section */}
          {userPlaylists.length > 0 ? (
            <View style={styles.resultSection}>
              <Text style={styles.sectionHeading}>User Playlists</Text>
              {userPlaylists.map((uPlaylist) => (
                <TouchableOpacity
                  key={uPlaylist.id}
                  style={styles.userPlaylistRow}
                  onPress={() => handleSelectUserPlaylist(uPlaylist)}
                  activeOpacity={0.7}
                >
                  <UserPlaylistThumbnail
                    playlist={uPlaylist}
                    size={48}
                    borderRadius={8}
                    style={{ marginRight: 14 }}
                  />
                  <View style={styles.userPlaylistInfo}>
                    <Text style={styles.userPlaylistName} numberOfLines={1}>
                      {uPlaylist.name}
                    </Text>
                    <Text
                      style={styles.userPlaylistOwner}
                      numberOfLines={1}
                    >
                      Playlist • By {uPlaylist.ownerName || "User"} •{" "}
                      {uPlaylist.totalSongs} tracks
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color="#666666"
                  />
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#121212",
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    backgroundColor: "#121212",
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 14,
    letterSpacing: -0.5,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#202020",
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    borderWidth: 1,
    borderColor: "#2E2E2E",
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    height: "100%",
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "500",
  },
  searchSpinner: {
    marginRight: 6,
  },
  clearButton: {
    padding: 4,
    marginLeft: 2,
  },
  scrollContent: {
    flex: 1,
  },
  scrollInner: {
    paddingBottom: 110,
  },
  resultsInner: {
    paddingTop: 12,
    paddingBottom: 110,
  },
  recentSection: {
    marginBottom: 26,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  sectionHeading: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -0.2,
  },
  clearAllText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#888888",
  },
  browseSection: {
    paddingHorizontal: 16,
  },
  genresGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 14,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 36,
  },
  loadingText: {
    color: "#888888",
    fontSize: 14,
    marginTop: 12,
  },
  noResultsTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
    marginTop: 16,
    textAlign: "center",
  },
  noResultsSubtitle: {
    fontSize: 14,
    color: "#777777",
    marginTop: 8,
    textAlign: "center",
    lineHeight: 20,
  },
  resultSection: {
    marginBottom: 24,
  },
  resultHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  horizontalRow: {
    paddingHorizontal: 16,
  },
  userPlaylistRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  userPlaylistIconBox: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: "rgba(32, 138, 239, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(32, 138, 239, 0.25)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  userPlaylistInfo: {
    flex: 1,
    paddingRight: 10,
  },
  userPlaylistName: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 3,
  },
  userPlaylistOwner: {
    color: "#888888",
    fontSize: 12,
  },
});
