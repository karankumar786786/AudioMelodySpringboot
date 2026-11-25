/**
 * Query key factory. Every key starts with its domain so a mutation can invalidate or
 * patch a whole domain (`queryKeys.songs.all`). New domains (analytics, audit log,
 * pipeline monitor) add an entry here.
 */
type Params = Record<string, unknown>;

export const queryKeys = {
  dashboard: {
    all: ["dashboard"] as const,
    stats: () => ["dashboard", "stats"] as const,
  },
  songs: {
    all: ["songs"] as const,
    lists: () => ["songs", "list"] as const,
    list: (params: Params) => ["songs", "list", params] as const,
    detail: (id: string) => ["songs", "detail", id] as const,
  },
  artists: {
    all: ["artists"] as const,
    lists: () => ["artists", "list"] as const,
    list: (params: Params) => ["artists", "list", params] as const,
    detail: (id: string) => ["artists", "detail", id] as const,
    songs: (id: string, params: Params) =>
      ["artists", "songs", id, params] as const,
  },
  playlists: {
    all: ["playlists"] as const,
    lists: () => ["playlists", "list"] as const,
    list: (params: Params) => ["playlists", "list", params] as const,
    detail: (id: string) => ["playlists", "detail", id] as const,
    songs: (id: string) => ["playlists", "songs", id] as const,
  },
  users: {
    all: ["users"] as const,
    lists: () => ["users", "list"] as const,
    list: (params: Params) => ["users", "list", params] as const,
    sessions: (email: string) => ["users", "sessions", email] as const,
  },
  jobs: {
    all: ["jobs"] as const,
    ingestion: {
      all: ["jobs", "ingestion"] as const,
      summary: () => ["jobs", "ingestion", "summary"] as const,
      active: () => ["jobs", "ingestion", "active"] as const,
      lists: () => ["jobs", "ingestion", "list"] as const,
      list: (params: Params) => ["jobs", "ingestion", "list", params] as const,
    },
    deletion: {
      all: ["jobs", "deletion"] as const,
      summary: () => ["jobs", "deletion", "summary"] as const,
      active: () => ["jobs", "deletion", "active"] as const,
      lists: () => ["jobs", "deletion", "list"] as const,
      list: (params: Params) => ["jobs", "deletion", "list", params] as const,
    },
  },
  shorts: {
    all: ["shorts"] as const,
    lists: () => ["shorts", "list"] as const,
    list: (params: Params) => ["shorts", "list", params] as const,
    reports: (params: Params) => ["shorts", "reports", params] as const,
  },
  catalogHealth: {
    all: ["catalog-health"] as const,
    list: (params: Params) => ["catalog-health", "list", params] as const,
  },
  search: {
    global: (q: string) => ["search", q] as const,
  },
  analytics: {
    all: ["analytics"] as const,
    song: (id: string, range: string) =>
      ["analytics", "song", id, range] as const,
    overview: (range: string) => ["analytics", "overview", range] as const,
  },
} as const;
