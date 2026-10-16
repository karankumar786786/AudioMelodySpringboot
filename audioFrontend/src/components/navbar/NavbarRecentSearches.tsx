"use client";

import { History, ListMusic, Loader2, Play, Trash2, User, X } from "lucide-react";
import { getImageUrl } from "@/lib/image-utils";
import { SongThumbnail } from "@/components/SongThumbnail";
import type { NavbarRecentSearchesProps } from "./types";

export function NavbarRecentSearches({
  recentHistory,
  isLoading,
  onRecentClick,
  onPlaySong,
  onDeleteHistoryItem,
  onClearHistory,
  isAuthenticated,
}: NavbarRecentSearchesProps) {
  return (
    <div className="flex-1 overflow-y-auto no-scrollbar">
      <div className="p-3 border-b border-[#282828] flex items-center justify-between sticky top-0 bg-[#181818] z-10">
        <span className="text-xs font-semibold text-zinc-400">
          Recent Searches
        </span>
        {recentHistory.length > 0 && (
          <button
            type="button"
            onClick={onClearHistory}
            className="text-[11px] font-medium text-zinc-500 hover:text-red-400 flex items-center gap-1 transition-colors cursor-pointer"
          >
            <Trash2 size={12} />
            Clear all
          </button>
        )}
      </div>
      <div className="p-2 space-y-1">
        {!isAuthenticated ? (
          <div className="p-6 text-center text-zinc-500 text-xs font-normal">
            Sign in to save your recent searches.
          </div>
        ) : isLoading ? (
          <div className="p-6 text-center text-zinc-500 text-xs flex items-center justify-center gap-2">
            <Loader2 size={14} className="animate-spin text-primary" />
            Loading recent searches...
          </div>
        ) : recentHistory.length === 0 ? (
          <div className="p-6 text-center text-zinc-500 text-xs font-normal">
            No recent searches found.
          </div>
        ) : (
          recentHistory.map((item) => {
            const isSong = item.type === "SONG" && !!item.song;
            const isArtist = item.type === "ARTIST" && !!item.artist;
            const isPlaylist = item.type === "PLAYLIST" && !!item.playlist;
            const isUserPlaylist = item.type === "USER_PLAYLIST" && !!item.userPlaylist;

            return (
              <div
                key={item.id}
                onClick={() => onRecentClick(item)}
                className="w-full flex items-center gap-3 p-2 hover:bg-[#282828] rounded-lg transition-all text-left group cursor-pointer"
              >
                {/* Rich Thumbnail with Hover Preview for Songs */}
                {isSong && item.song ? (
                  <SongThumbnail
                    song={item.song}
                    sizeClass="w-10 h-10"
                    roundedClass="rounded-md"
                    enablePreviewHover={true}
                    onPlayClick={() => onPlaySong(item.song!)}
                  />
                ) : isArtist && item.artist ? (
                  <div className="w-10 h-10 rounded-full bg-zinc-900 overflow-hidden shrink-0 flex items-center justify-center border border-white/5">
                    {item.artist.coverImageKey ? (
                      <img
                        src={getImageUrl(item.artist.coverImageKey, {
                          width: 80,
                          height: 80,
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
                ) : (isPlaylist && item.playlist) || (isUserPlaylist && item.userPlaylist) ? (
                  <div className="w-10 h-10 rounded-md bg-zinc-900 overflow-hidden shrink-0 flex items-center justify-center border border-white/5">
                    {(item.playlist?.coverImageKey || item.userPlaylist?.coverImageKey) ? (
                      <img
                        src={getImageUrl(
                          (item.playlist?.coverImageKey || item.userPlaylist?.coverImageKey)!,
                          {
                            width: 80,
                            height: 80,
                            focus: "auto",
                            aspectRatio: "1-1",
                          }
                        )}
                        className="w-full h-full object-cover"
                        alt=""
                      />
                    ) : (
                      <ListMusic size={16} className="text-zinc-500" />
                    )}
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-md bg-zinc-900/60 overflow-hidden shrink-0 flex items-center justify-center border border-white/5 text-zinc-400">
                    <History size={16} />
                  </div>
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white truncate">
                    {isSong
                      ? item.song?.title
                      : isArtist
                      ? item.artist?.name
                      : isPlaylist
                      ? item.playlist?.name
                      : item.userPlaylist?.name}
                  </p>
                  <p className="text-[11px] text-zinc-400 font-normal truncate">
                    {isSong
                      ? [item.song?.artistName || "Song", item.song?.album, item.song?.genre].filter(Boolean).join(" • ")
                      : isArtist
                      ? "Artist"
                      : isPlaylist
                      ? "Playlist"
                      : item.userPlaylist?.ownerName
                      ? `By ${item.userPlaylist.ownerName}`
                      : "Community Playlist"}
                  </p>
                </div>

                {/* Actions: Play if Song, Delete item */}
                <div className="flex items-center gap-1 shrink-0">
                  {isSong && item.song && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onPlaySong(item.song!);
                      }}
                      className="p-1.5 rounded-full hover:bg-white/10 text-primary opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                      title="Play"
                    >
                      <Play size={14} fill="currentColor" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteHistoryItem(item.id);
                    }}
                    className="p-1.5 rounded-full hover:bg-white/10 text-zinc-500 hover:text-zinc-200 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                    title="Remove from history"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
