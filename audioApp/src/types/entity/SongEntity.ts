export interface Song {
  id: string;
  title: string;
  artistName: string;
  duration?: number;
  songKey?: string;
  imageKey?: string;
  videoKey?: string;
  fullVideoKey?: string;
  previewStartTime?: number;
  previewEndTime?: number;
  isFeatured?: boolean;
  language?: string;
  genre?: string;
  album?: string;
  lrclibId?: string;
  status?: string;
  jobId?: string;
  totalStreams?: number;
  createdAt?: string;
}
