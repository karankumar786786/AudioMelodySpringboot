"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { EditSongModal } from "@/components/edit-song/EditSongModal";
import type { SongData } from "@/components/edit-song/types";
import { useConfirm } from "@/components/feedback/ConfirmProvider";
import { useToast } from "@/components/feedback/ToastProvider";
import { apiGet } from "@/lib/http";
import { getImageUrl } from "@/lib/image-utils";
import { usePermissions } from "@/lib/permissions";
import { useAddSongToPlaylist, usePlaylists } from "@/lib/queries/playlists";
import { useDeleteSong, useMergeSong } from "@/lib/queries/songs";
import { queryKeys } from "@/lib/query/keys";

interface SearchResult {
  id: string;
  title?: string;
  name?: string;
  imageKey?: string;
  coverImageKey?: string;
  artistName?: string;
}

interface UnifiedSearchResponse {
  songs: SearchResult[];
  artists: SearchResult[];
  playlists: SearchResult[];
}

function useDebounced(value: string, ms: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [showPlaylistPicker, setShowPlaylistPicker] = useState<string | null>(null); // songId
  const [editingSong, setEditingSong] = useState<SongData | null>(null);
  const [fetchingSongId, setFetchingSongId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const toast = useToast();
  const { can } = usePermissions();

  const debouncedQuery = useDebounced(query, 300);
  const searchKey = queryKeys.search.global(debouncedQuery);
  const searchQuery = useQuery({
    queryKey: searchKey,
    queryFn: async ({ signal }) => {
      const data = await apiGet<{ data?: UnifiedSearchResponse } & UnifiedSearchResponse>(
        `/api/search?q=${encodeURIComponent(debouncedQuery)}`,
        signal,
      );
      return data.data || data;
    },
    enabled: debouncedQuery.length > 1,
    staleTime: 10_000,
  });
  const results = query.length > 1 ? (searchQuery.data ?? null) : null;
  const loading = searchQuery.isFetching;

  const playlistsQuery = usePlaylists(
    { page: 0, size: 100, search: "", status: "" },
    { enabled: showPlaylistPicker !== null },
  );
  const playlists = playlistsQuery.data?.rows ?? [];
  const playlistLoading = playlistsQuery.isPending && showPlaylistPicker !== null;

  const deleteSong = useDeleteSong();
  const addToPlaylist = useAddSongToPlaylist();
  const mergeSong = useMergeSong();

  const patchResults = (update: (songs: SearchResult[]) => SearchResult[]) =>
    qc.setQueryData<UnifiedSearchResponse>(searchKey, (old) => (old ? { ...old, songs: update(old.songs) } : old));

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsFocused(false);
        setShowPlaylistPicker(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset the search on navigation
  useEffect(() => {
    setIsFocused(false);
    setQuery("");
    setShowPlaylistPicker(null);
  }, [pathname]);

  const handleDeleteSong = async (song: SearchResult, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const title = song.title || "this song";
    const ok = await confirm({
      title: `Delete "${title}"?`,
      description: "This starts a cascade purge across S3, the CDN, search and recommendations.",
      confirmLabel: "Delete track",
      destructive: true,
      typeToConfirm: song.title || "delete",
    });
    if (!ok) return;
    const previous = qc.getQueryData<UnifiedSearchResponse>(searchKey);
    patchResults((songs) => songs.filter((s) => s.id !== song.id));
    deleteSong.mutate(
      { id: song.id, title },
      { onError: () => previous && qc.setQueryData(searchKey, previous) },
    );
  };

  const handleAddToPlaylist = (playlistId: string, songId: string) => {
    addToPlaylist.mutate(
      { playlistId, songId },
      {
        onSuccess: () => {
          toast("Song added to playlist!");
          setShowPlaylistPicker(null);
        },
        onError: (err) => toast(err.message || "Failed to add song", "error"),
      },
    );
  };

  const openPlaylistPicker = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowPlaylistPicker(id);
  };

  const handleEditSong = async (song: SearchResult, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setFetchingSongId(song.id);
    const fallback: SongData = {
      id: song.id,
      title: song.title || "",
      artistName: song.artistName || "",
      imageKey: song.imageKey,
    };
    try {
      const full = await qc.fetchQuery({
        queryKey: queryKeys.songs.detail(song.id),
        queryFn: ({ signal }) => apiGet<SongData>(`/admin/song/${song.id}`, signal),
      });
      setEditingSong(full);
    } catch {
      setEditingSong(fallback);
    } finally {
      setIsFocused(false);
      setFetchingSongId(null);
    }
  };

  const handleEditSuccess = (updatedSong: SongData) => {
    mergeSong(updatedSong);
    patchResults((songs) =>
      songs.map((s) =>
        s.id === updatedSong.id
          ? { ...s, title: updatedSong.title, artistName: updatedSong.artistName, imageKey: updatedSong.imageKey }
          : s,
      ),
    );
  };

  const hasResults = results && (results.songs.length > 0 || results.artists.length > 0 || results.playlists.length > 0);

  return (
    <div ref={containerRef} className="relative w-full max-w-lg mx-8 z-[100]">
      <div className="relative group">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
          <svg className={`w-4 h-4 transition-colors ${loading ? 'text-white animate-pulse' : 'text-zinc-500 group-hover:text-zinc-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          placeholder="Search songs, artists, playlists..."
          className="w-full bg-[#121212] border border-[#282828] rounded-xl py-2 pl-10 pr-4 text-xs focus:border-white focus:ring-1 focus:ring-white/20 transition-all outline-none text-white placeholder-zinc-500"
        />
      </div>

      {isFocused && (query.length >= 2) && (
        <div className="absolute top-full left-0 right-0 mt-3 bg-[#121212] rounded-2xl border border-[#282828] shadow-2xl overflow-hidden z-[100] animate-in fade-in slide-in-from-top-2 duration-200">
          {!results && loading && (
            <div className="p-8 text-center text-xs text-zinc-500 italic">Searching archives...</div>
          )}
          
          {results && !hasResults && !loading && (
            <div className="p-8 text-center text-xs text-zinc-500 italic">No matches found for "{query}"</div>
          )}

          {results && hasResults && (
            <div className="max-h-[70vh] overflow-y-auto p-2 space-y-4">
              {results.songs.length > 0 && (
                <section>
                  <h3 className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-zinc-500">Songs</h3>
                  {results.songs.map(song => (
                    <div key={song.id} className="relative group/item">
                       <Link
                         href={`/songs?edit=${song.id}`}
                         onClick={() => setIsFocused(false)}
                         className="flex items-center gap-3 p-2.5 hover:bg-[#181818] rounded-xl transition-colors pr-28"
                       >
                        <div className="w-9 h-9 rounded-lg bg-[#181818] border border-[#282828] overflow-hidden shrink-0">
                          {song.imageKey && <img src={getImageUrl(song.imageKey)} className="w-full h-full object-cover" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold text-white truncate">{song.title}</div>
                          <div className="text-[11px] text-zinc-400 truncate">{song.artistName}</div>
                        </div>
                      </Link>
                      
                      {/* Action Buttons */}
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover/item:opacity-100 transition-opacity">
                         {can("song.edit") && (
<button 
                          onClick={(e) => handleEditSong(song, e)}
                          disabled={fetchingSongId === song.id}
                          title="Edit Song"
                          className="p-1.5 text-zinc-400 hover:text-white hover:bg-[#282828] rounded-lg transition-all"
                         >
                            {fetchingSongId === song.id ? (
                              <Loader2 className="w-4 h-4 animate-spin text-white" />
                            ) : (
                              <Pencil className="w-4 h-4" />
                            )}
                         </button>
)}
                         {can("playlist.edit") && (
<button 
                          onClick={(e) => openPlaylistPicker(song.id, e)}
                          title="Add to Playlist"
                          className="p-1.5 text-zinc-400 hover:text-white hover:bg-[#282828] rounded-lg transition-all"
                         >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                         </button>
)}
                         {can("song.delete") && (
<button 
                          onClick={(e) => handleDeleteSong(song, e)}
                          title="Delete Song"
                          className="p-1.5 text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all"
                         >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                         </button>
)}
                      </div>

                      {/* Playlist Picker Overlay */}
                      {showPlaylistPicker === song.id && (
                        <div className="absolute top-0 right-0 mt-12 w-64 bg-[#181818] border border-[#282828] rounded-xl shadow-2xl z-[110] p-2 animate-in fade-in zoom-in-95 duration-150">
                          <div className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-zinc-400 border-b border-[#282828] mb-1 flex justify-between">
                            <span>Select Playlist</span>
                            <button onClick={(e) => { e.stopPropagation(); setShowPlaylistPicker(null); }} className="hover:text-rose-400">Close</button>
                          </div>
                          <div className="max-h-48 overflow-y-auto">
                            {playlistLoading && <div className="p-4 text-center text-xs text-zinc-500">Loading playlists...</div>}
                            {playlists.map(p => (
                              <button 
                                key={p.id}
                                onClick={() => handleAddToPlaylist(p.id, song.id)}
                                className="w-full text-left px-3 py-2 text-xs font-medium text-zinc-300 hover:bg-[#282828] hover:text-white rounded-lg transition-colors truncate"
                              >
                                {p.name}
                              </button>
                            ))}
                            {playlists.length === 0 && !playlistLoading && <div className="p-4 text-center text-xs text-zinc-500 italic">No playlists found</div>}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </section>
              )}

              {results.artists.length > 0 && (
                <section>
                  <h3 className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-zinc-500">Artists</h3>
                  {results.artists.map(artist => (
                    <Link key={artist.id} href={`/artists/${artist.id}/songs`} className="flex items-center gap-3 p-2.5 hover:bg-[#181818] rounded-xl transition-colors">
                      <div className="w-9 h-9 rounded-full bg-[#181818] overflow-hidden shrink-0 border border-[#282828]">
                        {artist.coverImageKey && <img src={getImageUrl(artist.coverImageKey)} className="w-full h-full object-cover" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-white truncate">{artist.name}</div>
                        <div className="text-[10px] text-zinc-500 uppercase tracking-tighter">View Discography</div>
                      </div>
                    </Link>
                  ))}
                </section>
              )}

              {results.playlists.length > 0 && (
                <section>
                  <h3 className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-zinc-500">Playlists</h3>
                  {results.playlists.map(playlist => (
                    <Link key={playlist.id} href="/playlists" className="flex items-center gap-3 p-2.5 hover:bg-[#181818] rounded-xl transition-colors">
                      <div className="w-9 h-9 rounded-lg bg-[#181818] border border-[#282828] flex items-center justify-center overflow-hidden shrink-0">
                         {playlist.coverImageKey ? <img src={getImageUrl(playlist.coverImageKey)} className="w-full h-full object-cover" /> : <svg className="w-4 h-4 text-zinc-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l6 4.5-6 4.5z"/></svg>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-white truncate">{playlist.name}</div>
                        <div className="text-[10px] text-zinc-500">Official Playlist</div>
                      </div>
                    </Link>
                  ))}
                </section>
              )}
            </div>
          )}
        </div>
      )}

      {/* Edit Song Modal */}
      <EditSongModal
        song={editingSong}
        isOpen={Boolean(editingSong)}
        onClose={() => setEditingSong(null)}
        onSuccess={handleEditSuccess}
      />
    </div>
  );
}
