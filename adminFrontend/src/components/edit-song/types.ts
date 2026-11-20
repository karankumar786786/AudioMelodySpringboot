export interface SongData {
  id: string;
  title: string;
  artistName: string;
  duration?: number;
  language?: string;
  album?: string;
  genre?: string;
  country?: string;
  imageKey?: string;
  videoKey?: string | null;
  fullVideoKey?: string | null;
  previewStartTime?: number | null;
  previewEndTime?: number | null;
  isFeatured?: boolean;
  lrclibId?: string;
  createdAt?: string;
  totalStreams?: number;
}

export interface SaveError {
  title?: string;
  message: string;
  isNetworkError?: boolean;
  canRetry?: boolean;
}
