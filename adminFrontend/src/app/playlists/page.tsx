"use client";

import { useEffect, useState, useRef } from "react";
import { getImageUrl } from "@/lib/image-utils";
import { adminFetch } from "@/lib/adminFetch";

interface Playlist {
  id: string;
  name: string;
  description: string;
  coverImageKey: string;
  bannerImageKey: string;
}

interface Song {
  id: string;
  title: string;
}

export default function PlaylistsPage() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [playlistSongs, setPlaylistSongs] = useState<Song[]>([]);
  const [availableSongs, setAvailableSongs] = useState<Song[]>([]);
  const [newPlaylist, setNewPlaylist] = useState({ 
    name: "", 
    description: "",
    coverImage: null as File | null,
    bannerImage: null as File | null,
  });
  const [creating, setCreating] = useState(false);
  const hasFetchedRef = useRef(false);

  console.log("PlaylistsPage rendering. Current playlists count:", playlists.length);
  console.log("NEXT_PUBLIC_API_URL:", process.env.NEXT_PUBLIC_API_URL);

  const fetchPlaylists = async () => {
    console.log("fetchPlaylists called");
    try {
      const url = `${process.env.NEXT_PUBLIC_API_URL}/playlists`;
      console.log("Fetching from:", url);
      const res = await adminFetch(url);
      const data = await res.json();
      console.log("fetchPlaylists result success:", data.success);
      if (data.success) {
        setPlaylists(data.data.data || []);
      }
    } catch (err) {
      console.error("fetchPlaylists error:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPlaylistSongs = async (id: string) => {
    console.log("fetchPlaylistSongs called for ID:", id);
    try {
      const url = `${process.env.NEXT_PUBLIC_API_URL}/playlists/${id}/songs`;
      console.log("Fetching songs from:", url);
      const res = await adminFetch(url);
      const data = await res.json();
      if (data.success) {
        // Handle both paginated and non-paginated structures for resilience
        const songs = Array.isArray(data.data) ? data.data : (data.data?.data || []);
        console.log("fetchPlaylistSongs result songs count:", songs.length);
        setPlaylistSongs(songs);
      }
    } catch (err) {
      console.error("Failed to fetch playlist songs:", err);
    }
  };

  const fetchAllSongs = async () => {
    console.log("fetchAllSongs called");
    try {
      const res = await adminFetch(`${process.env.NEXT_PUBLIC_API_URL}/songs?limit=100`);
      const data = await res.json();
      if (data.success) setAvailableSongs(data.data.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    console.log("PlaylistsPage mounted (useEffect) - triggering fetch");
    fetchPlaylists();
    fetchAllSongs();
  }, []);

  const handleCreatePlaylist = async () => {
    if (!newPlaylist.name) return alert("Please enter a name");
    if (!newPlaylist.coverImage) return alert("Please select a cover image");
    if (!newPlaylist.bannerImage) return alert("Please select a banner image");

    setCreating(true);
    try {
      // 1. Upload Cover Image
      const sigResCover = await adminFetch(`${process.env.NEXT_PUBLIC_API_URL}/misc/presigned-url/image`);
      if (!sigResCover.ok) throw new Error("Failed to get cover upload signature");
      const sigDataCover = await sigResCover.json();

      const formDataCover = new FormData();
      formDataCover.append("file", newPlaylist.coverImage);
      formDataCover.append("publicKey", process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY || "");
      formDataCover.append("signature", sigDataCover.data.signature);
      formDataCover.append("expire", sigDataCover.data.expire.toString());
      formDataCover.append("token", sigDataCover.data.token);
      formDataCover.append("folder", "/playlists/covers");
      const extCover = newPlaylist.coverImage.name.split('.').pop();
      formDataCover.append("fileName", `${sigDataCover.data.tempKey}.${extCover}`);

      const uploadResCover = await adminFetch("https://upload.imagekit.io/api/v1/files/upload", {
        method: "POST",
        body: formDataCover,
      });
      const uploadDataCover = await uploadResCover.json();
      if (!uploadResCover.ok) throw new Error("Cover image upload failed");

      // 2. Upload Banner Image
      const sigResBanner = await adminFetch(`${process.env.NEXT_PUBLIC_API_URL}/misc/presigned-url/image`);
      if (!sigResBanner.ok) throw new Error("Failed to get banner upload signature");
      const sigDataBanner = await sigResBanner.json();

      const formDataBanner = new FormData();
      formDataBanner.append("file", newPlaylist.bannerImage);
      formDataBanner.append("publicKey", process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY || "");
      formDataBanner.append("signature", sigDataBanner.data.signature);
      formDataBanner.append("expire", sigDataBanner.data.expire.toString());
      formDataBanner.append("token", sigDataBanner.data.token);
      formDataBanner.append("folder", "/playlists/banners");
      const extBanner = newPlaylist.bannerImage.name.split('.').pop();
      formDataBanner.append("fileName", `${sigDataBanner.data.tempKey}.${extBanner}`);

      const uploadResBanner = await adminFetch("https://upload.imagekit.io/api/v1/files/upload", {
        method: "POST",
        body: formDataBanner,
      });
      const uploadDataBanner = await uploadResBanner.json();
      if (!uploadResBanner.ok) throw new Error("Banner image upload failed");

      // 3. Create Playlist in Backend
      const res = await adminFetch(`${process.env.NEXT_PUBLIC_API_URL}/playlists`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newPlaylist.name,
          description: newPlaylist.description,
          coverImageKey: uploadDataCover.filePath,
          bannerImageKey: uploadDataBanner.filePath,
        }),
      });
      
      const resData = await res.json();
      if (res.ok) {
        setIsCreateModalOpen(false);
        setNewPlaylist({ name: "", description: "", coverImage: null, bannerImage: null });
        fetchPlaylists();
      } else {
        throw new Error(resData.message || "Failed to create playlist");
      }
    } catch (err: any) {
      alert(err.message || "Failed to create playlist");
    } finally {
      setCreating(false);
    }
  };

  const addSongToPlaylist = async (songId: string) => {
    if (!selectedPlaylist) return;
    try {
      await adminFetch(`${process.env.NEXT_PUBLIC_API_URL}/playlists/songs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playlistId: selectedPlaylist.id, songId }),
      });
      fetchPlaylistSongs(selectedPlaylist.id);
    } catch (err) {
      alert("Failed to add song");
    }
  };

  const removeSongFromPlaylist = async (songId: string) => {
    if (!selectedPlaylist) return;
    try {
      await adminFetch(`${process.env.NEXT_PUBLIC_API_URL}/playlists/songs`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playlistId: selectedPlaylist.id, songId }),
      });
      fetchPlaylistSongs(selectedPlaylist.id);
    } catch (err) {
      alert("Failed to remove song");
    }
  };

  const handleDeletePlaylist = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete the playlist "${name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const res = await adminFetch(`${process.env.NEXT_PUBLIC_API_URL}/playlists/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setSelectedPlaylist(null);
        fetchPlaylists();
      } else {
        const data = await res.json();
        alert(data.message || "Failed to delete playlist");
      }
    } catch (err) {
      alert("Failed to delete playlist");
    }
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">Music Playlists</h1>
          <p className="text-zinc-500 mt-1">Curate and manage system playlists.</p>
        </div>
        <button 
          onClick={() => setIsCreateModalOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0h-3m-9-4h18c1.105 0 2 .895 2 2v6c0 1.105-.895 2-2 2H3c-1.105 0-2-.895-2-2v-6c0-1.105.895-2 2-2z" />
          </svg>
          Create New Playlist
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Playlist List */}
        <div className="lg:col-span-1 space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-500 ml-2">All Playlists</h2>
          {loading ? (
            <div className="p-8 text-center text-zinc-500">Loading...</div>
          ) : playlists.length === 0 ? (
             <div className="p-8 text-center text-zinc-500">No playlists found.</div>
          ) : (
            playlists.map((pl) => (
              <button
                key={pl.id}
                onClick={() => { setSelectedPlaylist(pl); fetchPlaylistSongs(pl.id); }}
                className={`w-full text-left p-4 rounded-3xl border transition-all flex items-center gap-4 ${
                  selectedPlaylist?.id === pl.id 
                    ? "bg-indigo-600 border-indigo-600 text-white shadow-xl shadow-indigo-500/20" 
                    : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white hover:border-indigo-400 shadow-sm"
                }`}
              >
                <div className="w-16 h-16 rounded-2xl bg-zinc-100 dark:bg-zinc-800 shrink-0 overflow-hidden shadow-inner flex items-center justify-center">
                  {pl.coverImageKey && (
                    <img 
                      src={getImageUrl(pl.coverImageKey, { width: 200, height: 200, focus: "auto", aspectRatio: "1-1" })} 
                      alt={pl.name} 
                      className="w-full h-full object-cover" 
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-lg mb-0.5 truncate">{pl.name}</div>
                  <p className={`text-xs line-clamp-2 ${selectedPlaylist?.id === pl.id ? "text-indigo-100" : "text-zinc-500"}`}>{pl.description}</p>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Playlist Editor */}
        <div className="lg:col-span-2">
          {selectedPlaylist ? (
            <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-8 shadow-sm h-full flex flex-col">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h3 className="text-2xl font-bold text-zinc-900 dark:text-white">{selectedPlaylist.name}</h3>
                  <p className="text-zinc-500">{selectedPlaylist.description}</p>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => handleDeletePlaylist(selectedPlaylist.id, selectedPlaylist.name)} 
                    className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all"
                    title="Delete Playlist"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <title>Delete Playlist</title>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                  <button onClick={() => setSelectedPlaylist(null)} className="p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-all">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8 flex-1">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-4">Current Songs</h4>
                  <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                    {Array.isArray(playlistSongs) && playlistSongs.map(song => (
                      <div key={song.id} className="flex justify-between items-center p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 group">
                        <span className="font-medium text-zinc-900 dark:text-zinc-100">{song.title}</span>
                        <button onClick={() => removeSongFromPlaylist(song.id)} className="text-zinc-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7" />
                          </svg>
                        </button>
                      </div>
                    ))}
                    {(!playlistSongs || playlistSongs.length === 0) && <div className="text-sm text-zinc-400 italic p-4 text-center border-2 border-dashed border-zinc-100 dark:border-zinc-800 rounded-2xl">Empty</div>}
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-4">Add Tracks</h4>
                  <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                    {availableSongs.filter(s => !playlistSongs.find(ps => ps.id === s.id)).map(song => (
                      <button 
                        key={song.id} 
                        onClick={() => addSongToPlaylist(song.id)}
                        className="w-full text-left p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 hover:border-indigo-500 hover:shadow-md transition-all flex justify-between items-center group"
                      >
                        <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">{song.title}</span>
                        <svg className="w-4 h-4 text-indigo-500 opacity-0 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl text-zinc-500 p-20">
              Select a playlist from the left to view tracks or manage content.
            </div>
          )}
        </div>
      </div>

      {/* Create Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-sm rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            <div className="p-8 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
              <h2 className="text-xl font-bold">New Playlist</h2>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-zinc-400 hover:text-zinc-900"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <div className="p-8 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-500 uppercase ml-2">Playlist Name</label>
                <input value={newPlaylist.name} onChange={e => setNewPlaylist({...newPlaylist, name: e.target.value})} placeholder="Top Hits..." className="w-full bg-zinc-50 dark:bg-zinc-800 rounded-2xl p-4 focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-500 uppercase ml-2">Description</label>
                <textarea value={newPlaylist.description} onChange={e => setNewPlaylist({...newPlaylist, description: e.target.value})} placeholder="The best of..." rows={2} className="w-full bg-zinc-50 dark:bg-zinc-800 rounded-2xl p-4 focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-500 uppercase ml-2">Cover Image</label>
                  <input type="file" accept="image/*" onChange={e => setNewPlaylist({...newPlaylist, coverImage: e.target.files?.[0] || null})} className="w-full text-xs text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-indigo-50 file:text-indigo-600" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-500 uppercase ml-2">Banner Image</label>
                  <input type="file" accept="image/*" onChange={e => setNewPlaylist({...newPlaylist, bannerImage: e.target.files?.[0] || null})} className="w-full text-xs text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-indigo-50 file:text-indigo-600" />
                </div>
              </div>
              <button disabled={creating} onClick={handleCreatePlaylist} className={`w-full py-4 rounded-2xl font-bold text-white shadow-lg transition-all ${creating ? "bg-indigo-400" : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20"}`}>
                {creating ? "Creating..." : "Create Playlist"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
