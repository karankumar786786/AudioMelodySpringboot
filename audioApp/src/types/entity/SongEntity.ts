export interface Song {
  id: string;
  title: string;
  artistName: string;
  duration?: number;
  songKey?: string;
  audioKey?: string;
  imageKey?: string;
  videoKey?: string;
  canvasKey?: string;
  fullVideoKey?: string;
  previewStartTime?: number;
  previewEndTime?: number;
  clipStartSec?: number;
  clipEndSec?: number;
  canvasStartTime?: number;
  canvasEndTime?: number;
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
