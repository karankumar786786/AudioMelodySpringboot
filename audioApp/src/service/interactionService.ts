import { api } from "./baseApi";
import { store } from "@/store/hook";

/**
 * Interaction Telemetry Service
 *
 * Mirrors the backend InteractionApiController endpoints for mobile telemetry.
 * All methods are fire-and-forget — errors are silently caught so telemetry
 * never blocks or crashes playback.
 *
 * Backend endpoints (Spring Boot):
 *   POST /api/interaction/play          — records a listen with percentage
 *   POST /api/interaction/skip          — records a skip event
 *   POST /api/interaction/search-play   — records a play originating from search
 *   POST /api/interaction/search-click  — records a click on a search result
 *   POST /api/interaction/queue-add     — records a song added to queue
 *   POST /api/interaction/queue-remove  — records a song removed from queue
 *   POST /api/interaction/dislike       — records a dislike
 *   POST /api/interaction/share         — records a share
 */
export const interactionService = {
  /**
   * Records a play event with the listen completion percentage.
   * @param songId  — ID of the song that was played
   * @param percentage — 0.0 to 1.0 representing how much of the track was listened to
   */
  async recordPlay(songId: string, percentage: number): Promise<void> {
    if (!songId) return;
    try {
      const safePercentage = Math.min(1.0, Math.max(0.0, isNaN(percentage) ? 0.05 : percentage));
      await api.post("/interaction/play", { songId, percentage: safePercentage });
    } catch {
      // Silently catch — telemetry should never block playback
    }
  },

  /**
   * Records a skip event (user manually skipped a track).
   * @param songId — ID of the song that was skipped
   */
  async recordSkip(songId: string): Promise<void> {
    if (!songId) return;
    try {
      await api.post("/interaction/skip", { songId });
    } catch {
      // Silently catch
    }
  },

  /**
   * Records a play event that originated from a search result.
   * @param songId — ID of the song played from search
   */
  async recordSearchPlay(songId: string): Promise<void> {
    if (!songId) return;
    try {
      await api.post("/interaction/search-play", { songId });
    } catch {
      // Silently catch
    }
  },

  /**
   * Records a click on a search result (song, artist, or playlist).
   * @param type — "SONG" | "ARTIST" | "PLAYLIST"
   * @param id   — ID of the clicked entity
   */
  async recordSearchClick(type: "SONG" | "ARTIST" | "PLAYLIST", id: string): Promise<void> {
    if (!id) return;
    try {
      await api.post("/interaction/search-click", { type, id });
    } catch {
      // Silently catch
    }
  },

  /**
   * Records a song being added to the playback queue.
   * @param songId — ID of the song added
   */
  async recordQueueAdd(songId: string): Promise<void> {
    if (!songId) return;
    try {
      await api.post("/interaction/queue-add", { songId });
    } catch {
      // Silently catch
    }
  },

  /**
   * Records a song being removed from the playback queue.
   * @param songId — ID of the song removed
   */
  async recordQueueRemove(songId: string): Promise<void> {
    if (!songId) return;
    try {
      await api.post("/interaction/queue-remove", { songId });
    } catch {
      // Silently catch
    }
  },

  /**
   * Records a dislike event for a song.
   * @param songId — ID of the disliked song
   */
  async recordDislike(songId: string): Promise<void> {
    if (!songId) return;
    try {
      await api.post("/interaction/dislike", { songId });
    } catch {
      // Silently catch
    }
  },

  /**
   * Records a share event for a song.
   * @param songId — ID of the shared song
   */
  async recordShare(songId: string): Promise<void> {
    if (!songId) return;
    try {
      await api.post("/interaction/share", { songId });
    } catch {
      // Silently catch
    }
  },
};
