"use client";

import { useMemo, useState } from "react";
import type { PlaylistSong } from "@/app/playlists/types";

export type TrackFilter = "ALL" | "FEATURED" | "CANVAS" | "FULL_VIDEO" | "LYRICS";

const MATCHES: Record<TrackFilter, (s: PlaylistSong) => boolean> = {
  ALL: () => true,
  FEATURED: (s) => Boolean(s.isFeatured),
  CANVAS: (s) => Boolean(s.videoKey),
  FULL_VIDEO: (s) => Boolean(s.fullVideoKey),
  LYRICS: (s) => Boolean(s.lrclibId),
};

/** Search and quick filters over a playlist's tracks, which are all loaded at once. */
export function usePlaylistTrackFilter(songs: PlaylistSong[]) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<TrackFilter>("ALL");

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return songs.filter(
      (s) =>
        MATCHES[filter](s) &&
        (!q ||
          s.title.toLowerCase().includes(q) ||
          s.artistName?.toLowerCase().includes(q) ||
          s.genre?.toLowerCase().includes(q) ||
          s.album?.toLowerCase().includes(q)),
    );
  }, [songs, search, filter]);

  return { search, setSearch, filter, setFilter, filtered };
}
