import { request } from "./client";
import type { Song } from "./types";

export const interactionsApi = {
  getTrending: async (limit = 10) => {
    const res = await request<Song[]>(`/api/songs/trending?limit=${limit}`);
    const list = Array.isArray(res) ? res : [];
    return { data: { data: list } };
  },
  getRecommendations: async () => {
    try {
      const res = await request("/api/recommendations/user");
      const list = Array.isArray(res) ? res : [];
      return { data: { data: list as Song[] } };
    } catch {
      const res = await request("/api/songs?page=0&size=10");
      const list = res.content || (Array.isArray(res) ? res : []);
      return { data: { data: list as Song[] } };
    }
  },
  getSimilarSongs: async (songId: string, count = 10) => {
    try {
      const res = await request<Song[]>(`/api/recommendations/similar/${songId}?count=${count}`);
      const list = Array.isArray(res) ? res : [];
      return { data: { data: list } };
    } catch {
      return { data: { data: [] } };
    }
  },
  getRadioSongs: async (seedSongId: string, excludeIds: string[] = [], count = 10) => {
    try {
      const excludeParam =
        excludeIds.length > 0
          ? `&excludeIds=${encodeURIComponent(excludeIds.join(","))}`
          : "";
      const res = await request<Song[]>(
        `/api/recommendations/radio?seedSongId=${encodeURIComponent(seedSongId)}&count=${count}${excludeParam}`
      );
      const list = Array.isArray(res) ? res : [];
      return { data: { data: list } };
    } catch (err) {
      console.warn("[API] getRadioSongs failed, falling back to getSimilarSongs", err);
      return interactionsApi.getSimilarSongs(seedSongId, count);
    }
  },
  recordListen: async (songId: string, percentage = 0.05) => {
    if (!songId) return;
    try {
      const safePercentage = Math.min(1.0, Math.max(0.0, isNaN(percentage) ? 0.05 : percentage));
      await request("/api/interaction/play", {
        method: "POST",
        body: JSON.stringify({ songId, percentage: safePercentage }),
        keepalive: true,
      });
    } catch (err) {
      console.warn("[Interaction] recordListen failed:", err);
    }
  },
  recordSkip: async (songId: string) => {
    try {
      await request("/api/interaction/skip", {
        method: "POST",
        body: JSON.stringify({ songId }),
        keepalive: true,
      });
    } catch {
      // Silently catch background telemetry drops
    }
  },
  recordSearchPlay: async (songId: string, query?: string) => {
    try {
      await request("/api/interaction/search-play", {
        method: "POST",
        body: JSON.stringify({ songId, query: query || undefined }),
        keepalive: true,
      });
    } catch {
      // Silently catch background telemetry drops
    }
  },
  recordSearchClick: async (
    type: "SONG" | "ARTIST" | "PLAYLIST",
    id: string,
    query?: string,
  ) => {
    try {
      await request("/api/interaction/search-click", {
        method: "POST",
        body: JSON.stringify({ type, id, query: query || undefined }),
        keepalive: true,
      });
    } catch {
      // Silently catch background telemetry drops
    }
  },
  recordQueueAdd: async (songId: string) => {
    try {
      await request("/api/interaction/queue-add", {
        method: "POST",
        body: JSON.stringify({ songId }),
        keepalive: true,
      });
    } catch {
      // Silently catch background telemetry drops
    }
  },
  recordQueueRemove: async (songId: string) => {
    try {
      await request("/api/interaction/queue-remove", {
        method: "POST",
        body: JSON.stringify({ songId }),
        keepalive: true,
      });
    } catch {
      // Silently catch background telemetry drops
    }
  },
  recordDislike: async (songId: string) => {
    try {
      await request("/api/interaction/dislike", {
        method: "POST",
        body: JSON.stringify({ songId }),
        keepalive: true,
      });
    } catch {
      // Silently catch background telemetry drops
    }
  },
  recordShare: async (songId: string) => {
    try {
      await request("/api/interaction/share", {
        method: "POST",
        body: JSON.stringify({ songId }),
        keepalive: true,
      });
    } catch {
      // Silently catch background telemetry drops
    }
  },
};
