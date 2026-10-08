/**
 * IndexedDB Audio Chunk & Segment Cache with LRU Eviction Limits
 * Caches HLS audio chunks (.ts/.m4s/segments) locally for instant, zero-latency playback.
 */

const DB_NAME = "AudioMelodyAudioCache";
const DB_VERSION = 1;
const STORE_NAME = "audio_segments";

// Maximum storage limits
export const MAX_CACHE_BYTES = 80 * 1024 * 1024; // 80 MB
export const MAX_CACHE_SEGMENTS = 250; // Max 250 audio segments

interface AudioSegmentRecord {
  url: string;
  data: ArrayBuffer;
  size: number;
  timestamp: number;
  songId?: string;
}

class AudioCache {
  private dbPromise: Promise<IDBDatabase | null> | null = null;
  // Hot in-memory chunk cache for currently playing song chunks
  private hotMemoryCache: Map<string, ArrayBuffer> = new Map();
  private maxHotMemoryItems = 12;

  private isAvailable(): boolean {
    return typeof window !== "undefined" && typeof indexedDB !== "undefined";
  }

  private async getDB(): Promise<IDBDatabase | null> {
    if (!this.isAvailable()) return null;
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise<IDBDatabase | null>((resolve) => {
      try {
        const req = indexedDB.open(DB_NAME, DB_VERSION);

        req.onupgradeneeded = (e) => {
          const db = (e.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            const store = db.createObjectStore(STORE_NAME, { keyPath: "url" });
            store.createIndex("timestamp", "timestamp", { unique: false });
          }
        };

        req.onsuccess = () => resolve(req.result);
        req.onerror = () => {
          console.warn("[AudioCache] Failed to open IndexedDB:", req.error);
          resolve(null);
        };
        req.onblocked = () => {
          console.warn("[AudioCache] IndexedDB open blocked");
          resolve(null);
        };
      } catch (err) {
        console.warn("[AudioCache] IndexedDB initialization error:", err);
        resolve(null);
      }
    });

    return this.dbPromise;
  }

  /**
   * Retrieves an audio chunk by URL.
   * Checks hot memory cache first, then IndexedDB.
   * Touches timestamp for LRU ordering.
   */
  public async getSegment(url: string): Promise<ArrayBuffer | null> {
    if (!url) return null;

    // 1. Hot in-memory cache hit (0ms)
    if (this.hotMemoryCache.has(url)) {
      return this.hotMemoryCache.get(url)!;
    }

    const db = await this.getDB();
    if (!db) return null;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(url);

        req.onsuccess = () => {
          const record = req.result as AudioSegmentRecord | undefined;
          if (record && record.data) {
            // Put in hot memory cache
            this.setHotMemory(url, record.data);
            // Async touch timestamp in IndexedDB for LRU
            this.touchSegment(url).catch(() => {});
            resolve(record.data);
          } else {
            resolve(null);
          }
        };

        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  /**
   * Saves an audio chunk into IndexedDB and hot memory.
   * Automatically performs LRU eviction if size or count limits are exceeded.
   */
  public async putSegment(
    url: string,
    data: ArrayBuffer,
    songId?: string,
  ): Promise<void> {
    if (!url || !data) return;

    // Save to hot memory
    this.setHotMemory(url, data);

    const db = await this.getDB();
    if (!db) return;

    const size = data.byteLength;
    const record: AudioSegmentRecord = {
      url,
      data,
      size,
      timestamp: Date.now(),
      songId,
    };

    try {
      // Check cache eviction before adding
      await this.enforceEvictionLimits(db, size);

      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.put(record);
    } catch (err) {
      console.warn("[AudioCache] Failed to store segment:", err);
    }
  }

  private setHotMemory(url: string, data: ArrayBuffer) {
    if (this.hotMemoryCache.size >= this.maxHotMemoryItems) {
      const firstKey = this.hotMemoryCache.keys().next().value;
      if (firstKey) this.hotMemoryCache.delete(firstKey);
    }
    this.hotMemoryCache.set(url, data);
  }

  private async touchSegment(url: string): Promise<void> {
    const db = await this.getDB();
    if (!db) return;

    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(url);

      req.onsuccess = () => {
        const record = req.result as AudioSegmentRecord | undefined;
        if (record) {
          record.timestamp = Date.now();
          store.put(record);
        }
      };
    } catch {}
  }

  /**
   * Enforces LRU size and item count limits.
   * Evicts the oldest segments when capacity is near threshold.
   */
  private async enforceEvictionLimits(
    db: IDBDatabase,
    incomingBytes: number,
  ): Promise<void> {
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const index = store.index("timestamp");

        let totalSize = 0;
        let count = 0;
        const recordsToEvict: string[] = [];

        // Open cursor sorted by timestamp (oldest first)
        const cursorReq = index.openCursor();

        cursorReq.onsuccess = (e) => {
          const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
          if (cursor) {
            count++;
            totalSize += cursor.value.size || 0;

            // If exceeding max segments or max bytes, mark oldest for eviction
            if (
              count > MAX_CACHE_SEGMENTS - 20 ||
              totalSize + incomingBytes > MAX_CACHE_BYTES * 0.85
            ) {
              recordsToEvict.push(cursor.value.url);
            }

            cursor.continue();
          } else {
            // Delete marked records
            if (recordsToEvict.length > 0) {
              recordsToEvict.forEach((url) => {
                store.delete(url);
                this.hotMemoryCache.delete(url);
              });
            }
            resolve();
          }
        };

        cursorReq.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  /**
   * Completely clears the IndexedDB audio cache and in-memory cache.
   */
  public async clearCache(): Promise<void> {
    this.hotMemoryCache.clear();
    const db = await this.getDB();
    if (!db) return;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const req = store.clear();

        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  /**
   * Get current cache stats (item count and total bytes used).
   */
  public async getCacheStats(): Promise<{
    count: number;
    totalSizeBytes: number;
    maxBytes: number;
  }> {
    const db = await this.getDB();
    if (!db) {
      return { count: 0, totalSizeBytes: 0, maxBytes: MAX_CACHE_BYTES };
    }

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        let totalSize = 0;
        let count = 0;

        const cursorReq = store.openCursor();
        cursorReq.onsuccess = (e) => {
          const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
          if (cursor) {
            count++;
            totalSize += cursor.value.size || 0;
            cursor.continue();
          } else {
            resolve({
              count,
              totalSizeBytes: totalSize,
              maxBytes: MAX_CACHE_BYTES,
            });
          }
        };
        cursorReq.onerror = () =>
          resolve({ count: 0, totalSizeBytes: 0, maxBytes: MAX_CACHE_BYTES });
      } catch {
        resolve({ count: 0, totalSizeBytes: 0, maxBytes: MAX_CACHE_BYTES });
      }
    });
  }
}

export const audioCache = new AudioCache();
