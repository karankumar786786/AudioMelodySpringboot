import { request } from "./client";

export interface LyricsResponse {
  songId: string;
  lrclibId?: string;
  trackName?: string;
  artistName?: string;
  duration?: number;
  instrumental?: boolean;
  plainLyrics?: string;
  syncedLyrics?: string;
}

export const lyricsApi = {
  getLyrics: async (songId: string): Promise<LyricsResponse | null> => {
    if (!songId) return null;
    try {
      const res = await request<LyricsResponse>(`/api/lyrics/${encodeURIComponent(songId)}`);
      return res;
    } catch {
      return null;
    }
  },
};
