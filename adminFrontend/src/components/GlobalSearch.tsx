"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { adminFetch } from "@/lib/adminFetch";

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

interface BasicPlaylist {
  id: string;
  name: string;
}

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UnifiedSearchResponse | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPlaylistPicker, setShowPlaylistPicker] = useState<string | null>(null); // songId
  const [playlists, setPlaylists] = useState<BasicPlaylist[]>([]);
  const [playlistLoading, setPlaylistLoading] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

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

  useEffect(() => {
    setIsFocused(false);
    setQuery("");
    setShowPlaylistPicker(null);
  }, [pathname]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (query.length > 1) {
        performSearch();
      } else {
        setResults(null);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  const performSearch = async () => {
    setLoading(true);
    try {
      const res = await adminFetch(`${process.env.NEXT_PUBLIC_API_URL}/search?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.data);
      }
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPlaylists = async () => {
    setPlaylistLoading(true);
    try {
      const res = await adminFetch(`${process.env.NEXT_PUBLIC_API_URL}/playlists?limit=100`);
      if (res.ok) {
        const data = await res.json();
        setPlaylists(data.data.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch playlists", err);
    } finally {
      setPlaylistLoading(false);
    }
  };

  const handleDeleteSong = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!confirm("Are you sure you want to delete this song? This cannot be undone.")) return;

    try {
      const res = await adminFetch(`${process.env.NEXT_PUBLIC_API_URL}/songs/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        // Update local results to remove the song
        if (results) {
          setResults({
            ...results,
            songs: results.songs.filter(s => s.id !== id)
          });
        }
        alert("Song deleted successfully");
      }
    } catch (err) {
      console.error("Delete failed:", err);
      alert("Failed to delete song");
    }
  };

  const handleAddToPlaylist = async (playlistId: string, songId: string) => {
    try {
      const res = await adminFetch(`${process.env.NEXT_PUBLIC_API_URL}/playlists/songs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playlistId, songId }),
      });
      if (res.ok) {
        alert("Song added to playlist!");
        setShowPlaylistPicker(null);
      } else {
        const err = await res.json();
        alert(err.message || "Failed to add song");
      }
    } catch (err) {
      console.error("Add to playlist failed:", err);
    }
  };

  const openPlaylistPicker = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowPlaylistPicker(id);
    if (playlists.length === 0) fetchPlaylists();
  };

  const hasResults = results && (results.songs.length > 0 || results.artists.length > 0 || results.playlists.length > 0);

  return (
    <div ref={containerRef} className="relative w-full max-w-lg mx-8 z-[100]">
      <div className="relative group">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <svg className={`w-5 h-5 transition-colors ${loading ? 'text-indigo-500 animate-pulse' : 'text-zinc-400 group-hover:text-indigo-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          placeholder="Search songs, artists, playlists..."
          className="w-full bg-zinc-100 dark:bg-zinc-900 border-none rounded-2xl py-2.5 pl-12 pr-4 text-sm focus:ring-2 focus:ring-indigo-500 transition-all outline-none text-zinc-900 dark:text-white"
        />
      </div>

      {isFocused && (query.length >= 2) && (
        <div className="absolute top-full left-0 right-0 mt-3 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden z-[100] animate-in fade-in slide-in-from-top-2 duration-200">
          {!results && loading && (
            <div className="p-8 text-center text-sm text-zinc-500 italic">Searching archives...</div>
          )}
          
          {results && !hasResults && !loading && (
            <div className="p-8 text-center text-sm text-zinc-500 italic">No matches found for "{query}"</div>
          )}

          {results && hasResults && (
            <div className="max-h-[70vh] overflow-y-auto p-2 space-y-4">
              {results.songs.length > 0 && (
                <section>
                  <h3 className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-400">Songs</h3>
                  {results.songs.map(song => (
                    <div key={song.id} className="relative group/item">
                       <Link href="/songs" className="flex items-center gap-3 p-3 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-2xl transition-colors pr-24">
                        <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 overflow-hidden shrink-0">
                          {song.imageKey && <img src={`https://ik.imagekit.io/zaa6pbi9f${song.imageKey}`} className="w-full h-full object-cover" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-zinc-900 dark:text-white truncate">{song.title}</div>
                          <div className="text-xs text-zinc-500 truncate">{song.artistName}</div>
                        </div>
                      </Link>
                      
                      {/* Action Buttons */}
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                         <button 
                          onClick={(e) => openPlaylistPicker(song.id, e)}
                          title="Add to Playlist"
                          className="p-2 text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-xl transition-all"
                         >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                         </button>
                         <button 
                          onClick={(e) => handleDeleteSong(song.id, e)}
                          title="Delete Song"
                          className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl transition-all"
                         >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                         </button>
                      </div>

                      {/* Playlist Picker Overlay */}
                      {showPlaylistPicker === song.id && (
                        <div className="absolute top-0 right-0 mt-12 w-64 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl shadow-xl z-[110] p-2 animate-in fade-in zoom-in-95 duration-150">
                          <div className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-400 border-b border-zinc-100 dark:border-zinc-700/50 mb-1 flex justify-between">
                            <span>Select Playlist</span>
                            <button onClick={(e) => { e.stopPropagation(); setShowPlaylistPicker(null); }} className="hover:text-red-500">Close</button>
                          </div>
                          <div className="max-h-48 overflow-y-auto">
                            {playlistLoading && <div className="p-4 text-center text-xs text-zinc-500">Loading playlists...</div>}
                            {playlists.map(p => (
                              <button 
                                key={p.id}
                                onClick={() => handleAddToPlaylist(p.id, song.id)}
                                className="w-full text-left px-3 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 rounded-xl transition-colors truncate"
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
                  <h3 className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-400">Artists</h3>
                  {results.artists.map(artist => (
                    <Link key={artist.id} href={`/artists/${artist.id}/songs`} className="flex items-center gap-3 p-3 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-2xl transition-colors">
                      <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden shrink-0 border border-zinc-200 dark:border-zinc-700">
                        {artist.coverImageKey && <img src={`https://ik.imagekit.io/zaa6pbi9f${artist.coverImageKey}`} className="w-full h-full object-cover" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-zinc-900 dark:text-white truncate">{artist.name}</div>
                        <div className="text-xs text-zinc-500 uppercase tracking-tighter">View Discography</div>
                      </div>
                    </Link>
                  ))}
                </section>
              )}

              {results.playlists.length > 0 && (
                <section>
                  <h3 className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-400">Playlists</h3>
                  {results.playlists.map(playlist => (
                    <Link key={playlist.id} href="/playlists" className="flex items-center gap-3 p-3 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-2xl transition-colors">
                      <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center overflow-hidden shrink-0">
                         {playlist.coverImageKey ? <img src={`https://ik.imagekit.io/zaa6pbi9f${playlist.coverImageKey}`} className="w-full h-full object-cover" /> : <svg className="w-5 h-5 text-indigo-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l6 4.5-6 4.5z"/></svg>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-zinc-900 dark:text-white truncate">{playlist.name}</div>
                        <div className="text-xs text-zinc-500">Official Playlist</div>
                      </div>
                    </Link>
                  ))}
                </section>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
