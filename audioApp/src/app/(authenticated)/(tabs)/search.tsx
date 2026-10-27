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
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
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
import {searchStyles as styles} from "@/styles/index";

// Space reserved for the tab bar + mini player so the end of the page is reachable.
const TAB_BAR_HEIGHT = 64;
const MINI_PLAYER_HEIGHT = 72;
const EXTRA_BREATHING_ROOM = 32;

export default function SearchScreen() {
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  const bottomSpace =
    TAB_BAR_HEIGHT + MINI_PLAYER_HEIGHT + EXTRA_BREATHING_ROOM + insets.bottom;

  const [inputText, setInputText] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // Debounce input by 200ms for snappy, fluid search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(inputText.trim());
    }, 200);
    return () => clearTimeout(timer);
  }, [inputText]);

  // Search history (shown when the query is empty)
  const { data: historyData } = useQuery<UserSearchHistoryGrouped>({
    queryKey: ["search-history"],
    queryFn: () => searchService.getSearchHistory(),
    staleTime: 60 * 1000,
  });

  // Search results (keepPreviousData preserves old results while typing)
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

  // Handlers
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
  };

  const recentSearches = historyData?.recent || [];

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.screenTitle}>Search</Text>

        <View style={styles.searchBar}>
          <Ionicons name="search" size={19} color="#8A8A8A" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Songs, artists, playlists"
            placeholderTextColor="#5A5A5A"
            value={inputText}
            onChangeText={setInputText}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            selectionColor="#FFFFFF"
          />
          {isActivelySearching ? (
            <ActivityIndicator size="small" color="#FFFFFF" style={styles.searchSpinner} />
          ) : null}
          {inputText.length > 0 ? (
            <TouchableOpacity
              onPress={() => {
                setInputText("");
                setDebouncedQuery("");
              }}
              style={styles.clearButton}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Clear search"
            >
              <Ionicons name="close-circle" size={19} color="#8A8A8A" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Content */}
      {inputText.trim().length === 0 ? (
        // Empty search: recent searches + browse genres
        <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={Keyboard.dismiss}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: bottomSpace }}
        >
          {recentSearches.length > 0 ? (
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Recent searches</Text>
                <TouchableOpacity onPress={handleClearHistory} hitSlop={10}>
                  <Text style={styles.linkText}>Clear all</Text>
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
      ) : !hasAnyResults && (isInitialLoading || isActivelySearching) ? (
        <View style={styles.center}>
          <ActivityIndicator size="small" color="#FFFFFF" />
        </View>
      ) : !hasAnyResults ? (
        <View style={styles.center}>
          <Ionicons name="search-outline" size={44} color="#FFFFFF" />
          <Text style={styles.noResultsTitle}>
            No results for “{debouncedQuery || inputText.trim()}”
          </Text>
          <Text style={styles.noResultsText}>
            Check the spelling or try a different song, artist or genre.
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={Keyboard.dismiss}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: bottomSpace }}
        >
          {topResult ? (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, styles.padded]}>Top result</Text>
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
            </View>
          ) : null}

          {songs.length > 0 ? (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, styles.padded]}>Songs</Text>
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

          {artists.length > 0 ? (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, styles.padded]}>Artists</Text>
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

          {playlists.length > 0 ? (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, styles.padded]}>Playlists</Text>
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

          {userPlaylists.length > 0 ? (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, styles.padded]}>User playlists</Text>
              {userPlaylists.map((uPlaylist) => (
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
