import { Song } from "./entity/SongEntity";

export type RepeatMode = "none" | "one" | "all";

export type PlaybackMode = "audio" | "canvas" | "fullVideo";

export interface PlayerSong extends Song {
  queueId: string; // Unique instance ID for this specific entry in the playback queue
  audioStreamUrl: string; // S3 HLS audio manifest: {S3_BASE_URL}/{songKey}/master.m3u8
  videoStreamUrl?: string; // S3 HLS full video manifest: {S3_BASE_URL}/{fullVideoKey}/master.m3u8
  coverUrl: string; // Transformed ImageKit URL (e.g. 400x400)
  posterUrl: string; // Transformed ImageKit URL (e.g. 720x720)
  canvasVideoUrl?: string; // ImageKit CDN URL for looping preview video snippet
}

export interface RadioSession {
  seedSongId: string | null;
  seedTitle?: string;
  isActive: boolean;
  sessionHistoryIds: string[];
  skippedSongIds: string[];
}

export interface QueueState {
  queue: PlayerSong[];
  originalQueue: PlayerSong[]; // Preserves original un-shuffled sequence
  lastQueueIndex: number;
  repeatMode: RepeatMode;
  isShuffle: boolean;
  dislikedSongIds: string[];
  isRefilling: boolean;
  radioSession: RadioSession;
}

export type VideoQuality = "auto" | "1080p" | "720p" | "480p" | "360p";
export type AudioQuality = "auto" | "lossless" | "high" | "standard";

export interface PlayerState {
  currentSong: PlayerSong | null;
  isPlaying: boolean;      
  isLoading: boolean;
  currentTime: number; // In seconds
  duration: number; // In seconds
  bufferedTime: number; // In seconds
  seekTarget: number | null;
  volume: number; // 0.0 to 1.0
  isMuted: boolean;
  playbackRate: number; // default: 1 (1x)
  selectedQuality: VideoQuality; // default: "auto"
  audioQuality: AudioQuality; // default: "auto"
  sleepTimer: number | null; // in minutes, null = off
  dominantColor: string;
  playbackMode: PlaybackMode;
}

