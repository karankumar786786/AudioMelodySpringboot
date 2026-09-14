"use client";

import { useEffect, useState, useRef } from "react";
import { getImageUrl } from "@/lib/image-utils";
import { adminFetch } from "@/lib/adminFetch";
import { Loader2, Sparkles, FolderPlus, Trash2, Plus, Video, Music } from "lucide-react";
import { Toast, ToastType } from "@/components/Toast";
import { UploadProgressBar } from "@/components/UploadProgressBar";
import { uploadToImageKitWithProgress } from "@/lib/upload-utils";

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
  const [createStep, setCreateStep] = useState(0);
  const [createProgressText, setCreateProgressText] = useState("");
  const [uploadPercent, setUploadPercent] = useState<number | null>(null);
  const [uploadStats, setUploadStats] = useState<{ loadedText?: string; speedText?: string }>({});
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
    setUploadPercent(0);
    setUploadStats({});
    setCreateProgressText("Uploading cover artwork to ImageKit CDN...");
    try {
      // 1. Upload Cover Image with real-time progress
      const coverImageKey = await uploadToImageKitWithProgress(
        newPlaylist.coverImage,
        "/playlists/covers",
        (p) => {
          setUploadPercent(p.percent);
          setUploadStats({
            loadedText: `${p.loadedFormatted} / ${p.totalFormatted}`,
            speedText: p.speedText,
          });
        }
      );

      // 2. Upload Video (if provided)
      let videoKey: string | null = null;
      if (newPlaylist.videoFile) {
        setCreateStep(2);
        setUploadPercent(0);
        setCreateProgressText("Uploading background canvas video loop...");
        videoKey = await uploadToImageKitWithProgress(
          newPlaylist.videoFile,
          "/playlists/videos",
          (p) => {
            setUploadPercent(p.percent);
            setUploadStats({
              loadedText: `${p.loadedFormatted} / ${p.totalFormatted}`,
              speedText: p.speedText,
            });
          }
        );
      }

      // 3. Create Playlist in Backend
      setCreateStep(3);
      setUploadPercent(100);
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
        showToast("Playlist created successfully!", "success");
        setIsCreateModalOpen(false);
        setNewPlaylist({ name: "", description: "", coverImage: null, videoFile: null });
        fetchPlaylists();
      } else {
        const err = await res.json();
        showToast(err.message || "Failed to create playlist", "error");
      }
    } catch (err: any) {
      showToast(err.message || "Failed to create playlist", "error");
    } finally {
      setCreating(false);
      setCreateStep(0);
      setUploadPercent(null);
      setUploadStats({});
      setCreateProgressText("");
    }
  };

  const handleAttachVideoToPlaylist = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedPlaylist) return;

    setUploadingVideo(true);
    try {
      const videoKey = await uploadToImageKitWithProgress(file, "/playlists/videos");
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
          <h1 className="text-3xl font-bold text-white">Curated Playlists</h1>
          <p className="text-zinc-400 mt-1">Manage public playlists, background videos, and track composition.</p>
        </div>
        <button 
          onClick={() => setIsCreateModalOpen(true)}
          className="bg-white hover:bg-zinc-200 text-black px-6 py-3 rounded-full font-bold transition-all active:scale-95 flex items-center gap-2 shadow-sm"
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
                className="p-5 rounded-3xl border border-[#282828] bg-[#121212] animate-pulse flex items-center gap-4"
              >
                <div className="w-16 h-16 rounded-2xl bg-zinc-800 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 bg-zinc-800 rounded-md" />
                  <div className="h-3 w-44 bg-zinc-800/60 rounded-md" />
                </div>
              </div>
            ))
          ) : playlists.length === 0 ? (
            <div className="p-12 text-center text-zinc-500 bg-[#121212] rounded-3xl border border-[#282828]">
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
                    ? "bg-[#181818] border-white shadow-lg" 
                    : "bg-[#121212] border-[#282828] hover:border-zinc-600"
                }`}
              >
                <div className="w-16 h-16 rounded-2xl bg-black/60 border border-[#282828] overflow-hidden shrink-0">
                  {playlist.coverImageKey ? (
                    <img 
                      src={getImageUrl(playlist.coverImageKey, { width: 150, height: 150, focus: "auto", aspectRatio: "1-1" })} 
                      alt={playlist.name} 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-500 font-bold">
                      {playlist.name[0]}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-white truncate">{playlist.name}</h3>
                    {playlist.videoKey && (
                      <span className="shrink-0 w-2 h-2 rounded-full bg-emerald-400" title="Video attached" />
                    )}
                  </div>
                  <p className="text-xs text-zinc-400 truncate mt-0.5">{playlist.description || "No description."}</p>
                </div>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeletePlaylist(playlist.id, playlist.name);
                  }}
                  disabled={deletingPlaylistId === playlist.id}
                  className={`p-2 rounded-xl transition-all ${
                    deletingPlaylistId === playlist.id
                      ? "text-rose-400 bg-rose-500/10 cursor-wait"
                      : "text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10"
                  }`}
                  title="Delete playlist"
                >
                  {deletingPlaylistId === playlist.id ? (
                    <Loader2 className="w-5 h-5 animate-spin text-rose-400" />
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
            <div className="bg-[#121212] rounded-3xl border border-[#282828] p-8 space-y-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 border-b border-[#282828] pb-6">
                <div className="flex items-center gap-6">
                  <div className="w-24 h-24 rounded-2xl bg-black/60 border border-[#282828] overflow-hidden shrink-0 shadow-lg">
                    {selectedPlaylist.coverImageKey && (
                      <img 
                        src={getImageUrl(selectedPlaylist.coverImageKey, { width: 200, height: 200, focus: "auto", aspectRatio: "1-1" })} 
                        alt={selectedPlaylist.name} 
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  <div>
                    <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Playlist Detail</span>
                    <h2 className="text-2xl font-bold text-white mt-1">{selectedPlaylist.name}</h2>
                    <p className="text-sm text-zinc-400 mt-1">{selectedPlaylist.description}</p>
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
                        className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 px-3 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-50"
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
                    <label className={`cursor-pointer bg-black/60 hover:bg-white hover:text-black border border-[#282828] text-zinc-300 px-4 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-2 ${
                      uploadingVideo ? "opacity-75 cursor-wait" : ""
                    }`}>
                      {uploadingVideo ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                          <span>Uploading Video...</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
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
                    <span className="text-[11px] text-emerald-400 font-mono truncate max-w-[220px]">
                      Canvas: {selectedPlaylist.videoKey}
                    </span>
                  )}
                </div>
              </div>

              {/* Add Song Selector */}
              <div>
                <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">Add Track to Playlist</h4>
                <div className="flex gap-2">
                  <select 
                    id="songSelect"
                    disabled={addingSong}
                    className="flex-1 bg-black/60 border border-[#282828] rounded-xl p-3.5 text-sm text-white focus:outline-none focus:border-zinc-400 disabled:opacity-50"
                  >
                    <option value="" className="bg-[#121212] text-zinc-400">Select a track to add...</option>
                    {availableSongs
                      .filter((s) => !playlistSongs.some((ps) => ps.id === s.id))
                      .map((s) => (
                        <option key={s.id} value={s.id} className="bg-[#121212] text-white">{s.title}</option>
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
                    className={`bg-white hover:bg-zinc-200 text-black px-6 rounded-full font-bold text-sm transition-all flex items-center gap-2 shrink-0 ${
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
                <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">Current Tracks ({playlistSongs.length})</h4>
                <div className="divide-y divide-[#282828] border border-[#282828] rounded-2xl overflow-hidden bg-black/40">
                  {playlistSongs.length === 0 ? (
                    <div className="p-8 text-center text-zinc-500 text-sm">No tracks in this playlist yet.</div>
                  ) : (
                    playlistSongs.map((song) => (
                      <div key={song.id} className="p-4 flex items-center justify-between hover:bg-zinc-800/30 transition-colors">
                        <span className="font-medium text-white text-sm">{song.title}</span>
                        <button 
                          onClick={() => handleRemoveSongFromPlaylist(song.id, song.title)}
                          disabled={removingSongId === song.id}
                          className={`text-xs font-bold transition-all flex items-center gap-1.5 px-3 py-1 rounded-full ${
                            removingSongId === song.id 
                              ? "text-zinc-500 bg-black/60 cursor-wait" 
                              : "text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10"
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
            <div className="bg-[#121212] rounded-3xl border border-[#282828] p-12 text-center text-zinc-500">
              Select a playlist from the left to view and manage its tracks.
            </div>
          )}
        </div>
      </div>

      {/* Create Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-[#121212] w-full max-w-xl rounded-3xl shadow-2xl border border-[#282828] overflow-hidden relative">
            {/* Creating Overlay with Animated Spinner and Steps */}
            {creating && (
              <div className="absolute inset-0 bg-[#121212]/95 backdrop-blur-md rounded-3xl z-30 flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-200">
                <div className="relative mb-6">
                  <div className="w-16 h-16 rounded-full border-4 border-zinc-700 border-t-white animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-white animate-pulse" />
                  </div>
                </div>
                <h3 className="text-xl font-bold text-white mb-1.5">
                  Creating Playlist
                </h3>
                <p className="text-sm font-semibold text-zinc-300 font-mono mb-6 max-w-sm">
                  {createProgressText || "Transferring playlist media..."}
                </p>

                {/* Step indicator badges */}
                <div className="grid grid-cols-3 gap-2.5 w-full max-w-md">
                  <div className={`p-2.5 rounded-xl border text-left text-xs transition-all ${
                    createStep >= 1 
                      ? "bg-black/80 border-white text-white font-semibold" 
                      : "bg-black/40 border-[#282828] text-zinc-500"
                  }`}>
                    <div className="flex items-center gap-1 font-bold text-[11px] mb-0.5">
                      {createStep > 1 ? (
                        <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[9px]">✓</span>
                      ) : (
                        <span className="w-3.5 h-3.5 rounded-full bg-white text-black flex items-center justify-center text-[9px]">1</span>
                      )}
                      <span>Cover Artwork</span>
                    </div>
                    <span className="text-[10px] opacity-75">ImageKit CDN</span>
                  </div>

                  <div className={`p-2.5 rounded-xl border text-left text-xs transition-all ${
                    !newPlaylist.videoFile 
                      ? "opacity-40 bg-black/20 border-[#282828] text-zinc-600"
                      : createStep >= 2 
                        ? "bg-black/80 border-white text-white font-semibold" 
                        : "bg-black/40 border-[#282828] text-zinc-500"
                  }`}>
                    <div className="flex items-center gap-1 font-bold text-[11px] mb-0.5">
                      {createStep > 2 ? (
                        <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[9px]">✓</span>
                      ) : (
                        <span className="w-3.5 h-3.5 rounded-full bg-white text-black flex items-center justify-center text-[9px]">2</span>
                      )}
                      <span>Video Loop</span>
                    </div>
                    <span className="text-[10px] opacity-75">{newPlaylist.videoFile ? "Canvas video" : "Optional"}</span>
                  </div>

                  <div className={`p-2.5 rounded-xl border text-left text-xs transition-all ${
                    createStep >= 3 
                      ? "bg-black/80 border-white text-white font-semibold" 
                      : "bg-black/40 border-[#282828] text-zinc-500"
                  }`}>
                    <div className="flex items-center gap-1 font-bold text-[11px] mb-0.5">
                      <span className="w-3.5 h-3.5 rounded-full bg-white text-black flex items-center justify-center text-[9px]">3</span>
                      <span>Save Playlist</span>
                    </div>
                    <span className="text-[10px] opacity-75">Database register</span>
                  </div>
                </div>
              </div>
            )}

            <div className="p-6 border-b border-[#282828] flex justify-between items-center bg-black/40">
              <h2 className="text-lg font-bold text-white">Create New Playlist</h2>
              <button 
                onClick={() => !creating && setIsCreateModalOpen(false)} 
                disabled={creating}
                className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-all disabled:opacity-30"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-400 mb-2 uppercase tracking-wider">Playlist Title</label>
                <input 
                  type="text" 
                  value={newPlaylist.name}
                  onChange={(e) => setNewPlaylist({ ...newPlaylist, name: e.target.value })}
                  placeholder="e.g. Top Hits 2026"
                  disabled={creating}
                  className="w-full bg-black/60 border border-[#282828] rounded-xl p-3.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-400 disabled:opacity-50 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-400 mb-2 uppercase tracking-wider">Description</label>
                <textarea 
                  rows={2}
                  value={newPlaylist.description}
                  onChange={(e) => setNewPlaylist({ ...newPlaylist, description: e.target.value })}
                  placeholder="Brief description..."
                  disabled={creating}
                  className="w-full bg-black/60 border border-[#282828] rounded-xl p-3.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-400 disabled:opacity-50 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-400 mb-2 uppercase tracking-wider">Cover Image</label>
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={(e) => setNewPlaylist({ ...newPlaylist, coverImage: e.target.files?.[0] || null })}
                    disabled={creating}
                    className="w-full text-xs text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border file:border-[#282828] file:text-xs file:font-semibold file:bg-black/60 file:text-zinc-200 hover:file:bg-white hover:file:text-black file:transition-all disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-400 mb-2 uppercase tracking-wider">
                    Background Video <span className="text-zinc-500 font-normal lowercase">(optional)</span>
                  </label>
                  <input 
                    type="file" 
                    accept="video/mp4,video/*" 
                    onChange={(e) => setNewPlaylist({ ...newPlaylist, videoFile: e.target.files?.[0] || null })}
                    disabled={creating}
                    className="w-full text-xs text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border file:border-[#282828] file:text-xs file:font-semibold file:bg-black/60 file:text-zinc-200 hover:file:bg-white hover:file:text-black file:transition-all disabled:opacity-50"
                  />
                </div>
              </div>

              {creating && uploadPercent !== null && (
                <div className="mt-4">
                  <UploadProgressBar
                    percent={uploadPercent}
                    statusText={createProgressText || "Uploading playlist media..."}
                    loadedText={uploadStats.loadedText}
                    speedText={uploadStats.speedText}
                    variant="inline"
                  />
                </div>
              )}

              <button 
                onClick={handleCreatePlaylist}
                disabled={creating}
                className={`w-full py-3.5 mt-6 rounded-full font-bold text-black flex items-center justify-center gap-3 transition-all ${
                  creating 
                    ? "bg-zinc-400 cursor-not-allowed" 
                    : "bg-white hover:bg-zinc-200 active:scale-[0.99] shadow-sm"
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

