export interface Playlist {
  id: string;
  name: string;
  description?: string;
  coverImageKey?: string;
  videoKey?: string;
  totalSongs: number;
  createdAt?: string;
  updatedAt?: string;
}
