import AsyncStorage from "@react-native-async-storage/async-storage";
import { Song, PlayerSong } from "@/types";

const LAST_SONG_KEY = "melody_last_playing_song";
const LAST_POSITION_KEY = "melody_last_playback_position";
const LAST_QUEUE_KEY = "melody_last_queue";

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
