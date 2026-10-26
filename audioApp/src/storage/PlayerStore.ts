import * as SecureStore from "expo-secure-store";
import { PlayerSong } from "@/types";

const LAST_SONG_KEY = "melody_last_playing_song";
const LAST_POSITION_KEY = "melody_last_playback_position";
const LAST_QUEUE_KEY = "melody_last_queue";

export interface SavedPlaybackState {
  song: PlayerSong;
  position: number;
  queue: PlayerSong[];
  queueIndex: number;
}

function sanitizePlayerSong(song: PlayerSong): PlayerSong {
  return {
    ...song,
    queueId: song.queueId || `${song.id}_restored`,
    coverUrl: song.coverUrl || "",
    posterUrl: song.posterUrl || song.coverUrl || "",
    audioStreamUrl: song.audioStreamUrl || "",
  };
}

/**
 * Stores large strings in SecureStore safely by chunking into <= 1800-byte segments.
 * This guarantees compatibility with Android Keystore 2048-byte limits and iOS Keychain.
 */
async function setLargeItemAsync(key: string, value: string): Promise<void> {
  const chunkSize = 1800;
  if (value.length <= chunkSize) {
    await SecureStore.setItemAsync(key, value);
    // Remove chunk meta if previously chunked
    await SecureStore.deleteItemAsync(`${key}_chunks`).catch(() => {});
    return;
  }

  const chunkCount = Math.ceil(value.length / chunkSize);
  await SecureStore.setItemAsync(`${key}_chunks`, String(chunkCount));
  for (let i = 0; i < chunkCount; i++) {
    const chunk = value.slice(i * chunkSize, (i + 1) * chunkSize);
    await SecureStore.setItemAsync(`${key}_${i}`, chunk);
  }
  // Clear the direct key if transitioning to chunked
  await SecureStore.deleteItemAsync(key).catch(() => {});
}

async function getLargeItemAsync(key: string): Promise<string | null> {
  const chunkCountStr = await SecureStore.getItemAsync(`${key}_chunks`).catch(() => null);
  if (chunkCountStr) {
    const count = parseInt(chunkCountStr, 10);
    if (!isNaN(count) && count > 0) {
      let combined = "";
      for (let i = 0; i < count; i++) {
        const chunk = await SecureStore.getItemAsync(`${key}_${i}`);
        if (chunk) combined += chunk;
      }
      return combined || null;
    }
  }
  return await SecureStore.getItemAsync(key).catch(() => null);
}

async function deleteLargeItemAsync(key: string): Promise<void> {
  const chunkCountStr = await SecureStore.getItemAsync(`${key}_chunks`).catch(() => null);
  if (chunkCountStr) {
    const count = parseInt(chunkCountStr, 10);
    if (!isNaN(count)) {
      for (let i = 0; i < count; i++) {
        await SecureStore.deleteItemAsync(`${key}_${i}`).catch(() => {});
      }
    }
    await SecureStore.deleteItemAsync(`${key}_chunks`).catch(() => {});
  }
  await SecureStore.deleteItemAsync(key).catch(() => {});
}

export const PlayerStore = {
  /**
   * Persists the active playing song and current position to local storage.
   */
  async saveLastSong(song: PlayerSong, position = 0): Promise<void> {
    if (!song || !song.id) return;
    try {
      const sanitized = sanitizePlayerSong(song);
      await setLargeItemAsync(LAST_SONG_KEY, JSON.stringify(sanitized));
      if (typeof position === "number" && !isNaN(position) && position >= 0) {
        await SecureStore.setItemAsync(LAST_POSITION_KEY, String(position));
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
        await SecureStore.setItemAsync(LAST_POSITION_KEY, String(position));
      }
    } catch (err) {
      console.warn("[PlayerStore] Failed to save playback position:", err);
    }
  },

  /**
   * Persists the current queue and active index.
   */
  async saveLastQueue(queue: PlayerSong[], queueIndex = 0): Promise<void> {
    if (!queue || queue.length === 0) return;
    try {
      const sanitizedQueue = queue.slice(0, 50).map(sanitizePlayerSong);
      await setLargeItemAsync(
        LAST_QUEUE_KEY,
        JSON.stringify({ queue: sanitizedQueue, queueIndex })
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
      const songJson = await getLargeItemAsync(LAST_SONG_KEY);
      if (!songJson) return null;

      const song: PlayerSong = JSON.parse(songJson);
      if (!song || !song.id) return null;

      const posStr = await SecureStore.getItemAsync(LAST_POSITION_KEY).catch(() => null);
      const position = posStr ? parseFloat(posStr) : 0;

      const queueJson = await getLargeItemAsync(LAST_QUEUE_KEY);
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
      await Promise.all([
        deleteLargeItemAsync(LAST_SONG_KEY),
        SecureStore.deleteItemAsync(LAST_POSITION_KEY).catch(() => {}),
        deleteLargeItemAsync(LAST_QUEUE_KEY),
      ]);
    } catch (err) {
      console.warn("[PlayerStore] Failed to clear playback state:", err);
    }
  },
};
