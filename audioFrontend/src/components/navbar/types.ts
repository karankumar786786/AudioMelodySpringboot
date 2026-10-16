import type {
  Artist,
  Playlist,
  SearchHistoryItem,
  Song,
  UserPlaylist,
} from "@/lib/api";

export interface NavbarSearchProps {
  query: string;
  setQuery: (q: string) => void;
  debouncedQuery: string;
  isFocused: boolean;
  setIsFocused: (focused: boolean) => void;
  isScrolled: boolean;
  onPlaySong: (song: Song) => void;
  onArtistClick: (artist: Artist) => void;
  onPlaylistClick: (playlist: Playlist) => void;
  onUserPlaylistClick: (playlist: UserPlaylist) => void;
}

export interface NavbarRecentSearchesProps {
  recentHistory: SearchHistoryItem[];
  isLoading: boolean;
  onRecentClick: (item: SearchHistoryItem) => void;
  onPlaySong: (song: Song) => void;
  onDeleteHistoryItem: (id: string) => void;
  onClearHistory: () => void;
  isAuthenticated: boolean;
}

export interface NavbarLiveSearchResultsProps {
  query: string;
  debouncedQuery: string;
  isSearching: boolean;
  songs: Song[];
  artists: Artist[];
  playlists: Playlist[];
  userPlaylists: UserPlaylist[];
  onPlaySong: (song: Song) => void;
  onArtistClick: (artist: Artist) => void;
  onPlaylistClick: (playlist: Playlist) => void;
  onUserPlaylistClick: (playlist: UserPlaylist) => void;
  onSavePlaylist: (id: string) => void;
  isAuthenticated: boolean;
}

export interface NavbarProfileMenuProps {
  onOpenProfileModal: () => void;
  onOpenDevicesModal: () => void;
}
