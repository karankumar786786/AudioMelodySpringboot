"use client";

import { useEffect, useState, useRef } from "react";
import { getImageUrl } from "@/lib/image-utils";
import { adminFetch } from "@/lib/adminFetch";
import { Loader2, Sparkles, FolderPlus, Trash2, Plus, Video, Music } from "lucide-react";
import { Toast, ToastType } from "@/components/Toast";

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
  const [createProgressText, setCreateProgressText] = useState("");
  const [createStep, setCreateStep] = useState(0); // 1: Cover, 2: Video, 3: Finalize
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [removingVideo, setRemovingVideo] = useState(false);
  const [deletingPlaylistId, setDeletingPlaylistId] = useState<string | null>(null);
  const [addingSong, setAddingSong] = useState(false);
  const [removingSongId, setRemovingSongId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const hasFetchedRef = useRef(false);

  const showToast = (message: string, type: ToastType = "info") => {
    setToast({ message, type });
  };

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
    if (!newPlaylist.name.trim()) {
      showToast("Please enter a playlist name", "error");
      return;
    }
    if (!newPlaylist.coverImage) {
      showToast("Please select a cover image", "error");
      return;
    }

    setCreating(true);
    setCreateStep(1);
    setCreateProgressText("Uploading cover artwork to ImageKit CDN...");
    try {
      // 1. Upload Cover Image
      const coverImageKey = await uploadToImageKit(newPlaylist.coverImage, "/playlists/covers");

      // 2. Upload Video (if provided)
      let videoKey: string | null = null;
      if (newPlaylist.videoFile) {
        setCreateStep(2);
        setCreateProgressText("Uploading background canvas video loop...");
        videoKey = await uploadToImageKit(newPlaylist.videoFile, "/playlists/videos");
      }

      // 3. Create Playlist in Backend
      setCreateStep(3);
      setCreateProgressText("Finalizing and registering playlist in database...");
      const res = await adminFetch("/admin/playlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newPlaylist.name.trim(),
          description: newPlaylist.description.trim(),
          coverImageKey,
          videoKey,
        }),
      });

      if (res.ok) {
        setIsCreateModalOpen(false);
        setNewPlaylist({ name: "", description: "", coverImage: null, videoFile: null });
        showToast("Playlist created successfully!", "success");
        fetchPlaylists();
      } else {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.message || "Failed to create playlist");
      }
    } catch (err: any) {
      showToast(err.message || "An error occurred while creating playlist", "error");
    } finally {
      setCreating(false);
      setCreateStep(0);
      setCreateProgressText("");
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
        showToast("Video canvas attached successfully!", "success");
      } else {
        throw new Error("Failed to attach video to playlist");
      }
    } catch (err: any) {
      showToast("Video upload failed: " + (err.message || "Unknown error"), "error");
    } finally {
      setUploadingVideo(false);
      e.target.value = "";
    }
  };

  const handleRemoveVideoFromPlaylist = async () => {
    if (!selectedPlaylist || !selectedPlaylist.videoKey) return;
    if (!confirm("Are you sure you want to remove the video canvas from this playlist?")) return;

    setRemovingVideo(true);
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
        showToast("Video canvas removed and deleted from ImageKit", "success");
      } else {
        throw new Error("Failed to remove video");
      }
    } catch (err: any) {
      showToast("Failed to remove video: " + (err.message || "Unknown error"), "error");
    } finally {
      setRemovingVideo(false);
    }
  };

  const handleDeletePlaylist = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete playlist "${name}"?`)) return;
    setDeletingPlaylistId(id);
    try {
      const res = await adminFetch(`/admin/playlist/${id}`, { method: "DELETE" });
      if (res.ok) {
        setPlaylists((prev) => prev.filter((p) => p.id !== id));
        if (selectedPlaylist?.id === id) setSelectedPlaylist(null);
        showToast(`Playlist "${name}" deleted successfully`, "success");
      } else {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || "Delete failed");
      }
    } catch (err: any) {
      showToast(err.message || "Failed to delete playlist", "error");
    } finally {
      setDeletingPlaylistId(null);
    }
  };

  const handleAddSongToPlaylist = async (songId: string) => {
    if (!selectedPlaylist || !songId) return;
    const song = availableSongs.find(s => s.id === songId);
    setAddingSong(true);
    try {
      const res = await adminFetch(`/admin/playlist/${selectedPlaylist.id}/songs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ songId }),
      });
      if (res.ok) {
        await fetchPlaylistSongs(selectedPlaylist.id);
        showToast(`Added "${song?.title || "track"}" to playlist`, "success");
      } else {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || "Failed to add song");
      }
    } catch (err: any) {
      showToast(err.message || "Error adding song to playlist", "error");
    } finally {
      setAddingSong(false);
    }
  };

  const handleRemoveSongFromPlaylist = async (songId: string, songTitle?: string) => {
    if (!selectedPlaylist) return;
    setRemovingSongId(songId);
    try {
      const res = await adminFetch(`/admin/playlist/${selectedPlaylist.id}/songs/${songId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setPlaylistSongs((prev) => prev.filter((s) => s.id !== songId));
        showToast(`Removed "${songTitle || "track"}" from playlist`, "success");
      } else {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || "Failed to remove song");
      }
    } catch (err: any) {
      showToast(err.message || "Error removing song", "error");
    } finally {
      setRemovingSongId(null);
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
            Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="p-5 rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 animate-pulse flex items-center gap-4"
              >
                <div className="w-16 h-16 rounded-2xl bg-zinc-200 dark:bg-zinc-800 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 bg-zinc-200 dark:bg-zinc-800 rounded-md" />
                  <div className="h-3 w-44 bg-zinc-100 dark:bg-zinc-800/60 rounded-md" />
                </div>
              </div>
            ))
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
                    handleDeletePlaylist(playlist.id, playlist.name);
                  }}
                  disabled={deletingPlaylistId === playlist.id}
                  className={`p-2 rounded-xl transition-all ${
                    deletingPlaylistId === playlist.id
                      ? "text-red-500 bg-red-50 dark:bg-red-950/40 cursor-wait"
                      : "text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                  }`}
                  title="Delete playlist"
                >
                  {deletingPlaylistId === playlist.id ? (
                    <Loader2 className="w-5 h-5 animate-spin text-red-500" />
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  )}
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
                        disabled={uploadingVideo || removingVideo}
                        className="bg-red-50 dark:bg-red-950/40 hover:bg-red-100 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/40 px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {removingVideo ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Removing...</span>
                          </>
                        ) : (
                          <>
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            <span>Remove Video</span>
                          </>
                        )}
                      </button>
                    )}
                    <label className={`cursor-pointer bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 px-4 py-2 rounded-xl text-xs font-bold text-zinc-700 dark:text-zinc-200 transition-all flex items-center gap-2 ${
                      uploadingVideo ? "opacity-75 cursor-wait" : ""
                    }`}>
                      {uploadingVideo ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
                          <span>Uploading Video...</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                          </svg>
                          <span>{selectedPlaylist.videoKey ? "Replace Video" : "Attach Video"}</span>
                        </>
                      )}
                      <input 
                        type="file" 
                        accept="video/mp4,video/*" 
                        onChange={handleAttachVideoToPlaylist} 
                        disabled={uploadingVideo || removingVideo}
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
                    disabled={addingSong}
                    className="flex-1 bg-zinc-50 dark:bg-zinc-800 border-none rounded-2xl p-4 text-sm focus:ring-2 focus:ring-orange-500 disabled:opacity-50"
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
                        const val = select.value;
                        handleAddSongToPlaylist(val).then(() => {
                          select.value = "";
                        });
                      }
                    }}
                    disabled={addingSong}
                    className={`bg-orange-600 hover:bg-orange-700 text-white px-6 rounded-2xl font-bold text-sm transition-all flex items-center gap-2 shrink-0 ${
                      addingSong ? "opacity-75 cursor-not-allowed" : "active:scale-95"
                    }`}
                  >
                    {addingSong ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Adding...</span>
                      </>
                    ) : (
                      "Add"
                    )}
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
                          onClick={() => handleRemoveSongFromPlaylist(song.id, song.title)}
                          disabled={removingSongId === song.id}
                          className={`text-xs font-bold transition-all flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${
                            removingSongId === song.id 
                              ? "text-zinc-400 bg-zinc-100 dark:bg-zinc-800 cursor-wait" 
                              : "text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                          }`}
                        >
                          {removingSongId === song.id ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Removing...</span>
                            </>
                          ) : (
                            "Remove"
                          )}
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-xl rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden relative">
            {/* Creating Overlay with Animated Spinner and Steps */}
            {creating && (
              <div className="absolute inset-0 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md rounded-3xl z-30 flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-200">
                <div className="relative mb-6">
                  <div className="w-18 h-18 rounded-full border-4 border-orange-100 dark:border-orange-950 border-t-orange-500 animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Sparkles className="w-7 h-7 text-orange-500 animate-pulse" />
                  </div>
                </div>
                <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-1.5">
                  Creating Playlist
                </h3>
                <p className="text-sm font-semibold text-orange-600 dark:text-orange-400 font-mono mb-6 max-w-sm">
                  {createProgressText || "Transferring playlist media..."}
                </p>

                {/* Step indicator badges */}
                <div className="grid grid-cols-3 gap-2.5 w-full max-w-md">
                  <div className={`p-2.5 rounded-xl border text-left text-xs transition-all ${
                    createStep >= 1 
                      ? "bg-orange-50 dark:bg-orange-950/50 border-orange-300 dark:border-orange-800 text-orange-700 dark:text-orange-300 font-semibold" 
                      : "bg-zinc-100 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-700/50 text-zinc-400"
                  }`}>
                    <div className="flex items-center gap-1 font-bold text-[11px] mb-0.5">
                      {createStep > 1 ? (
                        <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[9px]">✓</span>
                      ) : (
                        <span className="w-3.5 h-3.5 rounded-full bg-orange-600 text-white flex items-center justify-center text-[9px]">1</span>
                      )}
                      <span>Cover Artwork</span>
                    </div>
                    <span className="text-[10px] opacity-75">ImageKit CDN</span>
                  </div>

                  <div className={`p-2.5 rounded-xl border text-left text-xs transition-all ${
                    !newPlaylist.videoFile 
                      ? "opacity-40 bg-zinc-50 dark:bg-zinc-800/20 border-zinc-200 dark:border-zinc-800 text-zinc-400"
                      : createStep >= 2 
                        ? "bg-orange-50 dark:bg-orange-950/50 border-orange-300 dark:border-orange-800 text-orange-700 dark:text-orange-300 font-semibold" 
                        : "bg-zinc-100 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-700/50 text-zinc-400"
                  }`}>
                    <div className="flex items-center gap-1 font-bold text-[11px] mb-0.5">
                      {createStep > 2 ? (
                        <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[9px]">✓</span>
                      ) : (
                        <span className="w-3.5 h-3.5 rounded-full bg-orange-600 text-white flex items-center justify-center text-[9px]">2</span>
                      )}
                      <span>Video Loop</span>
                    </div>
                    <span className="text-[10px] opacity-75">{newPlaylist.videoFile ? "Canvas video" : "Optional"}</span>
                  </div>

                  <div className={`p-2.5 rounded-xl border text-left text-xs transition-all ${
                    createStep >= 3 
                      ? "bg-orange-50 dark:bg-orange-950/50 border-orange-300 dark:border-orange-800 text-orange-700 dark:text-orange-300 font-semibold" 
                      : "bg-zinc-100 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-700/50 text-zinc-400"
                  }`}>
                    <div className="flex items-center gap-1 font-bold text-[11px] mb-0.5">
                      <span className="w-3.5 h-3.5 rounded-full bg-orange-600 text-white flex items-center justify-center text-[9px]">3</span>
                      <span>Save Playlist</span>
                    </div>
                    <span className="text-[10px] opacity-75">Database register</span>
                  </div>
                </div>
              </div>
            )}

            <div className="p-8 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-800/50">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Create New Playlist</h2>
              <button 
                onClick={() => !creating && setIsCreateModalOpen(false)} 
                disabled={creating}
                className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white p-1 rounded-lg transition-all disabled:opacity-30"
              >
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
                  disabled={creating}
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border-none rounded-2xl p-4 focus:ring-2 focus:ring-orange-500 disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2 uppercase tracking-wider">Description</label>
                <textarea 
                  rows={2}
                  value={newPlaylist.description}
                  onChange={(e) => setNewPlaylist({ ...newPlaylist, description: e.target.value })}
                  placeholder="Brief description..."
                  disabled={creating}
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border-none rounded-2xl p-4 focus:ring-2 focus:ring-orange-500 disabled:opacity-50"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2 uppercase tracking-wider">Cover Image</label>
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={(e) => setNewPlaylist({ ...newPlaylist, coverImage: e.target.files?.[0] || null })}
                    disabled={creating}
                    className="w-full text-xs text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-orange-50 file:text-orange-600 disabled:opacity-50"
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
                    disabled={creating}
                    className="w-full text-xs text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-600 disabled:opacity-50"
                  />
                </div>
              </div>

              <button 
                onClick={handleCreatePlaylist}
                disabled={creating}
                className={`w-full py-4 mt-6 rounded-2xl font-bold text-white shadow-lg flex items-center justify-center gap-3 transition-all ${
                  creating 
                    ? "bg-orange-400 cursor-not-allowed" 
                    : "bg-orange-600 hover:bg-orange-700 active:scale-[0.99] shadow-orange-500/20"
                }`}
              >
                {creating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>{createProgressText || "Creating Playlist..."}</span>
                  </>
                ) : (
                  "Save Playlist"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}

