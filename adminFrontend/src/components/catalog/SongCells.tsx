"use client";

import { Film, Music, Pause, Play, Star, Video } from "lucide-react";
import { useAudio } from "@/lib/audio-context";
import { getImageUrl } from "@/lib/image-utils";

export interface PlayableSong {
  id: string;
  title: string;
  artistName?: string;
  songKey?: string;
  imageKey?: string;
  videoKey?: string | null;
  fullVideoKey?: string | null;
  lrclibId?: string | null;
  duration?: number;
  isFeatured?: boolean;
  genre?: string;
  status?: string;
}

/** Durations come in seconds or, from older rows, milliseconds. */
export function formatDuration(num?: number): string {
  if (!num || Number.isNaN(num)) return "0:00";
  const sec = num > 10000 ? Math.floor(num / 1000) : Math.floor(num);
  return `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, "0")}`;
}

export function splitList(value?: string | null): string[] {
  return value
    ? value
        .split(",")
        .map((g) => g.trim())
        .filter(Boolean)
    : [];
}

/** Cover art with a play/pause overlay, title, featured star and artist. */
export function SongTitleCell({ song, maxWidth = "max-w-50" }: { song: PlayableSong; maxWidth?: string }) {
  const { currentTrack, isPlaying, playTrack, pauseTrack, resumeTrack } = useAudio();
  const isCurrent = currentTrack?.id === song.id;
  const isCurrentPlaying = isCurrent && isPlaying;

  const toggle = () => {
    if (isCurrent) {
      if (isPlaying) pauseTrack();
      else resumeTrack();
      return;
    }
    playTrack({
      id: song.id,
      title: song.title,
      artistName: song.artistName || "Unknown Artist",
      songKey: song.songKey || `audios/${song.id}`,
      imageKey: song.imageKey ?? "",
      videoKey: song.videoKey || undefined,
      duration: song.duration,
    });
  };

  return (
    <div className="flex items-center gap-3">
      <div className="relative w-10 h-10 rounded-xl overflow-hidden bg-black border border-white/10 shrink-0 group/cover">
        {song.imageKey ? (
          // biome-ignore lint/performance/noImgElement: ImageKit already serves a resized thumbnail
          <img
            src={getImageUrl(song.imageKey, { width: 80, height: 80 })}
            alt={song.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-zinc-600">
            <Music className="w-4 h-4" />
          </div>
        )}
        <button
          type="button"
          aria-label={isCurrentPlaying ? `Pause ${song.title}` : `Play ${song.title}`}
          onClick={(e) => {
            e.stopPropagation();
            toggle();
          }}
          className={`absolute inset-0 bg-black/60 flex items-center justify-center transition-opacity cursor-pointer ${
            isCurrentPlaying ? "opacity-100" : "opacity-0 group-hover/cover:opacity-100 focus:opacity-100"
          }`}
        >
          {isCurrentPlaying ? (
            <Pause className="w-4 h-4 text-white fill-white" />
          ) : (
            <Play className="w-4 h-4 text-white fill-white translate-x-0.5" />
          )}
        </button>
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <p className={`font-bold text-white group-hover:text-zinc-300 transition-colors truncate ${maxWidth}`}>
            {song.title}
          </p>
          {song.isFeatured && (
            <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" aria-label="Featured" />
          )}
        </div>
        <p className={`text-[11px] text-zinc-400 truncate ${maxWidth}`}>{song.artistName || "Unknown Artist"}</p>
      </div>
    </div>
  );
}

export function GenreBadges({ genre }: { genre?: string | null }) {
  const genres = splitList(genre);
  if (genres.length === 0) return <span className="text-zinc-600 text-[11px]">—</span>;
  return (
    <div className="flex flex-wrap gap-1 max-w-55">
      {genres.slice(0, 3).map((g) => (
        <span
          key={g}
          className="px-2 py-0.5 rounded-md bg-white/6 text-zinc-300 border border-white/8 text-[10px] font-semibold"
        >
          {g}
        </span>
      ))}
      {genres.length > 3 && (
        <span className="text-[10px] text-zinc-500 font-mono self-center">+{genres.length - 3}</span>
      )}
    </div>
  );
}

export function AssetIndicators({ song }: { song: PlayableSong }) {
  return (
    <div className="flex items-center gap-2">
      {song.videoKey ? (
        <span className="p-1 rounded-md bg-white/10 text-white border border-white/20" title="Vertical Video Canvas (9:16) attached">
          <Film className="w-3.5 h-3.5" />
        </span>
      ) : (
        <span className="p-1 text-zinc-600" title="No Vertical Canvas">
          <Film className="w-3.5 h-3.5 opacity-30" />
        </span>
      )}
      {song.fullVideoKey ? (
        <span className="p-1 rounded-md bg-white/10 text-white border border-white/20" title="Full 16:9 Video attached">
          <Video className="w-3.5 h-3.5" />
        </span>
      ) : (
        <span className="p-1 text-zinc-600" title="No Full Video">
          <Video className="w-3.5 h-3.5 opacity-30" />
        </span>
      )}
      {song.lrclibId && song.lrclibId !== "0" ? (
        <span
          className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-white/10 text-zinc-200 border border-white/20"
          title="Synced lyrics available"
        >
          LRC
        </span>
      ) : null}
    </div>
  );
}

export function StatusBadge({ status }: { status?: string }) {
  const active = (status || "ACTIVE") === "ACTIVE";
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
        active ? "bg-white/10 text-white border-white/20" : "bg-zinc-800/40 text-zinc-400 border-zinc-700/40"
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${active ? "bg-white" : "bg-zinc-500"}`} />
      {status || "ACTIVE"}
    </span>
  );
}

export const iconButton =
  "p-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";
