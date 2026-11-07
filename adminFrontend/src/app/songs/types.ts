export interface Song {
  id: string;
  title: string;
  artistName: string;
  duration: number;
  language: string;
  genre?: string;
  album?: string;
  country?: string;
  imageKey: string;
  songKey?: string;
  status?: string;
  videoKey?: string | null;
  fullVideoKey?: string | null;
  previewStartTime?: number | null;
  previewEndTime?: number | null;
  isFeatured?: boolean;
  lrclibId?: string;
  createdAt?: string;
  totalStreams?: number;
}

export interface CreateSongFormData {
  title: string;
  artistName: string;
  language: string;
  genre: string;
  album: string;
  country?: string;
  lrclibId: string;
  songFile: File | null;
  imageFile: File | null;
  videoFile: File | null;
  fullVideoFile: File | null;
  clipStartMin: string | number;
  clipStartSec: string | number;
  clipEndMin: string | number;
  clipEndSec: string | number;
  previewStartMin: string | number;
  previewStartSec: string | number;
  previewEndMin: string | number;
  previewEndSec: string | number;
}

export type UploadMode = "audio" | "videoOnly";

export interface UploadProgressStats {
  loadedText?: string;
  speedText?: string;
  fileName?: string;
}

export interface UploadErrorState {
  title?: string;
  message: string;
  isNetworkError?: boolean;
  canRetry?: boolean;
}
