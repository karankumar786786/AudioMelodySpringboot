"use client";

import React from "react";
import { Clock, Heart, Music } from "lucide-react";
import { PlaylistTrackRow } from "./PlaylistTrackRow";

interface PlaylistTrackListProps {
  songs: any[];
  currentSong: any;
  isPlaying: boolean;
  isOwner: boolean;
  isFavourites: boolean;
  systemUser: any;
  isLoading?: boolean;
  onPlaySong: (song: any, index: number) => void;
  onRemoveSong: (song: any) => void;
}

export function PlaylistTrackList({
  songs,
  currentSong,
  isPlaying,
  isOwner,
  isFavourites,
  systemUser,
  isLoading = false,
  onPlaySong,
  onRemoveSong,
}: PlaylistTrackListProps) {
  return (
    <section className="px-6 pb-10 pt-6 md:px-10">
      {/* Header */}
      <div className="grid grid-cols-12 items-center border-b border-white/10 px-4 pb-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
        <div className="col-span-1 text-center">#</div>
        <div className="col-span-7 sm:col-span-5 md:col-span-4 lg:col-span-3">Title</div>
        <div className="col-span-2 hidden md:block">Artist</div>
        <div className="col-span-2 hidden lg:block">Album</div>
        <div className="col-span-1 hidden xl:block">Genre</div>
        <div className="col-span-3 sm:col-span-3 md:col-span-3 lg:col-span-2 xl:col-span-2 hidden sm:block text-right">Plays</div>
        <div className="col-span-4 sm:col-span-3 md:col-span-2 lg:col-span-2 xl:col-span-1 text-right">
          <Clock size={16} className="ml-auto" />
        </div>
      </div>

      {/* Songs */}
      <div className="mt-2 flex flex-col">
        {isLoading && songs.length === 0 ? (
          <div className="flex flex-col gap-1 animate-pulse select-none">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((index) => (
              <div
                key={index}
                className="grid grid-cols-12 items-center rounded-md px-4 py-2.5 bg-zinc-900/20 border border-white/2"
              >
                {/* Track Index */}
                <div className="col-span-1 text-center flex justify-center">
                  <div className="h-3 w-3 rounded bg-zinc-800" />
                </div>

                {/* Title + Thumbnail */}
                <div className="col-span-7 sm:col-span-5 md:col-span-4 lg:col-span-3 flex items-center gap-3 min-w-0 pr-3">
                  <div className="h-10 w-10 shrink-0 rounded-md bg-zinc-800" />
                  <div className="flex-1 space-y-1.5 min-w-0">
                    <div className="h-3.5 w-4/5 rounded bg-zinc-800" />
                    <div className="h-2.5 w-1/2 rounded bg-zinc-800/60" />
                  </div>
                </div>

                {/* Artist */}
                <div className="col-span-2 hidden md:block pr-3">
                  <div className="h-3 w-24 rounded bg-zinc-800/60" />
                </div>

                {/* Album */}
                <div className="col-span-2 hidden lg:block pr-3">
                  <div className="h-3 w-28 rounded bg-zinc-800/60" />
                </div>

                {/* Genre */}
                <div className="col-span-1 hidden xl:block pr-3">
                  <div className="h-3 w-16 rounded bg-zinc-800/60" />
                </div>

                {/* Plays */}
                <div className="col-span-3 sm:col-span-3 md:col-span-3 lg:col-span-2 xl:col-span-2 hidden sm:block text-right pr-2">
                  <div className="h-3 w-16 rounded bg-zinc-800/60 ml-auto" />
                </div>

                {/* Duration */}
                <div className="col-span-4 sm:col-span-3 md:col-span-2 lg:col-span-2 xl:col-span-1 text-right">
                  <div className="h-3 w-10 rounded bg-zinc-800/60 ml-auto" />
                </div>
              </div>
            ))}
          </div>
        ) : songs.length > 0 ? (
          songs.map((song: any, index: number) => (
            <PlaylistTrackRow
              key={song.id}
              song={song}
              index={index}
              isActive={currentSong?.id === song.id}
              isCurrentPlaying={currentSong?.id === song.id && isPlaying}
              isOwner={isOwner}
              isFavourites={isFavourites}
              onPlay={() => onPlaySong(song, index)}
              onRemove={() => onRemoveSong(song)}
            />
          ))
        ) : (
          <div className="rounded-xl border border-dashed border-white/10 py-20 text-center">
            {isFavourites ? (
              <>
                <Heart size={40} className="mx-auto mb-4 text-purple-400" />
                <p className="text-sm text-zinc-300 font-semibold">
                  {systemUser ? "No favourite songs yet" : "Sign in to view your favourites"}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  {systemUser
                    ? "Tap the heart icon on any song across OneMelody to save it here."
                    : "Sign in with your account to access your saved favourites."}
                </p>
              </>
            ) : (
              <>
                <Music size={40} className="mx-auto mb-4 text-zinc-700" />
                <p className="text-sm text-zinc-500">No songs in this playlist yet.</p>
                <p className="mt-1 text-xs text-zinc-600">Add songs using the playlist picker on any song.</p>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
