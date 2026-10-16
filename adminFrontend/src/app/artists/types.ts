export interface Artist {
  id: string;
  name: string;
  about: string;
  dob?: string;
  coverImageKey: string;
  status?: string;
}

export interface CreateArtistFormData {
  name: string;
  about: string;
  dob: string;
  coverImage: File | null;
}

export interface ArtistUploadStats {
  loadedText?: string;
  speedText?: string;
}

export interface UploadErrorState {
  title?: string;
  message: string;
  isNetworkError?: boolean;
  canRetry?: boolean;
}
