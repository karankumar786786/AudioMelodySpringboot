"use client";

import { useEffect, useState, useRef } from "react";
import { getImageUrl } from "@/lib/image-utils";
import { adminFetch } from "@/lib/adminFetch";

interface Playlist {
  id: string;
  name: string;
  description: string;
  coverImageKey: string;
  videoKey?: string;
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
    videoFile: null as File | null,
  });
  const [creating, setCreating] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const hasFetchedRef = useRef(false);

  const fetchPlaylists = async () => {
    try {
      setLoading(true);
      const res = await adminFetch("/admin/playlist?page=0&size=100");
      if (res.ok) {
        const data = await res.json();
        setPlaylists(data.content || data.data?.content || data.data || []);
      }
    } catch (err) {
      console.error("fetchPlaylists error:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPlaylistSongs = async (id: string) => {
    try {
      const res = await adminFetch(`/admin/playlist/${id}/songs`);
      if (res.ok) {
        const data = await res.json();
        const songs = data.content || data.data?.content || (Array.isArray(data.data) ? data.data : []);
        setPlaylistSongs(songs);
      }
    } catch (err) {
      console.error("Failed to fetch playlist songs:", err);
    }
  };

  const fetchAllSongs = async () => {
    try {
      const res = await adminFetch("/admin/song?page=0&size=100");
      if (res.ok) {
        const data = await res.json();
        setAvailableSongs(data.content || data.data?.content || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    fetchPlaylists();
    fetchAllSongs();
  }, []);

  const uploadToImageKit = async (file: File, folder: string) => {
    const sigRes = await adminFetch("/webhook/internal/image-upload-param");
    if (!sigRes.ok) throw new Error("Failed to get upload signature");
    const sigData = await sigRes.json();

    const fd = new FormData();
    fd.append("file", file);
    fd.append("publicKey", process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY || "public_ck50bJ3UfF9eCOXhwXQTQFP693o=");
    fd.append("signature", sigData.param.signature);
    fd.append("expire", sigData.param.expire.toString());
    fd.append("token", sigData.param.token);
    fd.append("folder", folder);
    const ext = file.name.split('.').pop();
    fd.append("fileName", `${sigData.key}.${ext}`);

    const res = await fetch("https://upload.imagekit.io/api/v1/files/upload", {
      method: "POST",
      body: fd,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "File upload failed");
    return data.filePath || sigData.key;
  };

  const handleCreatePlaylist = async () => {
    if (!newPlaylist.name) return alert("Please enter a name");
    if (!newPlaylist.coverImage) return alert("Please select a cover image");

    setCreating(true);
    try {
      // 1. Upload Cover Image
      const coverImageKey = await uploadToImageKit(newPlaylist.coverImage, "/playlists/covers");

      // 2. Upload Video (if provided)
      let videoKey: string | null = null;
      if (newPlaylist.videoFile) {
        videoKey = await uploadToImageKit(newPlaylist.videoFile, "/playlists/videos");
      }

      // 3. Create Playlist in Backend
      const res = await adminFetch("/admin/playlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newPlaylist.name,
          description: newPlaylist.description,
          coverImageKey,
          videoKey,
        }),
      });

      if (res.ok) {
        setIsCreateModalOpen(false);
        setNewPlaylist({ name: "", description: "", coverImage: null, videoFile: null });
        fetchPlaylists();
      } else {
        const errData = await res.json();
        throw new Error(errData.message || "Failed to create playlist");
      }
    } catch (err: any) {
      alert(err.message || "An error occurred");
    } finally {
      setCreating(false);
    }
  };

  const handleAttachVideoToPlaylist = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedPlaylist) return;

    setUploadingVideo(true);
    try {
      const videoKey = await uploadToImageKit(file, "/playlists/videos");
      const res = await adminFetch(`/admin/playlist/${selectedPlaylist.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoKey,
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        setSelectedPlaylist(updated);
        setPlaylists(playlists.map(p => p.id === updated.id ? updated : p));
        alert("Video attached successfully!");
      } else {
        alert("Failed to attach video");
      }
    } catch (err: any) {
      alert("Video upload failed: " + err.message);
    } finally {
      setUploadingVideo(false);
    }
  };

  const handleRemoveVideoFromPlaylist = async () => {
    if (!selectedPlaylist || !selectedPlaylist.videoKey) return;
    if (!confirm("Are you sure you want to remove the video canvas from this playlist?")) return;

    setUploadingVideo(true);
    try {
      const res = await adminFetch(`/admin/playlist/${selectedPlaylist.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoKey: "", // Clears videoKey in DB & deletes from ImageKit
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        setSelectedPlaylist(updated);
        setPlaylists(playlists.map(p => p.id === updated.id ? updated : p));
        alert("Video canvas removed and deleted from ImageKit.");
      } else {
        alert("Failed to remove video");
      }
    } catch (err: any) {
      alert("Failed to remove video: " + err.message);
    } finally {
      setUploadingVideo(false);
    }
  };

  const handleDeletePlaylist = async (id: string) => {
    if (!confirm("Are you sure you want to delete this playlist?")) return;
    try {
      const res = await adminFetch(`/admin/playlist/${id}`, { method: "DELETE" });
      if (res.ok) {
        setPlaylists(playlists.filter((p) => p.id !== id));
        if (selectedPlaylist?.id === id) setSelectedPlaylist(null);
      }
    } catch (err) {
      alert("Delete failed");
    }
  };

  const handleAddSongToPlaylist = async (songId: string) => {
    if (!selectedPlaylist) return;
    try {
      const res = await adminFetch(`/admin/playlist/${selectedPlaylist.id}/songs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ songId }),
      });
      if (res.ok) {
        fetchPlaylistSongs(selectedPlaylist.id);
      } else {
        alert("Failed to add song");
      }
    } catch (err) {
      alert("Error adding song");
    }
  };

  const handleRemoveSongFromPlaylist = async (songId: string) => {
    if (!selectedPlaylist) return;
    try {
      const res = await adminFetch(`/admin/playlist/${selectedPlaylist.id}/songs/${songId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setPlaylistSongs(playlistSongs.filter((s) => s.id !== songId));
      } else {
        alert("Failed to remove song");
      }
    } catch (err) {
      alert("Error removing song");
    }
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">Curated Playlists</h1>
          <p className="text-zinc-500 mt-1">Manage public playlists, background videos, and track composition.</p>
        </div>
        <button 
          onClick={() => setIsCreateModalOpen(true)}
          className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-orange-500/20 transition-all active:scale-95 flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Playlist
        </button>
      </div>

      {/* Main Grid: Playlists & Detail View */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Playlists List */}
        <div className="lg:col-span-1 space-y-4">
          {loading ? (
            <div className="p-12 text-center text-zinc-500 animate-pulse bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800">
              Loading playlists...
            </div>
          ) : playlists.length === 0 ? (
            <div className="p-12 text-center text-zinc-500 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800">
              No playlists found.
            </div>
          ) : (
            playlists.map((playlist) => (
              <div 
                key={playlist.id} 
                onClick={() => {
                  setSelectedPlaylist(playlist);
                  fetchPlaylistSongs(playlist.id);
                }}
                className={`p-5 rounded-3xl border transition-all cursor-pointer flex items-center gap-4 ${
                  selectedPlaylist?.id === playlist.id 
                    ? "bg-orange-50 dark:bg-orange-950/20 border-orange-500 shadow-md" 
                    : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
                }`}
              >
                <div className="w-16 h-16 rounded-2xl bg-zinc-200 dark:bg-zinc-800 overflow-hidden shrink-0">
                  {playlist.coverImageKey ? (
                    <img 
                      src={getImageUrl(playlist.coverImageKey, { width: 150, height: 150, focus: "auto", aspectRatio: "1-1" })} 
                      alt={playlist.name} 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-400 font-bold">
                      {playlist.name[0]}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-zinc-900 dark:text-white truncate">{playlist.name}</h3>
                    {playlist.videoKey && (
                      <span className="shrink-0 w-2 h-2 rounded-full bg-emerald-500" title="Video attached" />
                    )}
                  </div>
                  <p className="text-xs text-zinc-500 truncate mt-0.5">{playlist.description || "No description."}</p>
                </div>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeletePlaylist(playlist.id);
                  }}
                  className="p-2 text-zinc-400 hover:text-red-500 rounded-lg transition-all"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>

        {/* Selected Playlist Songs Manager */}
        <div className="lg:col-span-2">
          {selectedPlaylist ? (
            <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-8 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 border-b border-zinc-100 dark:border-zinc-800 pb-6">
                <div className="flex items-center gap-6">
                  <div className="w-24 h-24 rounded-2xl bg-zinc-200 dark:bg-zinc-800 overflow-hidden shrink-0 shadow-lg">
                    {selectedPlaylist.coverImageKey && (
                      <img 
                        src={getImageUrl(selectedPlaylist.coverImageKey, { width: 200, height: 200, focus: "auto", aspectRatio: "1-1" })} 
                        alt={selectedPlaylist.name} 
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  <div>
                    <span className="text-xs font-bold text-orange-500 uppercase tracking-widest">Playlist Detail</span>
                    <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mt-1">{selectedPlaylist.name}</h2>
                    <p className="text-sm text-zinc-500 mt-1">{selectedPlaylist.description}</p>
                  </div>
                </div>

                {/* Video Canvas Upload / Remove / Indicator */}
                <div className="flex flex-col items-end gap-2">
                  <div className="flex items-center gap-2">
                    {selectedPlaylist.videoKey && (
                      <button
                        type="button"
                        onClick={handleRemoveVideoFromPlaylist}
                        disabled={uploadingVideo}
                        className="bg-red-50 dark:bg-red-950/40 hover:bg-red-100 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/40 px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                      >
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        Remove Video
                      </button>
                    )}
                    <label className="cursor-pointer bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 px-4 py-2 rounded-xl text-xs font-bold text-zinc-700 dark:text-zinc-200 transition-all flex items-center gap-2">
                      <svg className="w-4 h-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                      </svg>
                      {uploadingVideo ? "Uploading..." : selectedPlaylist.videoKey ? "Replace Video" : "Attach Video"}
                      <input 
                        type="file" 
                        accept="video/mp4,video/*" 
                        onChange={handleAttachVideoToPlaylist} 
                        disabled={uploadingVideo}
                        className="hidden" 
                      />
                    </label>
                  </div>
                  {selectedPlaylist.videoKey && (
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono truncate max-w-[220px]">
                      Canvas: {selectedPlaylist.videoKey}
                    </span>
                  )}
                </div>
              </div>

              {/* Add Song Selector */}
              <div>
                <h4 className="text-sm font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-3">Add Track to Playlist</h4>
                <div className="flex gap-2">
                  <select 
                    id="songSelect"
                    className="flex-1 bg-zinc-50 dark:bg-zinc-800 border-none rounded-2xl p-4 text-sm focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="">Select a track to add...</option>
                    {availableSongs
                      .filter((s) => !playlistSongs.some((ps) => ps.id === s.id))
                      .map((s) => (
                        <option key={s.id} value={s.id}>{s.title}</option>
                      ))}
                  </select>
                  <button 
                    onClick={() => {
                      const select = document.getElementById("songSelect") as HTMLSelectElement;
                      if (select && select.value) {
                        handleAddSongToPlaylist(select.value);
                        select.value = "";
                      }
                    }}
                    className="bg-orange-600 hover:bg-orange-700 text-white px-6 rounded-2xl font-bold text-sm transition-all"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Current Songs */}
              <div>
                <h4 className="text-sm font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-3">Current Tracks ({playlistSongs.length})</h4>
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800 border border-zinc-100 dark:border-zinc-800 rounded-2xl overflow-hidden">
                  {playlistSongs.length === 0 ? (
                    <div className="p-8 text-center text-zinc-500 text-sm">No tracks in this playlist yet.</div>
                  ) : (
                    playlistSongs.map((song) => (
                      <div key={song.id} className="p-4 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                        <span className="font-medium text-zinc-900 dark:text-white text-sm">{song.title}</span>
                        <button 
                          onClick={() => handleRemoveSongFromPlaylist(song.id)}
                          className="text-xs text-red-500 hover:underline font-bold"
                        >
                          Remove
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-12 text-center text-zinc-400">
              Select a playlist from the left to view and manage its tracks.
            </div>
          )}
        </div>
      </div>

      {/* Create Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-xl rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            <div className="p-8 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-800/50">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Create New Playlist</h2>
              <button onClick={() => !creating && setIsCreateModalOpen(false)} className="text-zinc-400 hover:text-zinc-900">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-8 space-y-4">
              <div>
                <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2 uppercase tracking-wider">Playlist Title</label>
                <input 
                  type="text" 
                  value={newPlaylist.name}
                  onChange={(e) => setNewPlaylist({ ...newPlaylist, name: e.target.value })}
                  placeholder="e.g. Top Hits 2026"
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border-none rounded-2xl p-4 focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2 uppercase tracking-wider">Description</label>
                <textarea 
                  rows={2}
                  value={newPlaylist.description}
                  onChange={(e) => setNewPlaylist({ ...newPlaylist, description: e.target.value })}
                  placeholder="Brief description..."
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border-none rounded-2xl p-4 focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2 uppercase tracking-wider">Cover Image</label>
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={(e) => setNewPlaylist({ ...newPlaylist, coverImage: e.target.files?.[0] || null })}
                    className="w-full text-xs text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-orange-50 file:text-orange-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2 uppercase tracking-wider">
                    Background Video <span className="text-zinc-400 font-normal lowercase">(optional)</span>
                  </label>
                  <input 
                    type="file" 
                    accept="video/mp4,video/*"
                    onChange={(e) => setNewPlaylist({ ...newPlaylist, videoFile: e.target.files?.[0] || null })}
                    className="w-full text-xs text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-600"
                  />
                </div>
              </div>

              <button 
                onClick={handleCreatePlaylist}
                disabled={creating}
                className={`w-full py-4 mt-6 rounded-2xl font-bold text-white shadow-lg flex items-center justify-center gap-3 ${creating ? "bg-orange-400" : "bg-orange-600 hover:bg-orange-700"}`}
              >
                {creating ? "Creating..." : "Save Playlist"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
