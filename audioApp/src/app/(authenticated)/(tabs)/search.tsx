import  { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
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
import { playWithSimilarSongs, AppDispatch } from "@/store";
import { searchService, albumService } from "@/service";
import {
  Song,
  Artist,
  Playlist,
  UserPlaylist,
  UserSearchHistoryItem,
  UserSearchHistoryGrouped,
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
} from "@/components";
import { hapticFeedback } from "@/utils/haptics";
import { searchStyles as styles } from "@/styles";

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

    // 1. Matches from allAlbums
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

    // 2. Matches from search songs
    for (const song of songs) {
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
  }, [allAlbums, songs, debouncedQuery, inputText]);

  const hasAnyResults =
    songs.length > 0 ||
    matchingAlbums.length > 0 ||
    playlists.length > 0 ||
    userPlaylists.length > 0 ||
    artists.length > 0;

  // Handlers
  const handleSelectSong = (song: Song) => {
    searchService.saveSearchHistory({ type: "SONG", songId: song.id });
    searchService.trackSearchPlay(song.id);
    queryClient.invalidateQueries({ queryKey: ["search-history"] });
    dispatch(playWithSimilarSongs(song, songs));
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
      params: { id: artist.id, name: artist.name },
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
          {/* 1. Artists */}
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

          {/* 2. Songs */}
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

          {/* 5. User Playlists */}
          {userPlaylists.length > 0 ? (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, styles.padded]}>Community Playlists</Text>
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
