export const queryKeys = {
  songs: {
    all: ["songs"] as const,
    trending: (limit = 10) => ["songs", "trending", limit] as const,
    featured: () => ["songs", "featured"] as const,
    detail: (id: string) => ["songs", "detail", id] as const,
    album: (albumName: string) => ["songs", "album", albumName] as const,
    albums: () => ["songs", "albums"] as const,
  },
  playlists: {
    all: ["playlists"] as const,
    curated: (page = 1, size = 30) =>
      ["playlists", "curated", page, size] as const,
    userPlaylists: () => ["playlists", "user"] as const,
    detail: (id: string) => ["playlists", "detail", id] as const,
    songs: (id: string, page = 0, size = 20) =>
      ["playlists", "songs", id, page, size] as const,
    shared: (token: string) => ["playlists", "shared", token] as const,
    sharedSongs: (token: string, page = 0, size = 50) =>
      ["playlists", "sharedSongs", token, page, size] as const,
    isSaved: (id: string) => ["playlists", "isSaved", id] as const,
  },
  artists: {
    all: ["artists"] as const,
    list: (page = 0, size = 20) => ["artists", "list", page, size] as const,
    detail: (id: string) => ["artists", "detail", id] as const,
    songs: (id: string, page = 0, size = 20) =>
      ["artists", "songs", id, page, size] as const,
    followStatus: (id: string) => ["artists", "followStatus", id] as const,
    onboarding: () => ["artists", "onboarding"] as const,
  },
  user: {
    profile: () => ["user", "profile"] as const,
    sessions: () => ["user", "sessions"] as const,
    sessionStatus: () => ["user", "session-status"] as const,
    history: (page = 0, size = 20) => ["user", "history", page, size] as const,
    recentHistory: () => ["user", "history", "recent"] as const,
    searchHistory: () => ["user", "history", "search"] as const,
    favourites: () => ["user", "favourites"] as const,
  },
  search: {
    all: ["search"] as const,
    unified: (query: string) => ["search", "unified", query] as const,
  },
  recommendations: {
    user: (count = 10) => ["recommendations", "user", count] as const,
    similar: (songId: string, count = 10) =>
      ["recommendations", "similar", songId, count] as const,
    radio: (seedSongId: string, count = 10) =>
      ["recommendations", "radio", seedSongId, count] as const,
  },
};
