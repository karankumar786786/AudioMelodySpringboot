export interface Playlist {
  id: string;
  name: string;
  description: string;
  coverImageKey: string;
  videoKey?: string;
  totalSongs: number;
  status?: string;
  createdAt?: string;
}

export interface PlaylistSong {
  id: string;
  title: string;
  artistName?: string;
  duration?: number;
  songKey?: string;
  imageKey?: string;
  videoKey?: string | null;
  fullVideoKey?: string | null;
  isFeatured?: boolean;
  genre?: string;
  language?: string;
  album?: string;
  lrclibId?: string | null;
  totalStreams?: number;
  status?: string;
  createdAt?: string;
}

export interface CreatePlaylistFormData {
  name: string;
  description: string;
  coverImage: File | null;
  videoFile: File | null;
}
