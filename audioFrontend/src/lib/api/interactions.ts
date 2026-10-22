import { request } from "./client";
import type { Song } from "./types";

export const interactionsApi = {
  getTrending: async (limit = 10) => {
    const res = await request<Song[]>(`/api/songs/trending?limit=${limit}`);
    const list = Array.isArray(res) ? res : [];
    return { data: { data: list } };
  },
  getRecommendations: async (count = 10) => {
    // 1. Direct query to backend Spring Boot recommendation engine (hydrated directly from DB)
    try {
      const res = await request<Song[]>(`/api/recommendations/user?count=${count}`);
      const list = Array.isArray(res) ? res : [];
      if (list.length > 0) {
        return { data: { data: list } };
      }
    } catch (err) {
      console.warn("[InteractionsApi] Backend /api/recommendations/user failed:", err);
    }

    // 2. Direct fallback: Backend trending / catalog songs
    try {
      const res = await request<Song[]>(`/api/songs/trending?limit=${count}`);
      const list = Array.isArray(res) ? res : [];
      if (list.length > 0) {
        return { data: { data: list } };
      }
    } catch {}

    try {
      const res = await request(`/api/songs?page=0&size=${count}`);
      const list = res.content || (Array.isArray(res) ? res : []);
      return { data: { data: list as Song[] } };
    } catch {
      return { data: { data: [] } };
    }
  },
  getSimilarSongs: async (songId: string, count = 10) => {
    // 1. Direct query to backend Spring Boot item similarity endpoint (hydrated directly from DB)
    try {
      const res = await request<Song[]>(
        `/api/recommendations/similar/${songId}?count=${count}`,
      );
      const list = Array.isArray(res) ? res : [];
      if (list.length > 0) {
        return { data: { data: list } };
      }
    } catch (err) {
      console.warn(`[InteractionsApi] Backend /api/recommendations/similar/${songId} failed:`, err);
    }

    // 2. Direct fallback: Trending / catalog songs from backend
    try {
      const res = await request<Song[]>(`/api/songs/trending?limit=${count}`);
      const list = Array.isArray(res) ? res : [];
      return { data: { data: list } };
    } catch {
      return { data: { data: [] } };
    }
  },
  getRadioSongs: async (
    seedSongId: string,
    excludeIds: string[] = [],
    count = 10,
  ) => {
    // 1. Direct query to backend Spring Boot radio endpoint (hydrated directly from DB with exclusions)
    try {
      const excludeParam =
        excludeIds.length > 0
          ? `&excludeIds=${encodeURIComponent(excludeIds.join(","))}`
          : "";
      const res = await request<Song[]>(
        `/api/recommendations/radio?seedSongId=${encodeURIComponent(seedSongId)}&count=${count}${excludeParam}`,
      );
      const list = Array.isArray(res) ? res : [];
      if (list.length > 0) {
        return { data: { data: list } };
      }
    } catch (err) {
      console.warn(`[InteractionsApi] Backend /api/recommendations/radio failed for ${seedSongId}:`, err);
    }

    // 2. Direct fallback: Backend similar songs
    return interactionsApi.getSimilarSongs(seedSongId, count);
  },
  recordListen: async (songId: string, percentage = 0.05) => {
    if (!songId) return;

    try {
      const { playerStore } = await import("@/store/player.store");
      const userId = playerStore.state.systemUser?.id;
      if (!userId) return;

      // Recombee telemetry is handled server-side by TelemetryEventListener (AFTER_COMMIT)
      // with accurate percentage-based rating scale — no frontend duplicate needed.

      const safePercentage = Math.min(
        1.0,
        Math.max(0.0, isNaN(percentage) ? 0.05 : percentage),
      );
      await request("/api/interaction/play", {
        method: "POST",
        body: JSON.stringify({ songId, percentage: safePercentage }),
        keepalive: true,
      });
    } catch {
      // Silently catch background telemetry drops
    }
  },
  recordSkip: async (songId: string) => {
    try {
      const { playerStore } = await import("@/store/player.store");
      const userId = playerStore.state.systemUser?.id;
      if (!userId) return;

      // Recombee skip telemetry is handled server-side by InteractionApiService.trackSkip

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
      const { playerStore } = await import("@/store/player.store");
      if (!playerStore.state.systemUser?.id) return;

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
      const { playerStore } = await import("@/store/player.store");
      if (!playerStore.state.systemUser?.id) return;

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
      const { playerStore } = await import("@/store/player.store");
      if (!playerStore.state.systemUser?.id) return;

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
      const { playerStore } = await import("@/store/player.store");
      if (!playerStore.state.systemUser?.id) return;

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
      const { playerStore } = await import("@/store/player.store");
      if (!playerStore.state.systemUser?.id) return;

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
      const { playerStore } = await import("@/store/player.store");
      if (!playerStore.state.systemUser?.id) return;

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
