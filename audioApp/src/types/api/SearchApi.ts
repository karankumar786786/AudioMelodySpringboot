import { Song, Artist, Playlist } from "@/types";
import { UserPlaylist } from "../entity/UserPlaylistEntity";

export interface SearchResult {
  songs: Song[];
  artists: Artist[];
  playlists: Playlist[];
  userPlaylists: UserPlaylist[];
}

export type SearchHistoryType = "SONG" | "ARTIST" | "PLAYLIST" | "USER_PLAYLIST";

export interface UserSearchHistoryItem {
  id: string;
  type: SearchHistoryType;
  song?: Song | null;
  artist?: Artist | null;
  playlist?: Playlist | null;
  userPlaylist?: UserPlaylist | null;
  createdAt: string;
}

export interface UserSearchHistoryGrouped {
  recent: UserSearchHistoryItem[];
  songs: Song[];
  artists: Artist[];
  playlists: Playlist[];
  userPlaylists: UserPlaylist[];
}

export interface SaveSearchHistoryRequest {
  type: SearchHistoryType;
  songId?: string;
  artistId?: string;
  playlistId?: string;
  userPlaylistId?: string;
}

export interface TrackSearchClickRequest {
  type: SearchHistoryType;
  id: string;
}

export interface TrackSearchPlayRequest {
  songId: string;
}
