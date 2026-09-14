"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { getImageUrl } from "@/lib/image-utils";
import { adminFetch } from "@/lib/adminFetch";
import { Toast, ToastType } from "@/components/Toast";
import { Loader2 } from "lucide-react";

interface Song {
  id: string;
  title: string;
  artistName: string;
  duration: number;
  language: string;
  imageKey: string;
  videoKey?: string;
  fullVideoKey?: string;
  previewStartTime?: number | null;
  previewEndTime?: number | null;
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

function SongsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");

  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSong, setEditingSong] = useState<Song | null>(null);
  const [uploadMode, setUploadMode] = useState<"audio" | "videoOnly">("audio");
  const [search, setSearch] = useState("");
  const [deletingSongId, setDeletingSongId] = useState<string | null>(null);
  const [togglingSongId, setTogglingSongId] = useState<string | null>(null);
  const [uploadStep, setUploadStep] = useState(0);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const showToast = (message: string, type: ToastType = "success") => {
    setToast({ message, type });
  };

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
    previewStartMin: "" as string | number,
    previewStartSec: "" as string | number,
    previewEndMin: "" as string | number,
    previewEndSec: "" as string | number,
  });

  // Edit Form State
  const [editFormData, setEditFormData] = useState({
    title: "",
    artistName: "",
    language: "Hindi",
    lrclibId: "",
    previewStartMin: "" as string | number,
    previewStartSec: "" as string | number,
    previewEndMin: "" as string | number,
    previewEndSec: "" as string | number,
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

  const handleCloseEdit = () => {
    if (uploading) return;
    setEditingSong(null);
    if (searchParams.get("edit")) {
      router.replace("/songs");
    }
  };

  useEffect(() => {
    if (!editId) return;
    if (editingSong && editingSong.id === editId) return;

    const existing = songs.find(s => s.id === editId);
    if (existing) {
      handleEditOpen(existing);
    } else {
      adminFetch(`/admin/song/${editId}`)
        .then(res => (res.ok ? res.json() : null))
        .then(song => {
          if (song) handleEditOpen(song);
        })
        .catch(console.error);
    }
  }, [editId, songs]);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this song?")) return;
    setDeletingSongId(id);
    try {
      const res = await adminFetch(`/admin/song/${id}`, { method: "DELETE" });
      if (res.ok) {
        setSongs(songs.filter(s => s.id !== id));
        showToast("Song deleted successfully", "success");
      } else {
        showToast("Failed to delete song", "error");
      }
    } catch {
      showToast("Failed to delete song due to network error", "error");
    } finally {
      setDeletingSongId(null);
    }
  };

  const handleToggleFeatured = async (song: Song) => {
    const newFeatured = !song.isFeatured;
    setTogglingSongId(song.id);
    try {
      const res = await adminFetch(`/admin/song/${song.id}/featured`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ featured: newFeatured }),
      });
      if (res.ok) {
        setSongs(prev => prev.map(s => s.id === song.id ? { ...s, isFeatured: newFeatured } : s));
        showToast(newFeatured ? "Track marked as featured" : "Track unfeatured", "success");
      } else {
        showToast("Failed to update featured status", "error");
      }
    } catch {
      showToast("Failed to update featured status", "error");
    } finally {
      setTogglingSongId(null);
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
      if (!formData.fullVideoFile) return showToast("Please select a full video file", "error");
    } else {
      if (!formData.songFile) return showToast("Please select an audio file", "error");
    }
    if (!formData.imageFile) return showToast("Please select a cover image", "error");
    if (!formData.title.trim()) return showToast("Please enter a song title", "error");
    if (!formData.artistName.trim()) return showToast("Please enter an artist name", "error");

    setUploading(true);
    setUploadStep(1);
    setUploadProgressText(uploadMode === "videoOnly" ? "Uploading full video to S3 storage..." : "Uploading audio file to S3 storage...");
    try {
      let tempSongKey: string | null = null;
      let tempVideoKey: string | null = null;

      // 1. Audio Upload (if provided)
      if (formData.songFile) {
        setUploadStep(1);
        setUploadProgressText("Uploading audio file to S3 storage...");
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
        setUploadStep(1);
        setUploadProgressText("Uploading full music video to S3 storage...");
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
      setUploadStep(2);
      setUploadProgressText("Uploading cover artwork to ImageKit CDN...");
      const uploadedImageKey = await uploadFileToImageKit(formData.imageFile, "/songs/images");

      // 4. Manual Canvas Video Upload (optional, only in audio mode if provided)
      let uploadedVideoKey: string | null = null;
      if (uploadMode === "audio" && formData.videoFile) {
        setUploadStep(2);
        setUploadProgressText("Uploading canvas background loop to ImageKit CDN...");
        uploadedVideoKey = await uploadFileToImageKit(formData.videoFile, "/songs/videos");
      }

      let previewStartTime: number | null = null;
      if (formData.previewStartMin !== "" || formData.previewStartSec !== "") {
        const min = parseInt(String(formData.previewStartMin), 10) || 0;
        const sec = parseInt(String(formData.previewStartSec), 10) || 0;
        previewStartTime = min * 60 + sec;
      }

      let previewEndTime: number | null = null;
      if (formData.previewEndMin !== "" || formData.previewEndSec !== "") {
        const min = parseInt(String(formData.previewEndMin), 10) || 0;
        const sec = parseInt(String(formData.previewEndSec), 10) || 0;
        previewEndTime = min * 60 + sec;
      }

      // 5. Finalize Song Creation
      setUploadStep(3);
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
          previewStartTime: previewStartTime !== null ? previewStartTime : undefined,
          previewEndTime: previewEndTime !== null ? previewEndTime : undefined,
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
          previewStartMin: "",
          previewStartSec: "",
          previewEndMin: "",
          previewEndSec: "",
        });
        fetchSongs();
        showToast("Track uploaded successfully! Background transcoding worker queued.", "success");
      } else {
        const errData = await finalizeRes.json();
        throw new Error(errData.message || "Failed to create song record");
      }
    } catch (err: any) {
      showToast("Upload failed: " + err.message, "error");
    } finally {
      setUploading(false);
      setUploadStep(0);
      setUploadProgressText("");
    }
  };

  const handleEditOpen = (song: Song) => {
    setEditingSong(song);
    const startTotal = song.previewStartTime !== undefined && song.previewStartTime !== null && song.previewStartTime >= 0 ? song.previewStartTime : null;
    const endTotal = song.previewEndTime !== undefined && song.previewEndTime !== null && song.previewEndTime >= 0 ? song.previewEndTime : null;

    setEditFormData({
      title: song.title,
      artistName: song.artistName,
      language: song.language || "Hindi",
      lrclibId: song.lrclibId || "",
      previewStartMin: startTotal !== null ? Math.floor(startTotal / 60) : "",
      previewStartSec: startTotal !== null ? startTotal % 60 : "",
      previewEndMin: endTotal !== null ? Math.floor(endTotal / 60) : "",
      previewEndSec: endTotal !== null ? endTotal % 60 : "",
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
    setUploadProgressText("Saving changes...");
    try {
      let imageKey = editingSong.imageKey;
      if (editFormData.imageFile) {
        setUploadProgressText("Uploading new cover image...");
        imageKey = await uploadFileToImageKit(editFormData.imageFile, "/songs/images");
      }

      let videoKey: string | null | undefined = editingSong.videoKey;
      if (editFormData.removeVideo) {
        videoKey = ""; // Empty string signals removal & ImageKit deletion
      } else if (editFormData.videoFile) {
        setUploadProgressText("Uploading new canvas video...");
        videoKey = await uploadFileToImageKit(editFormData.videoFile, "/songs/videos");
      }

      let fullVideoKey: string | null | undefined = editingSong.fullVideoKey;
      if (editFormData.removeFullVideo) {
        fullVideoKey = ""; // Clears fullVideoKey from song
      } else if (editFormData.fullVideoFile) {
        // Upload new full video to S3 temp bucket, then trigger reprocessing
        setUploadProgressText("Uploading full video to S3...");
        const videoUrlRes = await adminFetch("/webhook/internal/video-upload-url");
        if (!videoUrlRes.ok) throw new Error("Failed to get video upload authorization");
        const videoUrlData = await videoUrlRes.json();
        const videoUploadRes = await fetch(videoUrlData.preSignedUrl, {
          method: "PUT",
          body: editFormData.fullVideoFile,
          headers: { "Content-Type": editFormData.fullVideoFile.type || "video/mp4" },
        });
        if (!videoUploadRes.ok) throw new Error("Full video upload to S3 failed");
        const tempVideoKey = videoUrlData.key;

        // Trigger reprocessing of the full video for this existing song
        setUploadProgressText("Triggering video processing pipeline...");
        const reprocessRes = await adminFetch(`/admin/song/${editingSong.id}/reprocess-video`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tempVideoKey }),
        });
        if (!reprocessRes.ok) {
          const errData = await reprocessRes.json().catch(() => ({}));
          throw new Error(errData.message || "Failed to trigger video reprocessing");
        }
        // Don't change fullVideoKey in the PUT call — the worker will set it
        fullVideoKey = editingSong.fullVideoKey; // keep current until worker finishes
      }

      let previewStartTime: number | null = null;
      if (editFormData.previewStartMin !== "" || editFormData.previewStartSec !== "") {
        const min = parseInt(String(editFormData.previewStartMin), 10) || 0;
        const sec = parseInt(String(editFormData.previewStartSec), 10) || 0;
        previewStartTime = min * 60 + sec;
      }

      let previewEndTime: number | null = null;
      if (editFormData.previewEndMin !== "" || editFormData.previewEndSec !== "") {
        const min = parseInt(String(editFormData.previewEndMin), 10) || 0;
        const sec = parseInt(String(editFormData.previewEndSec), 10) || 0;
        previewEndTime = min * 60 + sec;
      }

      setUploadProgressText("Saving metadata...");
      const res = await adminFetch(`/admin/song/${editingSong.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editFormData.title,
          artistName: editFormData.artistName,
          language: editFormData.language,
          lrclibId: editFormData.lrclibId.trim() || "0",
          previewStartTime: previewStartTime !== null ? previewStartTime : -1,
          previewEndTime: previewEndTime !== null ? previewEndTime : -1,
          imageKey,
          videoKey,
          fullVideoKey,
        }),
      });
      if (res.ok) { handleCloseEdit(); fetchSongs(); }
      else { const errData = await res.json(); throw new Error(errData.message || "Failed to update song"); }
    } catch (err: any) {
      alert("Update failed: " + err.message);
    } finally {
      setUploading(false);
      setUploadProgressText("");
    }
  };

  const inputCls = "w-full bg-black/60 border border-[#282828] rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-white focus:ring-1 focus:ring-white/20 transition-all";
  const labelCls = "block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider";
  const fileCls = "w-full text-xs text-zinc-400 file:mr-3 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-white file:text-black hover:file:bg-zinc-200 cursor-pointer";

  const filtered = songs.filter(s =>
    s.title.toLowerCase().includes(search.toLowerCase()) ||
    s.artistName.toLowerCase().includes(search.toLowerCase())
  );

  const featuredCount = songs.filter(s => s.isFeatured).length;
  const videoCount = songs.filter(s => s.videoKey).length;

  return (
    <div className="p-6 md:p-8 max-w-[1600px] mx-auto text-white font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Song Library</h1>
          <p className="text-zinc-400 text-sm mt-0.5">{songs.length} tracks · {featuredCount} featured · {videoCount} with video canvas</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 bg-white hover:bg-zinc-200 active:scale-95 text-black px-5 py-2.5 rounded-full font-bold shadow-sm transition-all text-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          Add Song
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Search by title or artist..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-11 pr-4 py-2.5 bg-[#121212] border border-[#282828] rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-white focus:ring-1 focus:ring-white/20 transition-all"
        />
      </div>

      {/* Song Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-[#121212] rounded-2xl border border-[#282828] p-4 animate-pulse">
              <div className="w-full aspect-square rounded-xl bg-zinc-800 mb-3" />
              <div className="h-4 bg-zinc-800 rounded w-3/4 mb-2" />
              <div className="h-3 bg-zinc-800/60 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-zinc-500">
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
              className="group relative bg-[#121212] rounded-2xl border border-[#282828] overflow-hidden hover:border-zinc-700 hover:bg-[#181818] transition-all duration-200"
            >
              {/* Cover Art */}
              <div className="relative aspect-square overflow-hidden bg-zinc-900">
                {song.imageKey ? (
                  <img
                    src={getImageUrl(song.imageKey, { width: 400, height: 400, focus: "auto", aspectRatio: "1-1" })}
                    alt={song.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <svg className="w-12 h-12 text-zinc-600" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                    </svg>
                  </div>
                )}

                {/* Top badges */}
                <div className="absolute top-2 left-2 flex flex-wrap gap-1.5 max-w-[90%] z-10">
                  {song.isFeatured && (
                    <span className="flex items-center gap-1 bg-amber-500/90 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                      <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                      </svg>
                      Hero
                    </span>
                  )}
                  {song.videoKey && (
                    <span className="flex items-center gap-1 bg-emerald-500/90 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                      <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                      </svg>
                      Canvas
                    </span>
                  )}
                  {song.fullVideoKey && (
                    <span className="flex items-center gap-1 bg-white text-black text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                      <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Full Video
                    </span>
                  )}
                  {song.previewStartTime != null && (
                    <span title={`Preview: ${formatDuration(song.previewStartTime)} - ${song.previewEndTime != null ? formatDuration(song.previewEndTime) : 'end'}`} className="flex items-center gap-1 bg-zinc-800/90 border border-[#282828] text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm font-mono shrink-0">
                      <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z"/></svg>
                      {formatDuration(song.previewStartTime)}-{song.previewEndTime != null ? formatDuration(song.previewEndTime) : "end"}
                    </span>
                  )}
                </div>

                {/* Hover action bar */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-end p-3 gap-2">
                  <button
                    disabled={togglingSongId === song.id}
                    onClick={() => handleToggleFeatured(song)}
                    title={song.isFeatured ? "Remove from hero featured" : "Mark as hero featured"}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-50 ${
                      song.isFeatured
                        ? "bg-amber-500 text-white hover:bg-amber-600"
                        : "bg-white/20 backdrop-blur-sm text-white hover:bg-white hover:text-black"
                    }`}
                  >
                    {togglingSongId === song.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <svg className="w-3.5 h-3.5" fill={song.isFeatured ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                      </svg>
                    )}
                    {song.isFeatured ? "Unfeature" : "Feature"}
                  </button>
                  <button
                    onClick={() => handleEditOpen(song)}
                    className="p-2 rounded-lg bg-white/20 backdrop-blur-sm text-white hover:bg-white hover:text-black transition-all"
                    title="Edit"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    disabled={deletingSongId === song.id}
                    onClick={() => handleDelete(song.id)}
                    className="p-2 rounded-lg bg-white/20 backdrop-blur-sm text-white hover:bg-red-500 transition-all disabled:opacity-50"
                    title="Delete"
                  >
                    {deletingSongId === song.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-red-300" />
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Info */}
              <div className="p-4">
                <h3 className="font-bold text-white truncate text-sm mb-0.5">{song.title}</h3>
                <p className="text-xs text-zinc-400 truncate">{song.artistName}</p>
                <div className="flex items-center justify-between mt-3 gap-2">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-black/60 border border-[#282828] text-zinc-300 font-bold uppercase tracking-wider shrink-0">{song.language}</span>
                  <div className="flex items-center gap-2 text-[10px] text-zinc-400 font-mono">
                    {song.lrclibId && song.lrclibId !== "0" && (
                      <span title="LRCLIB ID" className="flex items-center gap-1 shrink-0">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                        </svg>
                        {song.lrclibId}
                      </span>
                    )}
                    <span className="shrink-0">{formatDuration(song.duration)}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 bg-black/80 backdrop-blur-md">
          <div className="bg-[#121212] w-full max-w-5xl rounded-3xl shadow-2xl border border-[#282828] overflow-hidden flex flex-col text-white">
            <div className="px-6 py-4.5 border-b border-[#282828] flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold text-white">Add New Track</h2>
                <p className="text-xs text-zinc-400 mt-0.5">Upload a standard audio track or extract from a full video</p>
              </div>
              <button onClick={() => !uploading && setIsModalOpen(false)} className="text-zinc-400 hover:text-white hover:rotate-90 transition-all p-1 rounded-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="px-6 py-2.5 bg-black/60 border-b border-[#282828] flex gap-2">
              <button
                type="button"
                disabled={uploading}
                onClick={() => setUploadMode("audio")}
                className={`flex-1 py-2 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  uploadMode === "audio"
                    ? "bg-white text-black shadow-sm"
                    : "text-zinc-400 hover:text-white"
                } ${uploading ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <span>🎵 Audio Track</span>
                <span className={`text-[10px] font-normal ${uploadMode === "audio" ? "text-zinc-600" : "text-zinc-500"}`}>(Standard)</span>
              </button>
              <button
                type="button"
                disabled={uploading}
                onClick={() => setUploadMode("videoOnly")}
                className={`flex-1 py-2 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  uploadMode === "videoOnly"
                    ? "bg-white text-black shadow-sm"
                    : "text-zinc-400 hover:text-white"
                } ${uploading ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <span>🎬 Video Only</span>
                <span className={`text-[10px] font-normal ${uploadMode === "videoOnly" ? "text-zinc-600" : "text-zinc-500"}`}>(Auto-Audio & Canvas)</span>
              </button>
            </div>

            <form onSubmit={handleUpload} className="p-6 md:p-7 space-y-5 relative">
              {/* Full Uploading Overlay with animated step progress */}
              {uploading && (
                <div className="absolute inset-0 z-30 bg-black/95 backdrop-blur-md rounded-3xl flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-200">
                  <div className="relative mb-6">
                    <div className="w-20 h-20 rounded-full border-4 border-zinc-800 border-t-white animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <svg className="w-8 h-8 text-white animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                    </div>
                  </div>

                  <h3 className="text-xl font-bold text-white mb-1.5">
                    Processing & Uploading Track
                  </h3>
                  <p className="text-sm font-semibold text-zinc-300 mb-6 font-mono max-w-md">
                    {uploadProgressText || "Transferring media files..."}
                  </p>

                  {/* Progress Step Badges */}
                  <div className="grid grid-cols-3 gap-3 w-full max-w-lg mb-4">
                    <div className={`p-3 rounded-xl border text-left transition-all ${
                      uploadStep >= 1 
                        ? "bg-white text-black border-white"
                        : "bg-black/60 border-[#282828] text-zinc-500"
                    }`}>
                      <div className="flex items-center gap-1.5 font-bold text-xs mb-0.5">
                        {uploadStep > 1 ? (
                          <span className="w-4 h-4 rounded-full bg-black text-white flex items-center justify-center text-[10px]">✓</span>
                        ) : (
                          <span className="w-4 h-4 rounded-full bg-black text-white flex items-center justify-center text-[10px]">1</span>
                        )}
                        <span>S3 Storage</span>
                      </div>
                      <span className="text-[10px] opacity-80">{uploadMode === "videoOnly" ? "Full Video" : "Audio Track"}</span>
                    </div>

                    <div className={`p-3 rounded-xl border text-left transition-all ${
                      uploadStep >= 2
                        ? "bg-white text-black border-white"
                        : "bg-black/60 border-[#282828] text-zinc-500"
                    }`}>
                      <div className="flex items-center gap-1.5 font-bold text-xs mb-0.5">
                        {uploadStep > 2 ? (
                          <span className="w-4 h-4 rounded-full bg-black text-white flex items-center justify-center text-[10px]">✓</span>
                        ) : (
                          <span className="w-4 h-4 rounded-full bg-black text-white flex items-center justify-center text-[10px]">2</span>
                        )}
                        <span>ImageKit</span>
                      </div>
                      <span className="text-[10px] opacity-80">Artwork & Canvas</span>
                    </div>

                    <div className={`p-3 rounded-xl border text-left transition-all ${
                      uploadStep >= 3
                        ? "bg-white text-black border-white"
                        : "bg-black/60 border-[#282828] text-zinc-500"
                    }`}>
                      <div className="flex items-center gap-1.5 font-bold text-xs mb-0.5">
                        <span className="w-4 h-4 rounded-full bg-black text-white flex items-center justify-center text-[10px]">3</span>
                        <span>Worker Job</span>
                      </div>
                      <span className="text-[10px] opacity-80">Queue Transcode</span>
                    </div>
                  </div>

                  <p className="text-xs text-zinc-500">
                    Please keep this window open while files are being transferred to storage.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                {/* LEFT COLUMN: Metadata & Preview Timing */}
                <div className="space-y-4">
                  <div className="space-y-3 bg-black/40 p-4 rounded-2xl border border-[#282828]">
                    <span className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Track Details</span>
                    <div>
                      <label className={labelCls}>Song Title <span className="text-red-400">*</span></label>
                      <input required type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="e.g. Moonlight Sonata" className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Artist Name <span className="text-red-400">*</span></label>
                      <input required type="text" value={formData.artistName} onChange={e => setFormData({...formData, artistName: e.target.value})} placeholder="e.g. Beethoven" className={inputCls} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls}>Language <span className="text-red-400">*</span></label>
                        <input required type="text" value={formData.language} onChange={e => setFormData({...formData, language: e.target.value})} placeholder="Hindi" className={inputCls} />
                      </div>
                      <div>
                        <label className={labelCls}>LRCLIB ID</label>
                        <input type="text" value={formData.lrclibId} onChange={e => setFormData({...formData, lrclibId: e.target.value})} placeholder="e.g. 123456" className={inputCls} />
                      </div>
                    </div>
                  </div>

                  {/* PREVIEW / BEST PART TIMING */}
                  <div className="border border-[#282828] rounded-2xl p-4 bg-black/40">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        Preview / Best Part Timing <span className="text-zinc-500 normal-case font-normal text-[10px]">(Optional)</span>
                      </label>
                      <span className="text-[10px] text-zinc-300 font-bold bg-zinc-800 px-2 py-0.5 rounded-full border border-[#282828]">Snack / Preview</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 mb-3">Specify the timestamp snippet for audio previews (leave blank for start):</p>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-[#121212] p-2.5 rounded-xl border border-[#282828]">
                        <span className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Preview Start</span>
                        <div className="flex items-center gap-2">
                          <div className="flex-1">
                            <span className="text-[9px] text-zinc-400">Min</span>
                            <input
                              type="number"
                              min="0"
                              max="99"
                              placeholder="0"
                              value={formData.previewStartMin}
                              onChange={e => setFormData({ ...formData, previewStartMin: e.target.value === "" ? "" : Math.max(0, parseInt(e.target.value) || 0) })}
                              className="w-full bg-black/60 border border-[#282828] rounded-lg px-2 py-1 text-sm font-mono text-center font-bold text-white focus:outline-none focus:border-white"
                            />
                          </div>
                          <span className="font-bold text-zinc-400 mt-3">:</span>
                          <div className="flex-1">
                            <span className="text-[9px] text-zinc-400">Sec</span>
                            <input
                              type="number"
                              min="0"
                              max="59"
                              placeholder="00"
                              value={formData.previewStartSec}
                              onChange={e => setFormData({ ...formData, previewStartSec: e.target.value === "" ? "" : Math.max(0, Math.min(59, parseInt(e.target.value) || 0)) })}
                              className="w-full bg-black/60 border border-[#282828] rounded-lg px-2 py-1 text-sm font-mono text-center font-bold text-white focus:outline-none focus:border-white"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="bg-[#121212] p-2.5 rounded-xl border border-[#282828]">
                        <span className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Preview End</span>
                        <div className="flex items-center gap-2">
                          <div className="flex-1">
                            <span className="text-[9px] text-zinc-400">Min</span>
                            <input
                              type="number"
                              min="0"
                              max="99"
                              placeholder="0"
                              value={formData.previewEndMin}
                              onChange={e => setFormData({ ...formData, previewEndMin: e.target.value === "" ? "" : Math.max(0, parseInt(e.target.value) || 0) })}
                              className="w-full bg-black/60 border border-[#282828] rounded-lg px-2 py-1 text-sm font-mono text-center font-bold text-white focus:outline-none focus:border-white"
                            />
                          </div>
                          <span className="font-bold text-zinc-400 mt-3">:</span>
                          <div className="flex-1">
                            <span className="text-[9px] text-zinc-400">Sec</span>
                            <input
                              type="number"
                              min="0"
                              max="59"
                              placeholder="00"
                              value={formData.previewEndSec}
                              onChange={e => setFormData({ ...formData, previewEndSec: e.target.value === "" ? "" : Math.max(0, Math.min(59, parseInt(e.target.value) || 0)) })}
                              className="w-full bg-black/60 border border-[#282828] rounded-lg px-2 py-1 text-sm font-mono text-center font-bold text-white focus:outline-none focus:border-white"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* RIGHT COLUMN: Media & File Uploads */}
                <div className="space-y-4">
                  {uploadMode === "videoOnly" ? (
                    <div className="space-y-3.5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="border-2 border-dashed border-[#282828] bg-black/50 rounded-2xl p-3.5">
                          <div className="flex items-center justify-between mb-1">
                            <label className={labelCls + " text-white mb-0 font-bold"}>Full Video <span className="text-red-500">*</span></label>
                            <span className="text-[9px] text-white font-bold px-2 py-0.5 rounded-full bg-zinc-800 border border-[#282828]">Shaka HLS</span>
                          </div>
                          <p className="text-[10px] text-zinc-400 mb-2">Music video file (.mp4, .mov, .mkv). Audio extracted automatically.</p>
                          <input required type="file" accept="video/*" onChange={e => setFormData({...formData, fullVideoFile: e.target.files?.[0] || null})} className={fileCls} />
                        </div>

                        <div className="border border-dashed border-[#282828] rounded-2xl p-3.5 bg-black/50 flex flex-col justify-between">
                          <div>
                            <label className={labelCls + " mb-1"}>Cover Image <span className="text-red-400">*</span></label>
                            <p className="text-[10px] text-zinc-400 mb-2">Square album artwork (ImageKit optimized).</p>
                          </div>
                          <input required type="file" accept="image/*" onChange={e => setFormData({...formData, imageFile: e.target.files?.[0] || null})} className={fileCls} />
                        </div>
                      </div>

                      {/* Canvas Video Clipping Instruction Card */}
                      <div className="border border-[#282828] rounded-2xl p-4 bg-black/40">
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" /></svg>
                            Canvas Loop Cut
                          </label>
                          <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">Auto-Cut</span>
                        </div>
                        <p className="text-[11px] text-zinc-400 mb-3">Timestamp range in full video to cut for looping player canvas:</p>
                        
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-[#121212] p-2.5 rounded-xl border border-[#282828]">
                            <span className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Clip Start</span>
                            <div className="flex items-center gap-2">
                              <div className="flex-1">
                                <span className="text-[9px] text-zinc-400">Min</span>
                                <input
                                  type="number"
                                  min="0"
                                  max="99"
                                  value={formData.clipStartMin}
                                  onChange={e => setFormData({...formData, clipStartMin: Math.max(0, parseInt(e.target.value) || 0)})}
                                  className="w-full bg-black/60 border border-[#282828] rounded-lg px-2 py-1 text-sm font-mono text-center font-bold text-white focus:outline-none focus:border-white"
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
                                  className="w-full bg-black/60 border border-[#282828] rounded-lg px-2 py-1 text-sm font-mono text-center font-bold text-white focus:outline-none focus:border-white"
                                />
                              </div>
                            </div>
                          </div>

                          <div className="bg-[#121212] p-2.5 rounded-xl border border-[#282828]">
                            <span className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Clip End</span>
                            <div className="flex items-center gap-2">
                              <div className="flex-1">
                                <span className="text-[9px] text-zinc-400">Min</span>
                                <input
                                  type="number"
                                  min="0"
                                  max="99"
                                  value={formData.clipEndMin}
                                  onChange={e => setFormData({...formData, clipEndMin: Math.max(0, parseInt(e.target.value) || 0)})}
                                  className="w-full bg-black/60 border border-[#282828] rounded-lg px-2 py-1 text-sm font-mono text-center font-bold text-white focus:outline-none focus:border-white"
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
                                  className="w-full bg-black/60 border border-[#282828] rounded-lg px-2 py-1 text-sm font-mono text-center font-bold text-white focus:outline-none focus:border-white"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* STANDARD AUDIO MODE FIELDS: 2x2 grid */
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div className="border border-dashed border-[#282828] rounded-2xl p-3.5 bg-black/50">
                        <label className={labelCls + " mb-1"}>Audio Track <span className="text-red-400">*</span></label>
                        <p className="text-[10px] text-zinc-400 mb-2">MP3, WAV, AAC, FLAC audio source.</p>
                        <input required type="file" accept="audio/*" onChange={e => setFormData({...formData, songFile: e.target.files?.[0] || null})} className={fileCls} />
                      </div>
                      <div className="border border-dashed border-[#282828] rounded-2xl p-3.5 bg-black/50">
                        <label className={labelCls + " mb-1"}>Cover Image <span className="text-red-400">*</span></label>
                        <p className="text-[10px] text-zinc-400 mb-2">Square artwork (JPEG, PNG, WebP).</p>
                        <input required type="file" accept="image/*" onChange={e => setFormData({...formData, imageFile: e.target.files?.[0] || null})} className={fileCls} />
                      </div>
                      <div className="border border-dashed border-[#282828] rounded-2xl p-3.5 bg-black/50">
                        <label className={labelCls + " mb-1"}>Canvas Video <span className="text-zinc-400 font-normal text-[10px]">(Optional)</span></label>
                        <p className="text-[10px] text-zinc-400 mb-2">Short looping video snippet for player background.</p>
                        <input type="file" accept="video/mp4,video/*" onChange={e => setFormData({...formData, videoFile: e.target.files?.[0] || null})} className={fileCls} />
                      </div>
                      <div className="border border-dashed border-[#282828] rounded-2xl p-3.5 bg-black/50">
                        <label className={labelCls + " mb-1"}>Full Music Video <span className="text-zinc-400 font-normal text-[10px]">(Optional)</span></label>
                        <p className="text-[10px] text-zinc-400 mb-2">Complete video for multi-bitrate HLS/DASH streaming.</p>
                        <input type="file" accept="video/*" onChange={e => setFormData({...formData, fullVideoFile: e.target.files?.[0] || null})} className={fileCls} />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* FOOTER ACTION BAR */}
              <div className="pt-4 border-t border-[#282828] flex items-center justify-between">
                <div className="text-xs text-zinc-400 flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>{uploadMode === "videoOnly" ? "Mode: Video with automated audio & canvas extraction" : "Mode: Standard multi-track audio upload"}</span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    disabled={uploading}
                    onClick={() => setIsModalOpen(false)}
                    className="px-5 py-2.5 rounded-full border border-[#282828] text-zinc-300 font-bold text-xs hover:bg-white/10 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={uploading}
                    type="submit"
                    className={`px-8 py-2.5 rounded-full font-bold text-black text-xs transition-all flex items-center justify-center gap-2 ${
                      uploading
                        ? "bg-zinc-400 cursor-not-allowed"
                        : "bg-white hover:bg-zinc-200 active:scale-[0.99] shadow-sm"
                    }`}
                  >
                    {uploading ? (
                      <>
                        <svg className="animate-spin h-3.5 w-3.5 text-black" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span>{uploadProgressText || "Processing Upload..."}</span>
                      </>
                    ) : (
                      uploadMode === "videoOnly" ? "Upload Video & Process Track" : "Finalize & Upload Track"
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingSong && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#121212] w-full max-w-lg rounded-2xl shadow-2xl border border-[#282828] overflow-hidden text-white">
            <div className="px-6 py-5 border-b border-[#282828] flex items-center gap-4">
              {editingSong.imageKey && (
                <img src={getImageUrl(editingSong.imageKey, { width: 80, height: 80, focus: "auto", aspectRatio: "1-1" })} alt="" className="w-12 h-12 rounded-xl object-cover shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-bold text-white truncate">{editingSong.title}</h2>
                <p className="text-xs text-zinc-400">{editingSong.artistName}</p>
              </div>
              <button onClick={handleCloseEdit} className="text-zinc-400 hover:text-white hover:rotate-90 transition-all shrink-0">
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
                <div className="col-span-2 grid grid-cols-2 gap-3 bg-black/40 p-3.5 rounded-xl border border-[#282828]">
                  <div>
                    <label className={labelCls + " text-white mb-1"}>Best Part Start</label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <span className="text-[10px] text-zinc-400 font-bold block mb-1">Min</span>
                        <input
                          type="number"
                          min="0"
                          max="99"
                          placeholder="0"
                          value={editFormData.previewStartMin}
                          onChange={e => setEditFormData({ ...editFormData, previewStartMin: e.target.value === "" ? "" : Math.max(0, parseInt(e.target.value) || 0) })}
                          className="w-full bg-black/60 border border-[#282828] rounded-lg px-2.5 py-2 text-sm font-mono text-center font-bold text-white focus:outline-none focus:border-white"
                        />
                      </div>
                      <span className="font-bold text-zinc-400 mt-4">:</span>
                      <div className="flex-1">
                        <span className="text-[10px] text-zinc-400 font-bold block mb-1">Sec</span>
                        <input
                          type="number"
                          min="0"
                          max="59"
                          placeholder="00"
                          value={editFormData.previewStartSec}
                          onChange={e => setEditFormData({ ...editFormData, previewStartSec: e.target.value === "" ? "" : Math.max(0, Math.min(59, parseInt(e.target.value) || 0)) })}
                          className="w-full bg-black/60 border border-[#282828] rounded-lg px-2.5 py-2 text-sm font-mono text-center font-bold text-white focus:outline-none focus:border-white"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className={labelCls + " text-white mb-1"}>Best Part End</label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <span className="text-[10px] text-zinc-400 font-bold block mb-1">Min</span>
                        <input
                          type="number"
                          min="0"
                          max="99"
                          placeholder="0"
                          value={editFormData.previewEndMin}
                          onChange={e => setEditFormData({ ...editFormData, previewEndMin: e.target.value === "" ? "" : Math.max(0, parseInt(e.target.value) || 0) })}
                          className="w-full bg-black/60 border border-[#282828] rounded-lg px-2.5 py-2 text-sm font-mono text-center font-bold text-white focus:outline-none focus:border-white"
                        />
                      </div>
                      <span className="font-bold text-zinc-400 mt-4">:</span>
                      <div className="flex-1">
                        <span className="text-[10px] text-zinc-400 font-bold block mb-1">Sec</span>
                        <input
                          type="number"
                          min="0"
                          max="59"
                          placeholder="00"
                          value={editFormData.previewEndSec}
                          onChange={e => setEditFormData({ ...editFormData, previewEndSec: e.target.value === "" ? "" : Math.max(0, Math.min(59, parseInt(e.target.value) || 0)) })}
                          className="w-full bg-black/60 border border-[#282828] rounded-lg px-2.5 py-2 text-sm font-mono text-center font-bold text-white focus:outline-none focus:border-white"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="col-span-2 text-[11px] text-zinc-400">
                    Hover preview plays this segment (specified in minutes &amp; seconds). Leave blank to disable.
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 pt-1">
                <div className="border border-dashed border-[#282828] rounded-xl p-3 bg-black/40">
                  <label className={labelCls + " mb-1"}>Replace Cover Image <span className="text-zinc-400 normal-case font-normal">(optional)</span></label>
                  <input type="file" accept="image/*" onChange={e => setEditFormData({...editFormData, imageFile: e.target.files?.[0] || null})} className={fileCls} />
                </div>

                {/* Video Canvas Section */}
                <div className="border border-dashed border-[#282828] rounded-xl p-3 bg-black/40">
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
                            ? "bg-zinc-800 text-white hover:bg-zinc-700"
                            : "bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30"
                        }`}
                      >
                        {editFormData.removeVideo ? "Undo Remove" : "Remove Video Canvas"}
                      </button>
                    )}
                  </div>
                  {editingSong.videoKey && !editFormData.removeVideo && (
                    <p className="text-[10px] text-emerald-400 font-medium mb-2 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" /></svg>
                      Active canvas video attached
                    </p>
                  )}
                  {editFormData.removeVideo && (
                    <p className="text-[10px] text-red-400 font-bold mb-2 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                      Video canvas will be removed upon saving
                    </p>
                  )}
                  {!editFormData.removeVideo && (
                    <input type="file" accept="video/mp4,video/*" onChange={e => setEditFormData({...editFormData, videoFile: e.target.files?.[0] || null})} className={fileCls} />
                  )}
                </div>

                {/* Full Video Stream Section */}
                <div className="border border-dashed border-[#282828] rounded-xl p-3 bg-black/40">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <label className={labelCls + " mb-0 text-white"}>
                        Full Music Video
                        <span className="text-zinc-400 normal-case font-normal ml-1">(S3 Shaka Stream)</span>
                      </label>
                      {editingSong.fullVideoKey && !editFormData.removeFullVideo && !editFormData.fullVideoFile && (
                        <p className="text-[10px] text-emerald-400 font-medium mt-0.5 flex items-center gap-1">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" /></svg>
                          Active full video stream attached
                        </p>
                      )}
                      {editFormData.removeFullVideo && (
                        <p className="text-[10px] text-red-400 font-bold mt-0.5 flex items-center gap-1">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                          Full video will be removed on save
                        </p>
                      )}
                    </div>
                    {editingSong.fullVideoKey && (
                      <button
                        type="button"
                        onClick={() => setEditFormData({ ...editFormData, removeFullVideo: !editFormData.removeFullVideo, fullVideoFile: null })}
                        className={`text-xs font-bold px-2.5 py-1 rounded-lg transition-all shrink-0 ${
                          editFormData.removeFullVideo
                            ? "bg-zinc-800 text-white hover:bg-zinc-700"
                            : "bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30"
                        }`}
                      >
                        {editFormData.removeFullVideo ? "Undo Remove" : "Remove"}
                      </button>
                    )}
                  </div>

                  {/* Upload new full video — always shown unless removal is pending */}
                  {!editFormData.removeFullVideo && (
                    <div>
                      <p className="text-[11px] text-zinc-400 mb-2">
                        {editingSong.fullVideoKey
                          ? "Upload a new video to replace the existing full video stream. It will be re-processed with Shaka Packager."
                          : "Upload a full music video (.mp4, .mov). It will be packaged into adaptive streaming (HLS/DASH) via Shaka Packager."}
                      </p>
                      <input
                        type="file"
                        accept="video/*"
                        onChange={e => setEditFormData({ ...editFormData, fullVideoFile: e.target.files?.[0] || null })}
                        className={fileCls}
                      />
                      {editFormData.fullVideoFile && (
                        <div className="mt-2 flex items-center gap-2 text-[11px] text-zinc-300 font-semibold">
                          <svg className="w-3.5 h-3.5 shrink-0 text-white" fill="currentColor" viewBox="0 0 20 20"><path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" /></svg>
                          {editFormData.fullVideoFile.name}
                          <span className="text-zinc-500 font-normal">· Will trigger background Shaka processing</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <button disabled={uploading} type="submit" className={`w-full py-3 rounded-full font-bold text-black text-sm transition-all flex items-center justify-center gap-2 ${uploading ? "bg-zinc-400 cursor-not-allowed" : "bg-white hover:bg-zinc-200"}`}>
                {uploading ? (<><svg className="animate-spin h-4 w-4 text-black" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>Saving...</>) : "Save Changes"}
              </button>
            </form>
          </div>
        </div>
      )}
      {/* Toast Notifications */}
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

export default function SongsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-white" />
        </div>
      }
    >
      <SongsContent />
    </Suspense>
  );
}
