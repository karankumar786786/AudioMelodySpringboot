"use client";

import Link from "next/link";
import { Music, Pause, Play, Smartphone } from "lucide-react";
import { useSong } from "@/hooks/queries";
import { getImageUrl } from "@/lib/image-utils";
import { playerActions } from "@/store/player.store";
import { useAppSelector } from "@/store/hooks";
import { Button } from "@/components/ui/button";

interface SongShareClientViewProps {
  id: string;
  title?: string;
  artist?: string;
  coverKey?: string;
}

export function SongShareClientView({ id, title, artist, coverKey }: SongShareClientViewProps) {
  const systemUser = useAppSelector((s) => s.auth.systemUser);
  const currentSongId = useAppSelector((s) => s.player.currentSong?.id);
  const isPlaying = useAppSelector((s) => s.player.isPlaying);
  const isSignedIn = Boolean(systemUser);

  // The song API needs a session; guests only see what the share link carried.
  const { data: song, isLoading, isError } = useSong(isSignedIn ? id : undefined);

  const displayTitle = song?.title ?? title ?? "A song on One Melody";
  const displayArtist = song?.artistName ?? artist;
  const cover = getImageUrl(song?.imageKey ?? coverKey, {
    width: 600,
    height: 600,
    aspectRatio: "1-1",
  });
  const appLink = `audioapp://song/${encodeURIComponent(id)}`;
  const isThisPlaying = currentSongId === id && isPlaying;

  const handlePlay = () => {
    if (!song) return;
    if (currentSongId === id) {
      playerActions.setIsPlaying(!isPlaying);
    } else {
      playerActions.playSong(song);
    }
  };

  return (
    <div className="min-h-[70vh] w-full flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm flex flex-col items-center text-center gap-6">
        <div className="relative w-64 h-64 max-w-full aspect-square rounded-2xl overflow-hidden bg-neutral-900 shadow-2xl">
          {cover ? (
            // biome-ignore lint/performance/noImgElement: cover comes from the share link; avoid next/image domain checks for it
            <img src={cover} alt={displayTitle} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Music className="w-16 h-16 text-neutral-600" />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1 min-w-0 w-full">
          <h1 className="text-2xl font-bold text-white truncate">{displayTitle}</h1>
          {displayArtist ? (
            <p className="text-neutral-400 truncate">{displayArtist}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 w-full">
          {isSignedIn ? (
            <Button
              size="lg"
              className="w-full rounded-full"
              onClick={handlePlay}
              disabled={!song || isLoading}
            >
              {isThisPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              {isLoading ? "Loading…" : isThisPlaying ? "Pause" : "Play"}
            </Button>
          ) : (
            <Button asChild size="lg" className="w-full rounded-full">
              <Link href="/login">
                <Play className="w-5 h-5" />
                Sign in to listen
              </Link>
            </Button>
          )}

          <Button asChild size="lg" variant="outline" className="w-full rounded-full">
            <a href={appLink}>
              <Smartphone className="w-5 h-5" />
              Open in the One Melody app
            </a>
          </Button>

          {isSignedIn && isError ? (
            <p className="text-sm text-neutral-400">
              We couldn&apos;t load this song. It may have been removed.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
