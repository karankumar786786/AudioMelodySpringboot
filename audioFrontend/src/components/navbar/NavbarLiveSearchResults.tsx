"use client";

import { BookmarkPlus, ListMusic, Loader2, Play, Search, User } from "lucide-react";
import { toast } from "sonner";
import { getImageUrl } from "@/lib/image-utils";
import { SongThumbnail } from "@/components/SongThumbnail";
import { formatFollowerCount, formatStreamCount } from "@/lib/player-utils";
import type { Artist, Playlist, Song, UserPlaylist } from "@/lib/api";
import type { NavbarLiveSearchResultsProps } from "./types";

export function NavbarLiveSearchResults({
  query,
  debouncedQuery,
  isSearching,
  songs,
  artists,
  playlists,
  userPlaylists,
  onPlaySong,
  onArtistClick,
  onPlaylistClick,
  onUserPlaylistClick,
  onSavePlaylist,
  isAuthenticated,
}: NavbarLiveSearchResultsProps) {
  const hasNoResults =
    debouncedQuery.trim() &&
    !isSearching &&
    !songs?.length &&
    !artists?.length &&
    !playlists?.length &&
    !userPlaylists?.length;

  return (
    <div className="flex-1 overflow-y-auto no-scrollbar">
      <div className="p-3 border-b border-[#282828] flex items-center justify-between sticky top-0 bg-[#181818] z-10">
        <span className="text-xs font-semibold text-zinc-400">
          Search Results
        </span>
        {isSearching && (
          <Loader2
            size={14}
            className="text-primary animate-spin"
          />
        )}
      </div>

      <div className="p-2 space-y-1">
        {/* Songs */}
        {songs?.length > 0 && (
          <div className="mb-3">
            <h4 className="px-3 py-1 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
              Songs
            </h4>
            {songs.map((song: Song) => (
              <div
                key={song.id}
                onClick={() => onPlaySong(song)}
                className="w-full flex items-center gap-3 p-2 hover:bg-[#282828] rounded-lg transition-all text-left group cursor-pointer"
              >
                <SongThumbnail
                  song={song}
                  sizeClass="w-10 h-10"
                  enablePreviewHover={true}
                  onPlayClick={() => onPlaySong(song)}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white truncate">
                    {song.title}
                  </p>
                  <p className="text-[11px] text-zinc-400 font-normal truncate">
                    {song.artistName}
                    {song.album && (
                      <span className="text-zinc-400"> • {song.album}</span>
                    )}
                    {song.genre && (
                      <span className="text-zinc-500"> • {song.genre}</span>
                    )}
                    {song.totalStreams !== undefined && (
                      <span className="text-emerald-400"> • {formatStreamCount(song.totalStreams, true)}</span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 mr-1">
                  <Play
                    size={15}
                    className="text-primary opacity-0 group-hover:opacity-100 transition-all"
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Artists */}
        {artists?.length > 0 && (
          <div className="mb-3">
            <h4 className="px-3 py-1 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
              Artists
            </h4>
            {artists.map((artist: Artist) => (
              <button
                key={artist.id}
                onClick={() => onArtistClick(artist)}
                className="w-full flex items-center gap-3 p-2 hover:bg-[#282828] rounded-lg transition-all text-left group cursor-pointer"
              >
                <div className="w-10 h-10 rounded-full bg-zinc-900 overflow-hidden shrink-0 flex items-center justify-center">
                  {artist.coverImageKey ? (
                    <img
                      src={getImageUrl(artist.coverImageKey, {
                        width: 100,
                        height: 100,
                        focus: "face",
                        aspectRatio: "1-1",
                      })}
                      className="w-full h-full object-cover"
                      alt=""
                    />
                  ) : (
                    <User size={16} className="text-zinc-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white truncate">
                    {artist.name}
                  </p>
                  <p className="text-[11px] text-zinc-400 font-normal">
                    {artist.followersCount !== undefined
                      ? `Artist • ${formatFollowerCount(artist.followersCount)}`
                      : "Artist"}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Official/System Playlists */}
        {playlists?.length > 0 && (
          <div className="mb-3">
            <h4 className="px-3 py-1 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
              Official Playlists
            </h4>
            {playlists.map((playlist: Playlist) => (
              <button
                key={playlist.id}
                onClick={() => onPlaylistClick(playlist)}
                className="w-full flex items-center gap-3 p-2 hover:bg-[#282828] rounded-lg transition-all text-left group cursor-pointer"
              >
                <div className="w-10 h-10 rounded-md bg-zinc-900 overflow-hidden shrink-0 flex items-center justify-center">
                  {playlist.coverImageKey ? (
                    <img
                      src={getImageUrl(playlist.coverImageKey, {
                        width: 100,
                        height: 100,
                        focus: "auto",
                        aspectRatio: "1-1",
                      })}
                      className="w-full h-full object-cover"
                      alt=""
                    />
                  ) : (
                    <ListMusic
                      size={16}
                      className="text-zinc-500"
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white truncate">
                    {playlist.name}
                  </p>
                  <p className="text-[11px] text-zinc-400 font-normal">
                    Official Playlist
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Community / User Playlists */}
        {userPlaylists?.length > 0 && (
          <div>
            <h4 className="px-3 py-1 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
              Community Playlists
            </h4>
            {userPlaylists.map((playlist: UserPlaylist) => (
              <button
                key={playlist.id}
                onClick={() => onUserPlaylistClick(playlist)}
                className="w-full flex items-center gap-3 p-2 hover:bg-[#282828] rounded-lg transition-all text-left group cursor-pointer"
              >
                <div className="w-10 h-10 rounded-md bg-zinc-900 overflow-hidden shrink-0 flex items-center justify-center">
                  {playlist.coverImageKey ? (
                    <img
                      src={getImageUrl(playlist.coverImageKey, {
                        width: 100,
                        height: 100,
                        focus: "auto",
                        aspectRatio: "1-1",
                      })}
                      className="w-full h-full object-cover"
                      alt=""
                    />
                  ) : (
                    <ListMusic
                      size={16}
                      className="text-zinc-500"
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white truncate">
                    {playlist.name}
                  </p>
                  <p className="text-[11px] text-zinc-400 font-normal truncate">
                    {playlist.ownerName ? `By ${playlist.ownerName}` : "User Playlist"}
                  </p>
                </div>
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!isAuthenticated) {
                      toast.info("Sign in required", {
                        description: "Please sign in to save playlists to your library.",
                      });
                      return;
                    }
                    onSavePlaylist(playlist.id);
                  }}
                  className="p-1.5 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-colors opacity-0 group-hover:opacity-100 shrink-0 cursor-pointer"
                  title="Save to your library"
                >
                  <BookmarkPlus size={15} />
                </div>
              </button>
            ))}
          </div>
        )}

        {hasNoResults && (
          <div className="p-6 text-center bg-[#282828]/50 rounded-lg m-2">
            <Search
              size={20}
              className="mx-auto mb-2 text-zinc-500"
            />
            <p className="text-xs font-medium text-zinc-400">
              No results found for "{query}"
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
