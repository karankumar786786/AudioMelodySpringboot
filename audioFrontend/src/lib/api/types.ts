export interface Song {
  id: string;
  title: string;
  artistName: string;
  duration: number;
  songKey: string;
  imageKey: string;
  videoKey?: string;
  fullVideoKey?: string;
  album?: string | null;
  genre?: string | null;
  language: string;
  lrclibId: string;
  status?: string;
  isFeatured?: boolean;
  previewStartTime?: number | null;
  previewEndTime?: number | null;
  totalStreams?: number;
  createdAt?: string;
}

export interface Artist {
  id: string;
  name: string;
  about?: string;
  dob?: string;
  coverImageKey?: string;
  status?: string;
  followersCount?: number;
  createdAt?: string;
}

export interface ArtistFollowStatus {
  artistId: string;
  artistName: string;
  followersCount: number;
  isFollowing: boolean;
}

export type PlaylistPrivacy = "PUBLIC" | "PRIVATE" | "SHARE_BY_LINK";

export interface UserPlaylist {
  id: string;
  name: string;
  title?: string;
  privacy: PlaylistPrivacy;
  shareToken?: string;
  ownerName?: string;
  ownerId?: string;
  userId?: string;
  totalSongs: number;
  status?: string;
  description?: string;
  coverImageKey?: string;
  videoKey?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Album {
  name: string;
  artistName: string;
  trackCount: number;
  imageKey?: string;
  genre?: string;
}

export interface Playlist {
  id: string;
  name: string;
  title?: string;
  description?: string;
  coverImageKey?: string;
  videoKey?: string;
  totalSongs: number;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface UnifiedSearchResult {
  songs: Song[];
  artists: Artist[];
  playlists: Playlist[];
  userPlaylists: UserPlaylist[];
}

export interface SearchHistoryItem {
  id: string;
  type: "SONG" | "ARTIST" | "PLAYLIST" | "USER_PLAYLIST" | string;
  song?: Song | null;
  artist?: Artist | null;
  playlist?: Playlist | null;
  userPlaylist?: UserPlaylist | null;
  createdAt?: string;
}

export interface SearchHistoryGroupedResponse {
  recent: SearchHistoryItem[];
  songs: Song[];
  artists: Artist[];
  playlists: Playlist[];
  userPlaylists: UserPlaylist[];
}

export interface SaveSearchHistoryPayload {
  type?: "SONG" | "ARTIST" | "PLAYLIST" | "USER_PLAYLIST";
  songId?: string;
  artistId?: string;
  playlistId?: string;
  userPlaylistId?: string;
}

export interface User {
  id: string;
  name?: string;
  username?: string;
  email: string;
  role?: string;
}

export interface UserSession {
  id: string;
  deviceId: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  isCurrent?: boolean;
}
