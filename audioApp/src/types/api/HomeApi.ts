import { Song } from "../entity/SongEntity";
import { Artist } from "../entity/ArtistEntity";
import { Playlist } from "../entity/PlaylistEntity";

export interface PaginationMetaData {
  id?: string;
  tableName?: string;
  totalCount?: number;
  activeCount?: number;
  blockedCount?: number;
  deletedCount?: number;
  updatedAt?: string;
}

export interface PaginatedResponse<T> {
  content: T[];
  page: number;
  size: number;
  paginationMetaData?: PaginationMetaData;
}

export interface HomeFeedData {
  featuredSongs: Song[];
  trendingSongs: Song[];
  topArtists: Artist[];
  featuredPlaylists: Playlist[];
  recommendations: Song[];
  discoverFeed: Song[];
}
