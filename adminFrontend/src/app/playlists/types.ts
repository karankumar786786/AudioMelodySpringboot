export interface Playlist {
  id: string;
  name: string;
  description: string;
  coverImageKey: string;
  videoKey?: string;
  totalSongs: number;
}

export interface PlaylistSong {
  id: string;
  title: string;
}

export interface CreatePlaylistFormData {
  name: string;
  description: string;
  coverImage: File | null;
  videoFile: File | null;
}
