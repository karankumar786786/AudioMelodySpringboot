"use client";

import { AlgoliaAutocomplete } from "@/components/search/AlgoliaAutocomplete";
import type { NavbarSearchProps } from "./types";

export function NavbarSearch({
  onPlaySong,
  onArtistClick,
  onPlaylistClick,
  onUserPlaylistClick,
}: NavbarSearchProps) {
  return (
    <div className="w-full max-w-md sm:max-w-lg lg:max-w-xl relative">
      <AlgoliaAutocomplete
        onSongSelected={onPlaySong}
        onArtistSelected={(artistId) => onArtistClick({ id: artistId } as any)}
        onPlaylistSelected={(playlistId, isUserPlaylist) =>
          isUserPlaylist
            ? onUserPlaylistClick({ id: playlistId } as any)
            : onPlaylistClick({ id: playlistId } as any)
        }
      />
    </div>
  );
}
