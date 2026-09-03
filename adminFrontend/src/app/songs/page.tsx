"use client";

import { useEffect, useState } from "react";
import { getImageUrl } from "@/lib/image-utils";
import { adminFetch } from "@/lib/adminFetch";

interface Song {
  id: string;
  title: string;
  artistName: string;
  duration: number;
  language: string;
  imageKey: string;
  videoKey?: string;
  fullVideoKey?: string;
  isFeatured?: boolean;
  lrclibId?: string;
  createdAt?: string;
}

const formatDuration = (num?: number) => {
  if (!num || isNaN(num)) return "0:00";
  const sec = num > 10000 ? Math.floor(num / 1000) : Math.floor(num);
  const mins = Math.floor(sec / 60);
  const secs = sec % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};


export default function SongsPage() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSong, setEditingSong] = useState<Song | null>(null);
  const [search, setSearch] = useState("");
  const [uploadMode, setUploadMode] = useState<"audio" | "videoOnly">("audio");

  // Create Form State
  const [formData, setFormData] = useState({
    title: "",
    artistName: "",
    language: "Hindi",
    lrclibId: "",
    songFile: null as File | null,
    imageFile: null as File | null,
    videoFile: null as File | null,
    fullVideoFile: null as File | null,
    clipStartMin: 0,
    clipStartSec: 0,
    clipEndMin: 0,
    clipEndSec: 15,
  });

  // Edit Form State
  const [editFormData, setEditFormData] = useState({
    title: "",
    artistName: "",
    language: "Hindi",
    lrclibId: "",
    imageFile: null as File | null,
    videoFile: null as File | null,
    fullVideoFile: null as File | null,
    removeVideo: false,
    removeFullVideo: false,
  });

  const [uploading, setUploading] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState("");

  const fetchSongs = async () => {
    try {
      setLoading(true);
      const response = await adminFetch("/admin/song?page=0&size=100");
      if (response.ok) {
        const result = await response.json();
        setSongs(result.content || result.data?.content || result.data || []);
      } else {
        setError("Failed to fetch songs");
      }
    } catch (err) {
      setError("Failed to fetch songs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSongs(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this song?")) return;
    try {
      const res = await adminFetch(`/admin/song/${id}`, { method: "DELETE" });
      if (res.ok) setSongs(songs.filter(s => s.id !== id));
      else alert("Failed to delete song");
    } catch { alert("Failed to delete song"); }
  };

  const handleToggleFeatured = async (song: Song) => {
    const newFeatured = !song.isFeatured;
    setSongs(prev => prev.map(s => s.id === song.id ? { ...s, isFeatured: newFeatured } : s));
    try {
      const res = await adminFetch(`/admin/song/${song.id}/featured`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ featured: newFeatured }),
      });
      if (!res.ok) {
        setSongs(prev => prev.map(s => s.id === song.id ? { ...s, isFeatured: song.isFeatured } : s));
        alert("Failed to update featured status");
      }
    } catch {
      setSongs(prev => prev.map(s => s.id === song.id ? { ...s, isFeatured: song.isFeatured } : s));
    }
  };

  const uploadFileToImageKit = async (file: File, folder: string) => {
    const sigRes = await adminFetch("/webhook/internal/image-upload-param");
    if (!sigRes.ok) throw new Error("Failed to get ImageKit upload authorization");
    const sigData = await sigRes.json();
    const fd = new FormData();
    fd.append("file", file);
    fd.append("publicKey", process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY || "public_ck50bJ3UfF9eCOXhwXQTQFP693o=");
    fd.append("signature", sigData.param.signature);
    fd.append("expire", sigData.param.expire.toString());
    fd.append("token", sigData.param.token);
    fd.append("folder", folder);
    const extension = file.name.split('.').pop();
    fd.append("fileName", `${sigData.key}.${extension}`);
    const res = await fetch("https://upload.imagekit.io/api/v1/files/upload", { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "File upload failed");
    return data.filePath || sigData.key;
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.imageFile) return alert("Please select a cover image");

    if (uploadMode === "videoOnly") {
      if (!formData.fullVideoFile) return alert("Please select a full video file");
    } else {
      if (!formData.songFile) return alert("Please select an audio file");
    }

    setUploading(true);
    setUploadProgressText("Starting upload...");
    try {
      let tempSongKey: string | null = null;
      let tempVideoKey: string | null = null;

      // 1. Audio Upload (if provided)
      if (formData.songFile) {
        setUploadProgressText("Uploading audio track to S3...");
        const songUrlRes = await adminFetch("/webhook/internal/song-upload-url");
        if (!songUrlRes.ok) throw new Error("Failed to get audio upload authorization");
        const songUrlData = await songUrlRes.json();
        const songUploadRes = await fetch(songUrlData.preSignedUrl, {
          method: "PUT",
          body: formData.songFile,
          headers: { "Content-Type": formData.songFile.type || "audio/mpeg" },
        });
        if (!songUploadRes.ok) throw new Error("Audio upload to S3 failed");
        tempSongKey = songUrlData.key;
      }

      // 2. Full Video Upload (if provided)
      if (formData.fullVideoFile) {
        setUploadProgressText("Uploading full video to S3...");
        const videoUrlRes = await adminFetch("/webhook/internal/video-upload-url");
        if (!videoUrlRes.ok) throw new Error("Failed to get full video upload authorization");
        const videoUrlData = await videoUrlRes.json();
        const videoUploadRes = await fetch(videoUrlData.preSignedUrl, {
          method: "PUT",
          body: formData.fullVideoFile,
          headers: { "Content-Type": formData.fullVideoFile.type || "video/mp4" },
        });
        if (!videoUploadRes.ok) throw new Error("Full video upload to S3 failed");
        tempVideoKey = videoUrlData.key;
      }

      // 3. Cover Image Upload (ImageKit)
      setUploadProgressText("Uploading cover image to ImageKit...");
      const uploadedImageKey = await uploadFileToImageKit(formData.imageFile, "/songs/images");

      // 4. Manual Canvas Video Upload (optional, only in audio mode if provided)
      let uploadedVideoKey: string | null = null;
      if (uploadMode === "audio" && formData.videoFile) {
        setUploadProgressText("Uploading canvas video to ImageKit...");
        uploadedVideoKey = await uploadFileToImageKit(formData.videoFile, "/songs/videos");
      }

      // 5. Finalize Song Creation
      setUploadProgressText("Registering song & scheduling background processing...");
      const finalizeRes = await adminFetch("/admin/song", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.title,
          artistName: formData.artistName,
          tempSongKey: tempSongKey || undefined,
          tempVideoKey: tempVideoKey || undefined,
          imageKey: uploadedImageKey,
          videoKey: uploadedVideoKey,
          clipStartMin: uploadMode === "videoOnly" ? Number(formData.clipStartMin) : undefined,
          clipStartSec: uploadMode === "videoOnly" ? Number(formData.clipStartSec) : undefined,
          clipEndMin: uploadMode === "videoOnly" ? Number(formData.clipEndMin) : undefined,
          clipEndSec: uploadMode === "videoOnly" ? Number(formData.clipEndSec) : undefined,
          language: formData.language || "Hindi",
          lrclibId: formData.lrclibId.trim() || "0",
        }),
      });

      if (finalizeRes.ok) {
        setIsModalOpen(false);
        setFormData({
          title: "",
          artistName: "",
          language: "Hindi",
          lrclibId: "",
          songFile: null,
          imageFile: null,
          videoFile: null,
          fullVideoFile: null,
          clipStartMin: 0,
          clipStartSec: 0,
          clipEndMin: 0,
          clipEndSec: 15,
        });
        fetchSongs();
      } else {
        const errData = await finalizeRes.json();
        throw new Error(errData.message || "Failed to create song record");
      }
    } catch (err: any) {
      alert("Upload failed: " + err.message);
    } finally {
      setUploading(false);
      setUploadProgressText("");
    }
  };

  const handleEditOpen = (song: Song) => {
    setEditingSong(song);
    setEditFormData({
      title: song.title,
      artistName: song.artistName,
      language: song.language || "Hindi",
      lrclibId: song.lrclibId || "",
      imageFile: null,
      videoFile: null,
      fullVideoFile: null,
      removeVideo: false,
      removeFullVideo: false,
    });
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSong) return;
    setUploading(true);
    try {
      let imageKey = editingSong.imageKey;
      if (editFormData.imageFile) imageKey = await uploadFileToImageKit(editFormData.imageFile, "/songs/images");
      
      let videoKey: string | null | undefined = editingSong.videoKey;
      if (editFormData.removeVideo) {
        videoKey = ""; // Empty string signals removal & ImageKit deletion
      } else if (editFormData.videoFile) {
        videoKey = await uploadFileToImageKit(editFormData.videoFile, "/songs/videos");
      }

      let fullVideoKey: string | null | undefined = editingSong.fullVideoKey;
      if (editFormData.removeFullVideo) {
        fullVideoKey = ""; // Clears fullVideoKey
      }

      const res = await adminFetch(`/admin/song/${editingSong.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editFormData.title,
          artistName: editFormData.artistName,
          language: editFormData.language,
          lrclibId: editFormData.lrclibId.trim() || "0",
          imageKey,
          videoKey,
          fullVideoKey,
        }),
      });
      if (res.ok) { setEditingSong(null); fetchSongs(); }
      else { const errData = await res.json(); throw new Error(errData.message || "Failed to update song"); }
    } catch (err: any) {
      alert("Update failed: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const inputCls = "w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all";
  const labelCls = "block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1.5 uppercase tracking-wider";
  const fileCls = "w-full text-xs text-zinc-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold cursor-pointer";

  const filtered = songs.filter(s =>
    s.title.toLowerCase().includes(search.toLowerCase()) ||
    s.artistName.toLowerCase().includes(search.toLowerCase())
  );

  const featuredCount = songs.filter(s => s.isFeatured).length;
  const videoCount = songs.filter(s => s.videoKey).length;

  return (
    <div className="p-6 md:p-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight">Song Library</h1>
          <p className="text-zinc-500 text-sm mt-0.5">{songs.length} tracks · {featuredCount} featured · {videoCount} with video canvas</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-indigo-500/20 transition-all text-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          Add Song
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Search by title or artist..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-11 pr-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
        />
      </div>

      {/* Song Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 animate-pulse">
              <div className="w-full aspect-square rounded-xl bg-zinc-200 dark:bg-zinc-800 mb-3" />
              <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-3/4 mb-2" />
              <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-zinc-400">
          <svg className="w-12 h-12 mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
          <p className="font-medium">{search ? "No songs match your search." : "No songs yet. Add your first track."}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((song) => (
            <div
              key={song.id}
              className="group relative bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-lg hover:shadow-indigo-500/10 transition-all duration-200"
            >
              {/* Cover Art */}
              <div className="relative aspect-square overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                {song.imageKey ? (
                  <img
                    src={getImageUrl(song.imageKey, { width: 400, height: 400, focus: "auto", aspectRatio: "1-1" })}
                    alt={song.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <svg className="w-12 h-12 text-zinc-300 dark:text-zinc-600" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                    </svg>
                  </div>
                )}

                {/* Top badges */}
                <div className="absolute top-2 left-2 flex gap-1.5">
                  {song.isFeatured && (
                    <span className="flex items-center gap-1 bg-amber-500/90 backdrop-blur-sm text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                      <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                      </svg>
                      Hero
                    </span>
                  )}
                  {song.videoKey && (
                    <span className="flex items-center gap-1 bg-emerald-500/90 backdrop-blur-sm text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                      <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                      </svg>
                      Canvas
                    </span>
                  )}
                  {song.fullVideoKey && (
                    <span className="flex items-center gap-1 bg-indigo-600/90 backdrop-blur-sm text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm">
                      <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Full Video
                    </span>
                  )}
                </div>

                {/* Hover action bar */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-end p-3 gap-2">
                  <button
                    onClick={() => handleToggleFeatured(song)}
                    title={song.isFeatured ? "Remove from hero featured" : "Mark as hero featured"}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${
                      song.isFeatured
                        ? "bg-amber-500/90 text-white hover:bg-amber-600/90"
                        : "bg-white/20 backdrop-blur-sm text-white hover:bg-amber-500/80"
                    }`}
                  >
                    <svg className="w-3.5 h-3.5" fill={song.isFeatured ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                    </svg>
                    {song.isFeatured ? "Unfeature" : "Feature"}
                  </button>
                  <button
                    onClick={() => handleEditOpen(song)}
                    className="p-2 rounded-lg bg-white/20 backdrop-blur-sm text-white hover:bg-indigo-500/80 transition-all"
                    title="Edit"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(song.id)}
                    className="p-2 rounded-lg bg-white/20 backdrop-blur-sm text-white hover:bg-red-500/80 transition-all"
                    title="Delete"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Info */}
              <div className="p-4">
                <h3 className="font-bold text-zinc-900 dark:text-white truncate text-sm mb-0.5">{song.title}</h3>
                <p className="text-xs text-zinc-500 truncate">{song.artistName}</p>
                <div className="flex items-center justify-between mt-3">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-wider">{song.language}</span>
                  <div className="flex items-center gap-2 text-[10px] text-zinc-400 font-mono">
                    {song.lrclibId && song.lrclibId !== "0" && (
                      <span title="LRCLIB ID" className="flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                        </svg>
                        {song.lrclibId}
                      </span>
                    )}
                    <span>{formatDuration(song.duration)}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-xl rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            <div className="px-6 py-5 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-black text-zinc-900 dark:text-white">Add New Track</h2>
                <p className="text-xs text-zinc-500 mt-0.5">Upload a standard audio track or extract from a full video</p>
              </div>
              <button onClick={() => !uploading && setIsModalOpen(false)} className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:rotate-90 transition-all">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="p-3 bg-zinc-50 dark:bg-zinc-800/40 border-b border-zinc-200 dark:border-zinc-800 flex gap-2">
              <button
                type="button"
                onClick={() => setUploadMode("audio")}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  uploadMode === "audio"
                    ? "bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-sm border border-zinc-200 dark:border-zinc-700"
                    : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                }`}
              >
                <span>🎵 Audio Track</span>
                <span className="text-[10px] font-normal text-zinc-400">(Standard)</span>
              </button>
              <button
                type="button"
                onClick={() => setUploadMode("videoOnly")}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  uploadMode === "videoOnly"
                    ? "bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-sm border border-zinc-200 dark:border-zinc-700"
                    : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                }`}
              >
                <span>🎬 Video Only</span>
                <span className="text-[10px] font-normal text-zinc-400">(Auto-Audio & Canvas)</span>
              </button>
            </div>

            <form onSubmit={handleUpload} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className={labelCls}>Song Title</label>
                  <input required type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="e.g. Moonlight Sonata" className={inputCls} />
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>Artist Name</label>
                  <input required type="text" value={formData.artistName} onChange={e => setFormData({...formData, artistName: e.target.value})} placeholder="e.g. Beethoven" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Language</label>
                  <input required type="text" value={formData.language} onChange={e => setFormData({...formData, language: e.target.value})} placeholder="Hindi" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>LRCLIB ID</label>
                  <input type="text" value={formData.lrclibId} onChange={e => setFormData({...formData, lrclibId: e.target.value})} placeholder="e.g. 123456" className={inputCls} />
                </div>
              </div>

              {/* VIDEO ONLY MODE FIELDS */}
              {uploadMode === "videoOnly" ? (
                <div className="grid grid-cols-1 gap-3 pt-1">
                  <div className="border-2 border-dashed border-indigo-300 dark:border-indigo-800 bg-indigo-50/40 dark:bg-indigo-950/20 rounded-xl p-3.5">
                    <div className="flex items-center justify-between mb-1">
                      <label className={labelCls + " text-indigo-600 dark:text-indigo-400 mb-0 font-black"}>Full Video File <span className="text-red-500">*</span></label>
                      <span className="text-[10px] text-indigo-500 font-bold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/60">S3 Shaka Packaged</span>
                    </div>
                    <p className="text-[11px] text-zinc-500 mb-2">Upload complete music video (.mp4, .mov, .mkv). Audio will be extracted automatically.</p>
                    <input required type="file" accept="video/*" onChange={e => setFormData({...formData, fullVideoFile: e.target.files?.[0] || null})} className={fileCls + " file:bg-indigo-600 file:text-white hover:file:bg-indigo-700"} />
                  </div>

                  <div className="border border-dashed border-zinc-200 dark:border-zinc-700 rounded-xl p-3">
                    <label className={labelCls + " mb-1"}>Cover Image <span className="text-red-400">*</span></label>
                    <input required type="file" accept="image/*" onChange={e => setFormData({...formData, imageFile: e.target.files?.[0] || null})} className={fileCls + " file:bg-purple-50 file:text-purple-600 hover:file:bg-purple-100"} />
                  </div>

                  {/* Canvas Video Clipping Instruction Card */}
                  <div className="border border-zinc-200 dark:border-zinc-700 rounded-xl p-3.5 bg-zinc-50 dark:bg-zinc-800/50">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" /></svg>
                        Canvas Loop Cut (Uploaded to ImageKit)
                      </label>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/40">Auto-Cut</span>
                    </div>
                    <p className="text-[11px] text-zinc-500 mb-3">Specify the start and end timestamp in the video to cut as the looping canvas video:</p>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white dark:bg-zinc-900 p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700">
                        <span className="block text-[10px] font-bold text-zinc-400 uppercase mb-1.5">Clip Start Time</span>
                        <div className="flex items-center gap-2">
                          <div className="flex-1">
                            <span className="text-[9px] text-zinc-400">Min</span>
                            <input
                              type="number"
                              min="0"
                              max="99"
                              value={formData.clipStartMin}
                              onChange={e => setFormData({...formData, clipStartMin: Math.max(0, parseInt(e.target.value) || 0)})}
                              className="w-full bg-zinc-100 dark:bg-zinc-800 rounded px-2 py-1 text-sm font-mono text-center font-bold"
                            />
                          </div>
                          <span className="font-bold text-zinc-400 mt-3">:</span>
                          <div className="flex-1">
                            <span className="text-[9px] text-zinc-400">Sec</span>
                            <input
                              type="number"
                              min="0"
                              max="59"
                              value={formData.clipStartSec}
                              onChange={e => setFormData({...formData, clipStartSec: Math.max(0, Math.min(59, parseInt(e.target.value) || 0))})}
                              className="w-full bg-zinc-100 dark:bg-zinc-800 rounded px-2 py-1 text-sm font-mono text-center font-bold"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="bg-white dark:bg-zinc-900 p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700">
                        <span className="block text-[10px] font-bold text-zinc-400 uppercase mb-1.5">Clip End Time</span>
                        <div className="flex items-center gap-2">
                          <div className="flex-1">
                            <span className="text-[9px] text-zinc-400">Min</span>
                            <input
                              type="number"
                              min="0"
                              max="99"
                              value={formData.clipEndMin}
                              onChange={e => setFormData({...formData, clipEndMin: Math.max(0, parseInt(e.target.value) || 0)})}
                              className="w-full bg-zinc-100 dark:bg-zinc-800 rounded px-2 py-1 text-sm font-mono text-center font-bold"
                            />
                          </div>
                          <span className="font-bold text-zinc-400 mt-3">:</span>
                          <div className="flex-1">
                            <span className="text-[9px] text-zinc-400">Sec</span>
                            <input
                              type="number"
                              min="0"
                              max="59"
                              value={formData.clipEndSec}
                              onChange={e => setFormData({...formData, clipEndSec: Math.max(0, Math.min(59, parseInt(e.target.value) || 0))})}
                              className="w-full bg-zinc-100 dark:bg-zinc-800 rounded px-2 py-1 text-sm font-mono text-center font-bold"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* STANDARD AUDIO MODE FIELDS */
                <div className="grid grid-cols-1 gap-3 pt-1">
                  <div className="border border-dashed border-zinc-200 dark:border-zinc-700 rounded-xl p-3">
                    <label className={labelCls + " mb-1"}>Audio File <span className="text-red-400">*</span></label>
                    <input required type="file" accept="audio/*" onChange={e => setFormData({...formData, songFile: e.target.files?.[0] || null})} className={fileCls + " file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100"} />
                  </div>
                  <div className="border border-dashed border-zinc-200 dark:border-zinc-700 rounded-xl p-3">
                    <label className={labelCls + " mb-1"}>Cover Image <span className="text-red-400">*</span></label>
                    <input required type="file" accept="image/*" onChange={e => setFormData({...formData, imageFile: e.target.files?.[0] || null})} className={fileCls + " file:bg-purple-50 file:text-purple-600 hover:file:bg-purple-100"} />
                  </div>
                  <div className="border border-dashed border-zinc-200 dark:border-zinc-700 rounded-xl p-3">
                    <label className={labelCls + " mb-1"}>Short Background Video Canvas <span className="text-zinc-400 normal-case font-normal">(ImageKit loop, optional)</span></label>
                    <input type="file" accept="video/mp4,video/*" onChange={e => setFormData({...formData, videoFile: e.target.files?.[0] || null})} className={fileCls + " file:bg-emerald-50 file:text-emerald-600 hover:file:bg-emerald-100"} />
                  </div>
                  <div className="border border-dashed border-zinc-200 dark:border-zinc-700 rounded-xl p-3">
                    <label className={labelCls + " mb-1"}>Full Music Video <span className="text-zinc-400 normal-case font-normal">(S3 Shaka Packager, optional)</span></label>
                    <input type="file" accept="video/*" onChange={e => setFormData({...formData, fullVideoFile: e.target.files?.[0] || null})} className={fileCls + " file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100"} />
                  </div>
                </div>
              )}

              <button disabled={uploading} type="submit" className={`w-full py-3 rounded-xl font-bold text-white text-sm transition-all flex flex-col items-center justify-center gap-1 ${uploading ? "bg-indigo-400 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99]"}`}>
                {uploading ? (
                  <>
                    <div className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                      <span>Processing Upload...</span>
                    </div>
                    {uploadProgressText && <span className="text-[11px] font-normal text-indigo-100 opacity-90">{uploadProgressText}</span>}
                  </>
                ) : (
                  uploadMode === "videoOnly" ? "Upload Video & Process Track" : "Finalize & Upload Track"
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingSong && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            <div className="px-6 py-5 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-4">
              {editingSong.imageKey && (
                <img src={getImageUrl(editingSong.imageKey, { width: 80, height: 80, focus: "auto", aspectRatio: "1-1" })} alt="" className="w-12 h-12 rounded-xl object-cover shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-black text-zinc-900 dark:text-white truncate">{editingSong.title}</h2>
                <p className="text-xs text-zinc-500">{editingSong.artistName}</p>
              </div>
              <button onClick={() => !uploading && setEditingSong(null)} className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:rotate-90 transition-all shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className={labelCls}>Song Title</label>
                  <input required type="text" value={editFormData.title} onChange={e => setEditFormData({...editFormData, title: e.target.value})} className={inputCls} />
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>Artist Name</label>
                  <input required type="text" value={editFormData.artistName} onChange={e => setEditFormData({...editFormData, artistName: e.target.value})} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Language</label>
                  <input required type="text" value={editFormData.language} onChange={e => setEditFormData({...editFormData, language: e.target.value})} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>LRCLIB ID</label>
                  <input type="text" value={editFormData.lrclibId} onChange={e => setEditFormData({...editFormData, lrclibId: e.target.value})} className={inputCls} />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 pt-1">
                <div className="border border-dashed border-zinc-200 dark:border-zinc-700 rounded-xl p-3">
                  <label className={labelCls + " mb-1"}>Replace Cover Image <span className="text-zinc-400 normal-case font-normal">(optional)</span></label>
                  <input type="file" accept="image/*" onChange={e => setEditFormData({...editFormData, imageFile: e.target.files?.[0] || null})} className={fileCls + " file:bg-purple-50 file:text-purple-600 hover:file:bg-purple-100"} />
                </div>

                {/* Video Canvas Section */}
                <div className="border border-dashed border-zinc-200 dark:border-zinc-700 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1">
                    <label className={labelCls + " mb-0"}>
                      {editingSong.videoKey && !editFormData.removeVideo ? "Replace Video Canvas" : "Attach Video Canvas"}{" "}
                      <span className="text-zinc-400 normal-case font-normal">(optional)</span>
                    </label>
                    {editingSong.videoKey && (
                      <button
                        type="button"
                        onClick={() => setEditFormData({ ...editFormData, removeVideo: !editFormData.removeVideo, videoFile: null })}
                        className={`text-xs font-bold px-2.5 py-1 rounded-lg transition-all ${
                          editFormData.removeVideo
                            ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-300"
                            : "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 hover:bg-red-100 border border-red-200 dark:border-red-800/40"
                        }`}
                      >
                        {editFormData.removeVideo ? "Undo Remove" : "Remove Video Canvas"}
                      </button>
                    )}
                  </div>
                  {editingSong.videoKey && !editFormData.removeVideo && (
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mb-2 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" /></svg>
                      Active canvas video attached
                    </p>
                  )}
                  {editFormData.removeVideo && (
                    <p className="text-[10px] text-red-500 font-bold mb-2 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                      Video canvas will be removed upon saving
                    </p>
                  )}
                  {!editFormData.removeVideo && (
                    <input type="file" accept="video/mp4,video/*" onChange={e => setEditFormData({...editFormData, videoFile: e.target.files?.[0] || null})} className={fileCls + " file:bg-emerald-50 file:text-emerald-600 hover:file:bg-emerald-100"} />
                  )}
                </div>

                {/* Full Video Stream Section */}
                {editingSong.fullVideoKey && (
                  <div className="border border-zinc-200 dark:border-zinc-700 rounded-xl p-3 bg-zinc-50/50 dark:bg-zinc-800/30">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="block text-xs font-bold text-zinc-900 dark:text-white">Full Video (Shaka Adaptive Stream)</span>
                        <span className="text-[10px] text-zinc-400 font-mono truncate max-w-[200px] block">{editingSong.fullVideoKey}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditFormData({ ...editFormData, removeFullVideo: !editFormData.removeFullVideo })}
                        className={`text-xs font-bold px-2.5 py-1 rounded-lg transition-all ${
                          editFormData.removeFullVideo
                            ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200"
                            : "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 hover:bg-red-100 border border-red-200 dark:border-red-800/40"
                        }`}
                      >
                        {editFormData.removeFullVideo ? "Undo Remove" : "Remove Full Video"}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <button disabled={uploading} type="submit" className={`w-full py-3 rounded-xl font-bold text-white text-sm transition-all flex items-center justify-center gap-2 ${uploading ? "bg-indigo-400 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700"}`}>
                {uploading ? (<><svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>Saving...</>) : "Save Changes"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
