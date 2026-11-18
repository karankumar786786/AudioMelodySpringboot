import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { Query, QueryClient } from "@tanstack/react-query";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import type { PersistQueryClientOptions } from "@tanstack/react-query-persist-client";

const ONE_DAY = 24 * 60 * 60 * 1000;

/**
 * Bump this when the shape of cached API data changes, so old caches are thrown away.
 * The app version is part of the buster too, so every release starts fresh.
 */
const CACHE_SCHEMA_VERSION = "1";
const CACHE_BUSTER = `${Constants.expoConfig?.version ?? "dev"}-${CACHE_SCHEMA_VERSION}`;

const CACHE_STORAGE_KEY = "one-melody-query-cache";

/**
 * Only these query roots are written to disk. It is an allowlist on purpose: new queries
 * (sessions, favourites, playlists, search, anything auth related) stay memory-only
 * unless someone decides they are safe to persist.
 *
 * The two personalised home rows (recently played, recommendations) are included so
 * home can render instantly; the whole cache is wiped on logout.
 */
const PERSISTED_QUERY_ROOTS = new Set<string>([
  "home-recently-played",
  "home-recommendations",
  "home-trending",
  "home-featured",
  "home-artists",
  "song",
  "artist",
  "artist-songs",
  "album-songs",
  "all-albums",
  "playlist",
  "playlist-songs",
]);

function shouldPersistQuery(query: Query): boolean {
  if (query.state.status !== "success") return false;
  const root = query.queryKey[0];
  return typeof root === "string" && PERSISTED_QUERY_ROOTS.has(root);
}

function isClientError(error: unknown): boolean {
  const status = (error as any)?.response?.status;
  return typeof status === "number" && status >= 400 && status < 500;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Must be at least maxAge, or restored queries get garbage collected straight away.
      gcTime: ONE_DAY,
      // baseApi already retries GETs on network errors and 5xx, so keep this low
      // and never retry 4xx (auth, not found, validation).
      retry: (failureCount, error) => !isClientError(error) && failureCount < 1,
    },
    mutations: {
      retry: false,
    },
  },
});

export const queryPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: CACHE_STORAGE_KEY,
  throttleTime: 2000,
});

export const persistOptions: Omit<PersistQueryClientOptions, "queryClient"> = {
  persister: queryPersister,
  maxAge: ONE_DAY,
  buster: CACHE_BUSTER,
  dehydrateOptions: {
    shouldDehydrateQuery: shouldPersistQuery,
    shouldDehydrateMutation: () => false,
  },
};

/** Drops every cached query, in memory and on disk. Called on logout. */
export async function clearQueryCache(): Promise<void> {
  queryClient.cancelQueries().catch(() => {});
  queryClient.clear();
  try {
    await queryPersister.removeClient();
  } catch {}
  try {
    await AsyncStorage.removeItem(CACHE_STORAGE_KEY);
  } catch {}
}
