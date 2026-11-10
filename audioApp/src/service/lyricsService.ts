import { api } from "./baseApi";

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

export const lyricsService = {
  async getLyrics(songId: string): Promise<LyricsResponse | null> {
    if (!songId) return null;
    try {
      const response = await api.get<LyricsResponse>(`/lyrics/${encodeURIComponent(songId)}`);
      return response.data;
    } catch (e) {
      console.warn(`[lyricsService] Failed to fetch lyrics for ${songId}:`, e);
      return null;
    }
  },
};

