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
  onPlaySong,
  onRemoveSong,
}: PlaylistTrackListProps) {
  return (
    <section className="px-6 pb-10 pt-6 md:px-10">
      {/* Header */}
      <div className="grid grid-cols-12 items-center border-b border-white/10 px-4 pb-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
        <div className="col-span-1 text-center">#</div>
        <div className="col-span-6 md:col-span-4 lg:col-span-3">Title</div>
        <div className="col-span-3 hidden md:block lg:col-span-3">Artist</div>
        <div className="col-span-2 hidden md:block">Album</div>
        <div className="col-span-1 hidden xl:block">Genre</div>
        <div className="col-span-5 text-right md:col-span-2 lg:col-span-3 xl:col-span-2">
          <Clock size={16} className="ml-auto" />
        </div>
      </div>

      {/* Songs */}
      <div className="mt-2 flex flex-col">
        {songs.length > 0 ? (
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
