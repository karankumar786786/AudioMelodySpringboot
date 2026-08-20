"use client";

import { useQuery } from "@tanstack/react-query";
import { musicApi } from "@/lib/api";
import { getImageUrl } from "@/lib/image-utils";
import { Music } from "lucide-react";

interface PlaylistThumbnailProps {
  /** The playlist object — must have at least `id` and optionally `coverImageKey`. */
  playlist: { id: string; coverImageKey?: string; name?: string };
  /** Side length in pixels (renders as a square). Defaults to 32. */
  size?: number;
  className?: string;
}

/**
 * Renders a square playlist thumbnail that mirrors the cover-art logic used on
 * the my-playlists detail page:
 *   1. Custom cover (coverImageKey)        → full cover image
 *   2. 4 or more songs, no custom cover    → 2×2 mosaic from first 4 song arts
 *   3. 1–3 songs, no custom cover          → first song's art
 *   4. Empty playlist, no custom cover     → Music icon on dark background
 */
export function PlaylistThumbnail({
  playlist,
  size = 32,
  className = "",
}: PlaylistThumbnailProps) {
  // Only fetch songs when there's no custom cover – avoids needless requests.
  const needsSongs = !playlist.coverImageKey;

  const { data: songsResponse } = useQuery({
    queryKey: ["user-playlist-songs-thumb", playlist.id],
    queryFn: () => musicApi.users.getPlaylistSongs(playlist.id),
    enabled: needsSongs,
    staleTime: 5 * 60 * 1000, // 5 min — sidebar thumbnails rarely change
  });

  const songs: any[] = songsResponse?.data?.data || [];

  /* ── Derived image state ─────────────────────────────────────────── */

  const coverUrl = getImageUrl(playlist.coverImageKey, {
    width: size * 2,
    height: size * 2,
    focus: "auto",
    aspectRatio: "1-1",
  });

  const imgSize = Math.ceil(size / 2) * 2;

  const mosaicImages = songs.slice(0, 4).map((song: any) =>
    getImageUrl(song.imageKey || song.coverImageKey, {
      width: imgSize,
      height: imgSize,
      aspectRatio: "1-1",
    })
  );

  const showMosaic = !coverUrl && songs.length >= 4;
  const showSingle = !coverUrl && songs.length > 0 && songs.length < 4;
  const singleImg = showSingle ? mosaicImages[0] : null;

  /* ── Render ──────────────────────────────────────────────────────── */

  const containerStyle = {
    width: size,
    height: size,
    minWidth: size,
    minHeight: size,
  };

  if (coverUrl) {
    return (
      <div
        className={`shrink-0 overflow-hidden rounded-md bg-zinc-800 ${className}`}
        style={containerStyle}
      >
        <img
          src={coverUrl}
          alt={playlist.name ?? "Playlist"}
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  if (showMosaic) {
    return (
      <div
        className={`shrink-0 overflow-hidden rounded-md bg-zinc-800 ${className}`}
        style={containerStyle}
      >
        <div className="grid h-full w-full grid-cols-2 grid-rows-2">
          {mosaicImages.map((img, i) =>
            img ? (
              <img
                key={i}
                src={img}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <div
                key={i}
                className="flex h-full w-full items-center justify-center bg-zinc-800"
              >
                <Music size={size / 4} className="text-zinc-600" />
              </div>
            )
          )}
        </div>
      </div>
    );
  }

  if (showSingle && singleImg) {
    return (
      <div
        className={`shrink-0 overflow-hidden rounded-md bg-zinc-800 ${className}`}
        style={containerStyle}
      >
        <img
          src={singleImg}
          alt={playlist.name ?? "Playlist"}
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  // Empty / loading fallback
  return (
    <div
      className={`shrink-0 flex items-center justify-center rounded-md bg-zinc-800 ${className}`}
      style={containerStyle}
    >
      <Music size={size / 2.5} className="text-zinc-500" />
    </div>
  );
}
