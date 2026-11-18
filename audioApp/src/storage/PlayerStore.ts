import AsyncStorage from "@react-native-async-storage/async-storage";
import { Song, PlayerSong } from "@/types";

const LAST_SONG_KEY = "melody_last_playing_song";
const LAST_POSITION_KEY = "melody_last_playback_position";
const LAST_QUEUE_KEY = "melody_last_queue";
// Device preference: deliberately not removed by clear() (which runs with the saved session).
const CROSSFADE_SECONDS_KEY = "melody_crossfade_seconds";

export interface SavedPlaybackState {
  song: Song | PlayerSong;
  position: number;
  queue: Song[];
  queueIndex: number;
}

export const PlayerStore = {
  /**
   * Persists the active playing song and current position to local storage.
   */
  async saveLastSong(song: Song | PlayerSong, position = 0): Promise<void> {
    if (!song || !song.id) return;
    try {
      await AsyncStorage.setItem(LAST_SONG_KEY, JSON.stringify(song));
      if (typeof position === "number" && !isNaN(position) && position >= 0) {
        await AsyncStorage.setItem(LAST_POSITION_KEY, String(position));
      }
    } catch (err) {
      console.warn("[PlayerStore] Failed to save last playing song:", err);
    }
  },

  /**
   * Persists updated playback position.
   */
  async savePlaybackPosition(position: number): Promise<void> {
    try {
      if (typeof position === "number" && !isNaN(position) && position >= 0) {
        await AsyncStorage.setItem(LAST_POSITION_KEY, String(position));
      }
    } catch (err) {
      console.warn("[PlayerStore] Failed to save playback position:", err);
    }
  },

  /**
   * Persists the current queue and active index.
   */
  async saveLastQueue(queue: Song[], queueIndex = 0): Promise<void> {
    if (!queue || queue.length === 0) return;
    try {
      const trimmedQueue = queue.slice(0, 50);
      await AsyncStorage.setItem(
        LAST_QUEUE_KEY,
        JSON.stringify({ queue: trimmedQueue, queueIndex })
      );
    } catch (err) {
      console.warn("[PlayerStore] Failed to save last queue:", err);
    }
  },

  /**
   * Retrieves the previously stored song, position, and queue.
   */
  async getLastPlaybackState(): Promise<SavedPlaybackState | null> {
    try {
      const songJson = await AsyncStorage.getItem(LAST_SONG_KEY);
      if (!songJson) return null;

      const song: Song = JSON.parse(songJson);
      if (!song || !song.id) return null;

      const posStr = await AsyncStorage.getItem(LAST_POSITION_KEY);
      const position = posStr ? parseFloat(posStr) : 0;

      const queueJson = await AsyncStorage.getItem(LAST_QUEUE_KEY);
      const queueData = queueJson ? JSON.parse(queueJson) : null;

      return {
        song,
        position: typeof position === "number" && !isNaN(position) ? position : 0,
        queue:
          Array.isArray(queueData?.queue) && queueData.queue.length > 0
            ? queueData.queue
            : [song],
        queueIndex:
          typeof queueData?.queueIndex === "number" ? queueData.queueIndex : 0,
      };
    } catch (err) {
      console.warn("[PlayerStore] Failed to load last playback state:", err);
      return null;
    }
  },

  /**
   * Persists the crossfade length in seconds (0 = off).
   */
  async saveCrossfadeSeconds(seconds: number): Promise<void> {
    try {
      await AsyncStorage.setItem(CROSSFADE_SECONDS_KEY, String(seconds));
    } catch (err) {
      console.warn("[PlayerStore] Failed to save crossfade setting:", err);
    }
  },

  /**
   * Reads the saved crossfade length in seconds, or null if never set.
   */
  async getCrossfadeSeconds(): Promise<number | null> {
    try {
      const raw = await AsyncStorage.getItem(CROSSFADE_SECONDS_KEY);
      if (raw === null) return null;
      const n = parseFloat(raw);
      return Number.isFinite(n) ? n : null;
    } catch (err) {
      console.warn("[PlayerStore] Failed to load crossfade setting:", err);
      return null;
    }
  },

  /**
   * Clears saved playback state.
   */
  async clear(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        LAST_SONG_KEY,
        LAST_POSITION_KEY,
        LAST_QUEUE_KEY,
      ]);
    } catch (err) {
      console.warn("[PlayerStore] Failed to clear playback state:", err);
    }
  },
};
